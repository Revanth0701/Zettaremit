// Shared parser for browser streaming and native buffered SSE responses.
function createAIStreamConsumer({ onChunk, onSources } = {}) {
  let buffer = '';
  let answer = '';
  let sources = [];
  let latency = 0;
  let completed = false;
  let drafts = [];
  const failure = message => Object.assign(new Error(message), { code: 'STREAM_ERROR' });

  function event(frame) {
    const data = frame.split('\n').filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).replace(/^ /, '')).join('\n');
    if (!data) return; // Includes server keepalive comments.
    let value;
    try { value = JSON.parse(data); }
    catch (_) { throw failure('The assistant returned an invalid response. Please retry.'); }
    if (value.type === 'error') throw failure(value.error || 'AI generation failed. Please retry.');
    if (completed) return;
    if (Array.isArray(value.sources)) {
      sources = value.sources;
      if (onSources) onSources(sources);
    }
    if (value.type === 'chunk') {
      const chunk = value.content || '';
      answer += chunk;
      if (onChunk) onChunk(chunk, answer);
    } else if (value.type === 'done') {
      completed = true;
      if (typeof value.latency_seconds === 'number') latency = value.latency_seconds;
      if (Array.isArray(value.drafts)) drafts = value.drafts;
    }
  }

  return {
    push(text) {
      buffer = (buffer + text).replace(/\r\n/g, '\n');
      let end;
      while ((end = buffer.indexOf('\n\n')) >= 0) {
        event(buffer.slice(0, end));
        buffer = buffer.slice(end + 2);
      }
    },
    finish() {
      if (buffer.trim()) event(buffer);
      if (!completed) throw failure('The assistant response ended before completion. Please retry.');
      return { answer, sources, latency_seconds: latency, drafts };
    }
  };
}

module.exports = { createAIStreamConsumer };
