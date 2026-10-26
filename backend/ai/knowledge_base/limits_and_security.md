# Limits, Security, and Idempotency

## Transfer Limits & Validation
- **Supported Currency Corridor**: Strictly INR (Indian Rupee) to USD (United States Dollar).
- **Minimum Transaction Limit**: Transfers must be strictly greater than 0 INR (`gross_amount > 0`).
- **Maximum Transaction Limit**: The maximum permitted simulated transfer is **₹1,000,000.00 INR** (one million Indian Rupees) per transfer.
- **Precision Validation**: Amounts accept at most 2 decimal places. Non-finite values (`inf`, `NaN`) are strictly rejected.
- **Recipient Validation**: Recipient name must be 1 to 255 characters with valid printable characters.

## Idempotency & Duplicate Prevention
- **Idempotency-Key Header**: Every transfer creation request must include an `Idempotency-Key` HTTP header.
  - Key length: 16 to 128 characters.
  - Allowed characters: alphanumeric characters, underscores, and hyphens (`^[A-Za-z0-9_-]+$`).
- **Network Retry Safety**: If a network failure occurs and the client retries the transfer using the same idempotency key and identical payload, the backend safely returns the existing recorded transaction without re-execution or duplicate fees.
- **Conflict Handling (HTTP 409)**: If the client attempts to reuse an existing idempotency key with conflicting transfer amounts, recipient names, or tokens, the server rejects the request with HTTP 409 Conflict.

## Dual-Engine Math Verification
- **Redundant Architecture**: Both the Python FastAPI backend and the Java Spring Boot calculation engine independently compute the fee deduction, net amount, and USD payout.
- **Fail-Closed Safety**: If the Java calculation and Python calculation differ by even 1 cent, or if the internal calculation service is unavailable, the transaction fails closed with HTTP 503 Service Unavailable.

## Rate Limiting & Abuse Prevention
- **Registration**: 5 requests per 60 seconds per client IP.
- **Login**: 10 requests per 60 seconds per IP and per account.
- **Quotes**: 10 quote requests per 60 seconds per authenticated user.
- **HTTP 429 Responses**: When a rate limit is exceeded, the server returns HTTP 429 *"Too many requests; try again later"* with a `Retry-After: 60` header.
