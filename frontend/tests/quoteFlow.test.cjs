const { test } = require('node:test');
const assert = require('node:assert/strict');
const {createQuoteFlow,validateQuote,inputFor} = require('../lib/quoteFlow');
const preview = require('../preview/mockApi');

async function setup() {
  let time=Date.now();
  let keys=0;
  const calls=[];
  const api={quote:async input=>preview.quote(input),transfer:async(body,key)=>{calls.push({body,key});return {transaction:{transaction_id:'synthetic',recipient_amount:'10.78'}}}};
  const flow=createQuoteFlow({api,newKey:()=>`synthetic-key-${++keys}`,now:()=>time});
  flow.setInput('Synthetic','1000');
  return {api,flow,calls,advance:ms=>{time+=ms;flow.tick()},get keys(){return keys},get now(){return time}};
}
test('load and accept server-provided strings without repricing, then submit token',async()=>{
  const ctx=await setup();await ctx.flow.loadQuote();
  const quote=ctx.flow.getSnapshot().quote;
  assert.equal(quote.exchange_rate,'90.00000000');assert.equal(quote.fee_deducted,'30.00');
  assert.equal(quote.net_amount,'970.00');assert.equal(quote.recipient_amount,'10.78');
  assert.equal(ctx.flow.accept(),true);
  assert.equal((await ctx.flow.submit()).transaction_id,'synthetic');
  assert.deepEqual(ctx.calls[0].body,{recipient_name:'Synthetic',gross_amount:'1000.00',quote_token:quote.quote_token});
  assert.equal(ctx.keys,1);
});
test('missing/unaccepted quotes cannot submit',async()=>{
  const ctx=await setup();assert.equal(await ctx.flow.submit(),null);
  await ctx.flow.loadQuote();assert.equal(await ctx.flow.submit(),null);assert.equal(ctx.calls.length,0);
});
test('expiry blocks new submission and refresh requires renewed acceptance',async()=>{
  const ctx=await setup();await ctx.flow.loadQuote();ctx.flow.accept();ctx.advance(300000);
  assert.equal(ctx.flow.getSnapshot().expired,true);assert.equal(await ctx.flow.submit(),null);
  ctx.api.quote=async input=>{const value=await preview.quote(input);return {...value,issued_at:new Date(ctx.now).toISOString(),expires_at:new Date(ctx.now+300000).toISOString()}};
  await ctx.flow.loadQuote();assert.equal(ctx.flow.getSnapshot().expired,false);assert.equal(ctx.flow.getSnapshot().accepted,false);
  ctx.flow.accept();await ctx.flow.submit();assert.equal(ctx.calls.length,1);
});
test('amount and recipient edits invalidate the previous quote',async()=>{
  const ctx=await setup();await ctx.flow.loadQuote();ctx.flow.accept();
  ctx.flow.setInput('Other','1000');assert.equal(ctx.flow.getSnapshot().quote,null);
  await ctx.flow.loadQuote();ctx.flow.setInput('Other','1001');assert.equal(ctx.flow.getSnapshot().quote,null);
});
test('out-of-order quote responses cannot restore stale input',async()=>{
  const ctx=await setup();let finish;
  ctx.api.quote=input=>new Promise(resolve=>{finish=()=>preview.quote(input).then(resolve)});
  const loading=ctx.flow.loadQuote();ctx.flow.setInput('Other','2000');await finish();await loading;
  assert.equal(ctx.flow.getSnapshot().quote,null);assert.equal(ctx.flow.getSnapshot().loading,false);
});
test('provider/network failures and malformed quotes block acceptance',async()=>{
  const ctx=await setup();
  for(const message of ['Network unavailable','Daily reference rates unavailable']){
    ctx.api.quote=async()=>{throw new Error(message)};await ctx.flow.loadQuote();
    assert.equal(ctx.flow.accept(),false);assert.equal(ctx.flow.getSnapshot().quote,null);
  }
  ctx.api.quote=async input=>({...await preview.quote(input),source_currency:'USD'});
  await ctx.flow.loadQuote();assert.equal(ctx.flow.getSnapshot().quote,null);
});
test('same token and key survive ambiguous failures and expiry for replay only',async()=>{
  const ctx=await setup();await ctx.flow.loadQuote();ctx.flow.accept();
  ctx.api.transfer=async(body,key)=>{ctx.calls.push({body,key});if(ctx.calls.length===1)throw new Error('Network uncertain');return {transaction:{transaction_id:'synthetic'}}};
  await ctx.flow.submit();ctx.advance(300000);
  assert.equal(ctx.flow.setInput('Other','2000'),false);
  await ctx.flow.loadQuote();assert.equal(await ctx.flow.submit(),null);
  await ctx.flow.retryPending();assert.deepEqual(ctx.calls[0],ctx.calls[1]);assert.equal(ctx.keys,1);
});
test('definitive invalid quote response requires a replacement quote',async()=>{
  const ctx=await setup();await ctx.flow.loadQuote();ctx.flow.accept();
  ctx.api.transfer=async()=>{throw Object.assign(new Error('Quote expired'),{status:422})};
  await ctx.flow.submit();assert.equal(ctx.flow.getSnapshot().quote,null);assert.equal(ctx.flow.getSnapshot().pending,null);
});
test('conflicts preserve the previous attempt and never generate a fresh key automatically',async()=>{
  const ctx=await setup();await ctx.flow.loadQuote();ctx.flow.accept();
  ctx.api.transfer=async()=>{throw Object.assign(new Error('Request conflict. Review history.'),{status:409})};
  await ctx.flow.submit();await ctx.flow.retryPending();
  assert.equal(ctx.keys,1);assert.ok(ctx.flow.getSnapshot().pending);assert.match(ctx.flow.getSnapshot().error,/conflict/);
});
test('concurrent submit clicks issue only one request',async()=>{
  const ctx=await setup();await ctx.flow.loadQuote();ctx.flow.accept();let finish;
  ctx.api.transfer=async()=>new Promise(resolve=>{finish=resolve});
  const first=ctx.flow.submit();assert.equal(await ctx.flow.submit(),null);
  finish({transaction:{transaction_id:'synthetic'}});await first;assert.equal(ctx.keys,1);
});
test('preview quotes are fictional and all write methods remain disabled',async()=>{
  const quote=await preview.quote(inputFor('Fictional recipient','1000'));
  assert.match(quote.quote_token,/FICTIONAL/);validateQuote(quote,inputFor('Fictional recipient','1000'),Date.now());
  for(const method of ['transfer','register','login','request'])await assert.rejects(()=>preview[method](),/disabled/);
  const flow=createQuoteFlow({api:preview,newKey:()=>{throw new Error('No key should be generated')}});
  flow.setInput('Fictional','1000');await flow.loadQuote();flow.accept();await flow.submit();
  assert.equal(flow.getSnapshot().pending,null);assert.match(flow.getSnapshot().error,/disabled/);
});
test('invalid/mismatched response types, dates and rates fail closed',async()=>{
  const input=inputFor('Synthetic','1000');const quote=await preview.quote(input);
  for(const changes of [{exchange_rate:'0.00000000'},{exchange_rate:90},{recipient_amount:10.78},
    {attribution_url:'https://untrusted.example'},{recipient_name:'Other'},{expires_at:'invalid'},
    {expires_at:new Date(Date.now()-1).toISOString()},{simulation:false}]){
    assert.throws(()=>validateQuote({...quote,...changes},input,Date.now()));
  }
});
