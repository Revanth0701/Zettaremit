# General Remittance Education and Core Concepts

## What is a Cross-Border Remittance?
A cross-border remittance is the transfer of money by an individual to another individual (typically family or business associates) residing in a different country. In traditional banking, remittances involve foreign exchange (FX) conversion between the sender's local currency and the recipient's foreign currency.

## Real-World Remittance Workflows vs. ZettaRemit Simulation
### Real-World Commercial Remittances
- **Payment Rails**: Commercial remittance services move real money across national payment systems using financial networks like SWIFT (Society for Worldwide Interbank Financial Telecommunication), local clearinghouses (ACH in the US, NEFT/RTGS/IMPS in India), or proprietary liquidity pools.
- **Settlement Time**: Real cross-border transfers typically take between several hours to 2-3 business days depending on intermediary correspondent banks and compliance checks.
- **Regulatory Framework**: Real money services must comply with regulatory bodies (such as RBI in India, FinCEN in the US), Anti-Money Laundering (AML) laws, and Counter-Terrorist Financing (CTF) rules.

### How ZettaRemit Differs
- **Educational Simulation**: ZettaRemit is an engineering simulation. It demonstrates the API mechanics, mathematical precision, and quote signing required in financial technology, but it **moves no actual money**.
- **Instant Simulated Confirmation**: Because no banking rails or liquidity pools are debited, transfer confirmations on ZettaRemit are simulated immediately and logged with the status `SIMULATED`.

## Understanding Exchange Rates
- **Mid-Market Rate**: Also known as the interbank rate or spot rate. It represents the midpoint between global buy and sell prices in the wholesale foreign exchange market. ExchangeRate-API (used by ZettaRemit) provides this reference benchmark.
- **FX Spread / Markup**: Many commercial providers advertise "zero fee" transfers, but markup the exchange rate by 1% to 4% above the mid-market rate. This hidden markup functions as a stealth fee.
- **Transparent Pricing**: In contrast, ZettaRemit uses a completely transparent model: it applies the raw market reference rate and charges an explicit, upfront flat 3% fee with no hidden rate markup.

## Common Components of Transfer Costs
1. **Upfront Service Fee**: A flat charge or percentage fee deducted to process the transaction (ZettaRemit uses a flat 3% fee).
2. **Exchange Rate Spread**: The difference between the real wholesale exchange rate and the rate provided to the retail consumer.
3. **Intermediary Bank Fees**: In traditional SWIFT transfers, intermediary correspondent banks may deduct fees along the route, reducing the final amount the recipient receives.
