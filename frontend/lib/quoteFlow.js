// Quote state contains private, in-memory metadata. Never log or persist it.
const { normalizeInr } = require('./money');
const ATTRIBUTION_URL = 'https://www.exchangerate-api.com';
const ATTRIBUTION_TEXT = 'Rates By Exchange Rate API';

function inputFor(recipient, amount) {
  const name = recipient.trim();
  const gross = normalizeInr(amount.replace(/,/g, ''));
  return name && name.length <= 255 && !/[\x00-\x1f]/.test(name) && gross
    ? { recipient_name:name, gross_amount:gross } : null;
}
function validateQuote(data, input, now) {
  const invalid = () => { throw new Error('Invalid quote response. Please request a new quote.'); };
  if (!data || !input || data.recipient_name !== input.recipient_name || data.gross_amount !== input.gross_amount
      || data.source_currency !== 'INR' || data.target_currency !== 'USD' || data.fee_percent !== '3'
      || data.simulation !== true || !/^QUOTE-[a-f0-9]{32}$/.test(data.quote_id)
      || typeof data.quote_token !== 'string' || !data.quote_token || data.quote_token.length > 8192
      || data.attribution_text !== ATTRIBUTION_TEXT || data.attribution_url !== ATTRIBUTION_URL
      || typeof data.rate_schedule_overdue !== 'boolean') invalid();
  for (const field of ['gross_amount','fee_deducted','net_amount','recipient_amount']) {
    if (typeof data[field] !== 'string' || !/^[0-9]{1,16}\.[0-9]{2}$/.test(data[field])) invalid();
  }
  if (typeof data.exchange_rate !== 'string' || !/^[0-9]{1,10}\.[0-9]{8}$/.test(data.exchange_rate)
      || BigInt(data.exchange_rate.replace('.', '')) <= 0n) invalid();
  const dates = {};
  for (const field of ['issued_at','expires_at','provider_updated_at','provider_next_update_at','rate_valid_until']) {
    if (typeof data[field] !== 'string' || !/(Z|\+00:00)$/.test(data[field])) invalid();
    dates[field] = Date.parse(data[field]);
    if (!Number.isFinite(dates[field])) invalid();
  }
  if (dates.expires_at <= now || dates.issued_at > now + 30000 || dates.expires_at <= dates.issued_at
      || dates.expires_at - dates.issued_at > 300000 || dates.expires_at > dates.rate_valid_until
      || dates.provider_updated_at > dates.issued_at || dates.provider_next_update_at <= dates.provider_updated_at) invalid();
  // Copy only the documented display/token fields. No independent FX arithmetic.
  const fields = ['quote_id','quote_token','recipient_name','gross_amount','fee_deducted','net_amount','recipient_amount',
    'exchange_rate','source_currency','target_currency','fee_percent','simulation','provider_updated_at',
    'provider_next_update_at','rate_valid_until','rate_schedule_overdue','issued_at','expires_at','attribution_text','attribution_url'];
  return Object.freeze(Object.fromEntries(fields.map(field => [field,data[field]])));
}

function createQuoteFlow({ api, newKey, now = Date.now }) {
  let state = { input:null, quote:null, accepted:false, expired:false, loading:false, submitting:false,
    error:'', pending:null, receipt:null };
  let version = 0;
  const listeners = new Set();
  const publish = changes => { state = { ...state,...changes }; listeners.forEach(listener => listener(state)); };
  const fresh = () => state.quote && Date.parse(state.quote.expires_at) > now();
  const locked = () => state.submitting || !!state.pending;
  function setInput(recipient, amount) {
    const input = inputFor(recipient, amount);
    if (JSON.stringify(input) === JSON.stringify(state.input)) return true;
    if (locked()) { publish({error:'Resolve the previous attempt using its original request before changing transfer details.'}); return false; }
    version++; publish({input,quote:null,accepted:false,expired:false,loading:false,error:''}); return true;
  }
  async function loadQuote() {
    if (locked() || state.loading) return;
    if (!state.input) { publish({error:'Enter a recipient and an INR amount from 0.01 to 1,000,000.00 (up to two decimals).'}); return; }
    const id = ++version;
    const input = state.input;
    publish({loading:true,quote:null,accepted:false,expired:false,error:''});
    try {
      const data = await api.quote(input);
      if (id !== version) return;
      publish({quote:validateQuote(data,input,now()),loading:false});
    } catch (failure) { if (id === version) publish({loading:false,error:failure.message || 'Quote unavailable. Please try again.'}); }
  }
  function accept() {
    if (!fresh() || state.loading || locked()) { publish({accepted:false,error:'Load a current quote and review it before continuing.'}); return false; }
    publish({accepted:true,error:''}); return true;
  }
  async function send(retry) {
    if (state.submitting) return null;
    if (api.transfersDisabled === true) { publish({error:'Transactions are disabled in this fictional local preview.'}); return null; }
    if (!retry && (!fresh() || !state.accepted || state.pending)) {
      publish({error:'A current, accepted quote is required. Refresh and review the quote.'}); return null;
    }
    if (retry && !state.pending) return null;
    const priorUncertain = !!state.pending;
    const attempt = state.pending || Object.freeze({ key:newKey(), body:Object.freeze({ ...state.input,quote_token:state.quote.quote_token }) });
    publish({submitting:true,pending:attempt,error:''});
    try {
      const data = await api.transfer(attempt.body,attempt.key);
      if (!data?.transaction?.transaction_id) throw new Error('Unable to confirm the result. Retry the previous attempt.');
      publish({submitting:false,pending:null,receipt:data.transaction,accepted:false});
      return data.transaction;
    } catch (failure) {
      // An ambiguous outcome must retain the exact token/key, even past expiry.
      // Recovery never refreshes a quote or creates a replacement request.
      const definite = !priorUncertain && [400,403,422,429].includes(failure.status);
      publish({submitting:false,pending:definite ? null : attempt,
        accepted:definite ? false : state.accepted,
        quote:definite && failure.status === 422 ? null : state.quote,
        error:priorUncertain && failure.status === 422
          ? 'Previous outcome remains unconfirmed. Check history before starting another simulation; keep this request for recovery.'
          : failure.message || 'Unable to confirm the result. Retry the previous attempt.'});
      return null;
    }
  }
  return {
    getSnapshot:() => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    setInput,loadQuote,accept,
    submit:() => send(false), retryPending:() => send(true),
    tick() { if (state.quote && !fresh() && !state.expired) publish({expired:true,accepted:false}); },
    reset() { if (locked()) return false; version++; publish({quote:null,accepted:false,expired:false,receipt:null,error:''}); return true; }
  };
}
module.exports = { createQuoteFlow, validateQuote, inputFor, ATTRIBUTION_URL, ATTRIBUTION_TEXT };
