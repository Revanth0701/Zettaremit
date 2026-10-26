# Fees, Exchange Rates, and Signed Quotes

## Fee Structure
- **Flat 3% Platform Fee**: ZettaRemit charges a flat 3% fee on the gross transfer amount in Indian Rupees (INR).
- **No Hidden Charges**: There are no additional transaction fees, membership fees, wire charges, or unexpected deductions.

## Mathematical Calculation Formulas and Rounding Method
All currency arithmetic is calculated using high-precision decimal numbers, rounded to 2 decimal places using the half-up rounding method (`ROUND_HALF_UP`):
1. **Fee Calculation**:
   $$\text{Fee (INR)} = \text{round}(\text{Gross Amount} \times 0.03, 2)$$
2. **Net Amount Calculation**:
   $$\text{Net Amount (INR)} = \text{Gross Amount} - \text{Fee}$$
3. **USD Recipient Payout Calculation**:
   $$\text{Payout (USD)} = \text{round}\left(\frac{\text{Net Amount}}{\text{Exchange Rate}}, 2\right)$$

### Calculation Examples
- **Example 1 (₹1,000 INR at rate 83.50)**:
  - Gross Amount: ₹1,000.00 INR
  - Fee (3%): ₹30.00 INR
  - Net Amount: ₹970.00 INR
  - Recipient gets: $11.62 USD
- **Example 2 (₹10,000 INR at rate 83.50)**:
  - Gross Amount: ₹10,000.00 INR
  - Fee (3%): ₹300.00 INR
  - Net Amount: ₹9,700.00 INR
  - Recipient gets: $116.17 USD
- **Example 3 (₹100,000 INR at rate 84.00)**:
  - Gross Amount: ₹100,000.00 INR
  - Fee (3%): ₹3,000.00 INR
  - Net Amount: ₹97,000.00 INR
  - Recipient gets: $1,154.76 USD

## Exchange Rate Provider & Freshness Rules
- **Live Provider**: Exchange rates are sourced from ExchangeRate-API Open Access (`https://open.er-api.com/v6/latest/USD`).
- **Precision**: Exchange rates are represented as high-precision decimals with 8 decimal places (`DECIMAL(18,8)`).
- **Daily Refresh Schedule**: The provider publishes updated daily reference rates once per day.
- **In-Memory Caching**: The backend caches the latest exchange rate snapshot in memory. Outbound provider requests are throttled to at most once per hour (3600 seconds) or when the provider's scheduled `next_update_at` has passed.
- **Overdue Schedule & Weekend Policy**: If provider updates are delayed due to weekends or international bank holidays, the last validated rate snapshot remains usable for up to **96 hours** (`MAX_AGE = 96 hours`) from observation time. Beyond 96 hours, rates fail closed as stale.
- **Attribution**: Every rate display includes a mandatory legal attribution backlink: *"Rates By Exchange Rate API"* linking to `https://www.exchangerate-api.com`.

## Signed Quotes & Expiration Rules
- **Cryptographic Quote Token**: When an authenticated user requests a quote (`POST /simulation/quote`), the Python backend queries the internal Java calculation engine. If both engines produce identical numbers, the server generates an HMAC-SHA256 signed JSON Web Token (JWT) with token type `zettaremit-quote+jwt`.
- **5-Minute Validity Window**: Every signed quote is strictly valid for **5 minutes** from the timestamp of issuance (`QUOTE_LIFETIME = 5 minutes`), or until the exchange rate validity deadline, whichever comes first.
- **Tamper Resistance**: The quote token cryptographically locks the owner ID, recipient name, gross amount, fee, net amount, USD payout, exchange rate, and expiration time. Any alteration invalidates the token.
- **Expiration Handling**: If a quote expires before the user proceeds, the application automatically requests a fresh quote and requires the user to review the updated amount before submitting.
- **Rate Limit**: Quote requests are limited to 10 requests per minute per user.
- **Official Quotes vs AI Assistant**: The AI assistant cannot generate cryptographically signed quotes, binding exchange rates, or live rate predictions. Official quotes and guaranteed USD payouts must always be obtained dynamically via the Send Money screen.
