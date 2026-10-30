# Troubleshooting and Error Codes

## Common Error Codes and Resolution Guide

### HTTP 401 Unauthorized
- **"Invalid email or password"**:
  - *Cause*: The supplied email or password does not match any registered account.
  - *Solution*: Verify typing, ensure password has at least 12 characters, or register a new account.
- **"Invalid or missing access token"**:
  - *Cause*: The user's JWT access token is missing, expired (valid for 15 minutes), or invalid.
  - *Solution*: Sign in again to obtain a fresh session token.

### HTTP 403 Forbidden
- **"Transaction ownership mismatch"**:
  - *Cause*: Attempting to create or view a transaction under another user's account ID.
  - *Solution*: Ensure the request matches the authenticated user ID.

### HTTP 409 Conflict
- **"Idempotency key was already used for a different request"**:
  - *Cause*: The client reused an existing idempotency key with different transaction amounts or recipient details.
  - *Solution*: When starting a brand new transfer with new details, generate a new unique idempotency key.
- **"Unable to record simulated transfer"**:
  - *Cause*: Database concurrency or duplicate transaction conflict.
  - *Solution*: Retry using the original idempotency key.

### HTTP 422 Unprocessable Entity
- **"Invalid or expired simulation quote; request a new quote"**:
  - *Cause*: The signed quote exceeded its 5-minute validity window or values were altered.
  - *Solution*: The client UI will automatically re-fetch a quote. Review the updated summary and click Proceed.
- **"A server-issued accepted quote is required"**:
  - *Cause*: Attempted to submit a transfer without attaching a valid quote token.
  - *Solution*: Allow the quote calculation to finish on the Send Money screen before proceeding.
- **Amount Validation Errors**:
  - *Cause*: Entering an amount less than or equal to 0 INR, or exceeding the maximum limit of ₹1,000,000.00 INR.
  - *Solution*: Adjust the gross INR amount to be within the valid range (₹0.01 to ₹1,000,000.00).

### HTTP 429 Too Many Requests
- **"Too many requests; try again later"**:
  - *Cause*: Rate limit exceeded (more than 5 registrations/min, 10 logins/min, or 10 quotes/min).
  - *Solution*: Wait 60 seconds (as specified in the `Retry-After: 60` response header) before retrying.

### HTTP 503 Service Unavailable
- **"Simulation quote unavailable; please try again later"**:
  - *Cause*: The exchange rate provider is unreachable, or the internal Java calculation service is unavailable.
  - *Solution*: Check server status and retry in a few moments.
- **"Simulation service unavailable; retry with the same idempotency key"**:
  - *Cause*: The Java calculation service timed out during final transfer confirmation.
  - *Solution*: Retry the submission using the exact same idempotency key to prevent double execution.
