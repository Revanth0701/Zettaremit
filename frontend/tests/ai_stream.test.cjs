const test = require('node:test');
const assert = require('node:assert/strict');
const { createAIStreamConsumer } = require('../lib/aiStream');
const { createClient } = require('../lib/client');

test('passive session reads clear expired or malformed sessions before protected UI entry', async () => {
  for (const session of [{token:'synthetic',expiresAt:Date.now()-1},{token:'synthetic'},{expiresAt:Date.now()+60000}]) {
    let cleared = false;
    let unauthorized = false;
    const client = createClient({baseUrl:'https://example.com',fetchImpl:async()=>{throw new Error('No network expected');},
      storage:{get:async()=>session,clear:async()=>{cleared=true;}},onUnauthorized:()=>{unauthorized=true;}});
    assert.equal(await client.session(),null);
    assert.equal(cleared,true);
    assert.equal(unauthorized,false,'Passive reads leave navigation to the protected screen');
  }
});

test('agent sources delivered only at completion reach the UI callback', () => {
  const sources = [];
  const consumer = createAIStreamConsumer({ onSources: value => sources.push(value) });
  consumer.push('data: {"type":"start","sources":[]}\r\n\r\n: keepalive\r\n\r\n');
  consumer.push('data: {"type":"chunk","content":"Hello"}\r');
  consumer.push('\n\r\ndata: {"type":"done","sources":["fees_and_rates.md"],"latency_seconds":1}\r\n\r\n');
  assert.equal(consumer.finish().answer, 'Hello');
  assert.deepEqual(sources.at(-1), ['fees_and_rates.md']);
});

test('buffered native fetch responses are parsed as SSE, not displayed as protocol text', async () => {
  const client = createClient({ baseUrl: 'https://example.com',
    storage: { get: async () => ({token:'synthetic', expiresAt:Date.now()+60000}) },
    fetchImpl: async () => ({ok:true, status:200, text:async () =>
      'data: {"type":"chunk","content":"Answer"}\n\ndata: {"type":"done","sources":[]}\n\n'}) });
  const result = await client.aiAskStream('question', 'synthetic-session-123');
  assert.equal(result.answer, 'Answer');
});

test('truncated and malformed SSE never report successful completion', () => {
  const truncated = createAIStreamConsumer();
  truncated.push('data: {"type":"chunk","content":"partial"}\n\n');
  assert.throws(() => truncated.finish(), error => error.code === 'STREAM_ERROR');
  const malformed = createAIStreamConsumer();
  assert.throws(() => malformed.push('data: {broken}\n\n'), error => error.code === 'STREAM_ERROR');
});

test('buffered SSE preserves provider failures instead of showing them as answers', async () => {
  const client = createClient({ baseUrl:'https://example.com',
    storage:{get:async()=>({token:'synthetic',expiresAt:Date.now()+60000})},
    fetchImpl:async()=>({ok:true,status:200,text:async()=>
      'data: {"type":"error","error":"Service unavailable"}\n\n'}) });
  await assert.rejects(client.aiAskStream('question','synthetic-session-123'), error => error.code === 'STREAM_ERROR');
});
