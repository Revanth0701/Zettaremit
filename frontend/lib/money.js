// Validate/canonicalize INR input only. All fees and payouts come from quotes.
function fixed(cents) { return `${cents / 100n}.${(cents % 100n).toString().padStart(2,'0')}`; }
function normalizeInr(input) {
  if (typeof input !== 'string' || input.length > 32 || !/^[0-9]+(?:\.[0-9]{0,2})?$/.test(input)) return null;
  const [whole, fraction=''] = input.split('.');
  const gross = BigInt(whole) * 100n + BigInt(fraction.padEnd(2,'0'));
  if (gross <= 0n || gross > 100000000n) return null;
  return fixed(gross);
}
module.exports = { normalizeInr };
