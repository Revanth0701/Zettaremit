// Display-only preview with integer cents; server/Java remain authoritative.
function fixed(cents) { return `${cents / 100n}.${(cents % 100n).toString().padStart(2,'0')}`; }
function preview(input) {
  if (!/^[0-9]+(?:\.[0-9]{0,2})?$/.test(input)) return null;
  const [whole, fraction=''] = input.split('.');
  const gross = BigInt(whole) * 100n + BigInt(fraction.padEnd(2,'0'));
  if (gross <= 0n || gross > 100000000n) return null;
  const fee = (gross * 3n + 50n) / 100n;
  const net = gross - fee;
  // Fixed illustrative 83.5 INR/USD. Round net INR cents / 83.5 to USD cents.
  const received = (net * 2n + 83n) / 167n;
  return {gross:fixed(gross), fee:fixed(fee), net:fixed(net), received:fixed(received)};
}
module.exports = { preview };
