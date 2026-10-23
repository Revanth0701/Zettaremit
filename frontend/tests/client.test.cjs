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

test('integer-cent preview agrees with decimal backend boundary rounding',()=>{
 const { preview }=require('../lib/money');
 assert.deepEqual(preview('1000.00'),{gross:'1000.00',fee:'30.00',net:'970.00',received:'11.62'});
 assert.equal(preview('0.50').fee,'0.02');
 for(const invalid of ['NaN','-1','0','1.001','1000000.01'])assert.equal(preview(invalid),null);
});
