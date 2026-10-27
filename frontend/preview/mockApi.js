// Local visual fixtures only. No real API client, credentials, storage, or network.
const disabled = () => Promise.reject(new Error('Transactions and other writes are disabled in this local visual preview.'));
const { normalizeInr } = require('../lib/money');
let sequence = 0;
const fixed = cents => `${cents / 100n}.${(cents % 100n).toString().padStart(2,'0')}`;
async function quote(input) {
  const gross = normalizeInr(input.gross_amount);
  if (!gross || !input.recipient_name) throw new Error('Enter fictional recipient and amount details.');
  const cents = BigInt(gross.replace('.',''));
  const fee = (cents * 3n + 50n) / 100n;
  const net = cents - fee;
  // Fictional 90 INR/USD, used ONLY by this isolated preview fixture.
  const payout = (net + 45n) / 90n;
  const now = Math.floor(Date.now()/1000)*1000;
  const iso = milliseconds => new Date(milliseconds).toISOString();
  sequence++;
  return {quote_id:`QUOTE-${sequence.toString(16).padStart(32,'0')}`,
    quote_token:`FICTIONAL-LOCAL-PREVIEW-NOT-A-JWT-${sequence}`,recipient_name:input.recipient_name,gross_amount:gross,
    fee_deducted:fixed(fee),net_amount:fixed(net),recipient_amount:fixed(payout),exchange_rate:'90.00000000',
    source_currency:'INR',target_currency:'USD',fee_percent:'3',simulation:true,
    provider_updated_at:iso(now-43200000),provider_next_update_at:iso(now+43200000),
    rate_valid_until:iso(now+302400000),rate_schedule_overdue:false,issued_at:iso(now),expires_at:iso(now+300000),
    attribution_text:'Rates By Exchange Rate API',attribution_url:'https://www.exchangerate-api.com'};
}
const rows = [
  { transaction_id: 'PREVIEW-FICTIONAL-001', created_at: '2026-01-15T12:00:00Z', recipient_name: 'Demo Recipient One', gross_amount: '1000.00', source_currency: 'INR', target_currency: 'USD', status: 'SIMULATED' },
  { transaction_id: 'PREVIEW-FICTIONAL-002', created_at: '2026-01-14T12:00:00Z', recipient_name: 'Demo Recipient Two', gross_amount: '2500.00', source_currency: 'INR', target_currency: 'USD', status: 'SIMULATED' }
];
module.exports = {
  transfersDisabled: true,
  quote,
  rate: async () => ({ source_currency: 'INR', target_currency: 'USD', inr_per_usd: '90.00000000', observed_at: new Date().toISOString(), attribution_text: 'Rates By Exchange Rate API', attribution_url: 'https://www.exchangerate-api.com', indicative: true }),
  getReferenceRate: async () => ({
    rate: 90.0,
    inr_per_usd: '90.00000000',
    observed_at: new Date().toISOString(),
    attribution_text: 'Rates By Exchange Rate API',
    attribution_url: 'https://www.exchangerate-api.com',
    source: 'mock'
  }),
  history: async () => rows.map(row => ({ ...row })),
  config: async () => ({ inr_per_usd: '90.00000000', fee_percent: '3' }),
  transfer: disabled,
  register: disabled,
  login: disabled,
  request: disabled,
  health: async () => ({ status: 'ok', simulation: true }),
  wakeBackend: async () => ({ ready: true }),
  logout: async () => undefined
};
