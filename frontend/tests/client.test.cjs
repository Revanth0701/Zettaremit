const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createClient } = require('../lib/client');
function setup(responses = []) {
  let session = { token:'synthetic', expiresAt:Date.now()+60000 };
  let unauthorized=0;
  const calls=[];
  const storage={get:async()=>session,set:async value=>{session=value},clear:async()=>{session=null}};
  const fetchImpl=async(...args)=>{calls.push(args); const value=responses.shift(); if(value instanceof Error)throw value;return {ok:value.status<400,status:value.status,json:async()=>value.body}};
  const client=createClient({baseUrl:'https://api.example.com',storage,fetchImpl,onUnauthorized:()=>unauthorized++});
  return {client,calls,storage,get session(){return session},get unauthorized(){return unauthorized}};
}
test('history attaches token and never sends a sender ID',async()=>{
 const ctx=setup([{status:200,body:[]}]);await ctx.client.history();
 assert.equal(ctx.calls[0][0],'https://api.example.com/transactions/');
 assert.equal(ctx.calls[0][1].headers.Authorization,'Bearer synthetic');
});
test('login stores expiring token but never a password',async()=>{
 const ctx=setup([{status:200,body:{access_token:'synthetic-new',expires_in:900,full_name:'Demo'}}]);
 await ctx.client.login('DEMO@example.com','synthetic-password');
 assert.equal(ctx.session.token,'synthetic-new');assert.ok(ctx.session.expiresAt>Date.now());
 assert.equal(Object.hasOwn(ctx.session,'password'),false);
 assert.equal(ctx.calls[0][1].headers.Authorization,undefined);
});
test('401 clears token and requests login',async()=>{
 const ctx=setup([{status:401,body:{detail:'not displayed'}}]);
 await assert.rejects(()=>ctx.client.history(),/sign in/);assert.equal(ctx.session,null);assert.equal(ctx.unauthorized,1);
});
test('login 401 preserves existing session and does not call onUnauthorized',async()=>{
 const ctx=setup([{status:401,body:{detail:'Invalid email or password'}}]);
 const initialSession=ctx.session;
 await assert.rejects(
  ()=>ctx.client.login('wrong@example.com','badpassword'),
  error=>error.message==='Incorrect email or password. Please try again.' && error.status===401
 );
 assert.equal(ctx.session,initialSession);
 assert.equal(ctx.unauthorized,0);
});
test('login 422 returns generic incorrect email or password error',async()=>{
 const ctx=setup([{status:422,body:{detail:'Validation error'}}]);
 const initialSession=ctx.session;
 await assert.rejects(
  ()=>ctx.client.login('not-an-email','short'),
  error=>error.message==='Incorrect email or password. Please try again.' && error.status===422
 );
 assert.equal(ctx.session,initialSession);
 assert.equal(ctx.unauthorized,0);
});
test('login network failure returns distinct connection error',async()=>{
 const ctx=setup([new Error('ECONNREFUSED')]);
 await assert.rejects(
  ()=>ctx.client.login('demo@example.com','synthetic-password'),
  error=>error.message==='Unable to connect. Please try again later.' && error.code==='NETWORK'
 );
});
test('expired token does not reach API',async()=>{
 const ctx=setup();await ctx.storage.set({token:'expired',expiresAt:0});
 await assert.rejects(()=>ctx.client.history(),/sign in/);assert.equal(ctx.calls.length,0);
});
test('retries preserve idempotency key; network errors are sanitized',async()=>{
 const ctx=setup([new Error('sensitive upstream'),{status:201,body:{transaction:{}}}]);
 const payload={recipient_name:'Synthetic',gross_amount:'100.00'};
 await assert.rejects(()=>ctx.client.transfer(payload,'synthetic-request-key'),/Retry/);
 await ctx.client.transfer(payload,'synthetic-request-key');
 assert.equal(ctx.calls[0][1].headers['Idempotency-Key'],ctx.calls[1][1].headers['Idempotency-Key']);
 assert.equal(ctx.calls[1][0],'https://api.example.com/transactions/create');
});
test('logout clears storage',async()=>{const ctx=setup();await ctx.client.logout();assert.equal(ctx.session,null)});
test('production refuses HTTP and local development permits loopback only',()=>{
 const options={storage:{},fetchImpl:()=>{}};
 assert.throws(()=>createClient({...options,baseUrl:'http://remote.example.com'}));
 assert.throws(()=>createClient({...options,baseUrl:'http://remote.example.com',allowHttp:true}));
 assert.doesNotThrow(()=>createClient({...options,baseUrl:'http://127.0.0.1:8000',allowHttp:true}));
});

test('INR validation canonicalizes input without calculating a payout',()=>{
 const { normalizeInr }=require('../lib/money');
 assert.equal(normalizeInr('1000'),'1000.00');
 assert.equal(normalizeInr('0.50'),'0.50');
 for(const invalid of ['NaN','-1','0','1.001','1000000.01'])assert.equal(normalizeInr(invalid),null);
});

test('quote requests authenticate and preserve decimal request strings',async()=>{
 const ctx=setup([{status:200,body:{simulation:true}}]);
 await ctx.client.quote({recipient_name:'Synthetic',gross_amount:'1000.00'});
 assert.equal(ctx.calls[0][0],'https://api.example.com/simulation/quote');
 assert.equal(ctx.calls[0][1].method,'POST');
 assert.equal(ctx.calls[0][1].headers.Authorization,'Bearer synthetic');
 assert.equal(JSON.parse(ctx.calls[0][1].body).gross_amount,'1000.00');
});

test('quote and submission errors use safe contract-specific messages',async()=>{
 const ctx=setup([{status:503,body:{detail:'private'}},{status:422,body:{detail:'private'}},{status:409,body:{detail:'private'}}]);
 await assert.rejects(()=>ctx.client.quote({}),error=>error.status===503 && /reference rates/.test(error.message));
 await assert.rejects(()=>ctx.client.transfer({},'key'),error=>error.status===422 && /expired/.test(error.message));
 await assert.rejects(()=>ctx.client.transfer({},'key'),error=>error.status===409 && /conflict/.test(error.message));
});
