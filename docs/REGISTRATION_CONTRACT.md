# Registration response contract

This local fix addresses the registration implementation in deployed commit
`78b2df3d9514f145c5ee48fb9e6f8a7bec4d24a8`. The old handler returned 201 for a
committed account, an existing email, and an IntegrityError rollback; the frontend
incorrectly treated all three as account creation.

- `POST /users/register` returns **201** with `{"status":"created","message":"Account created. Please sign in."}` only after the User and simulated UserVerification records commit in one transaction. No real KYC is performed. The response exposes no IDs, hashes, or tokens.
- An existing normalized email returns **409** with `{"detail":"This email is already registered. Please sign in or reset your password."}`. It never changes an existing password, profile, or verification record.
- On IntegrityError, rollback occurs first. A committed record with the same email confirms a duplicate conflict (including concurrent registration). Other integrity failures return **500** with a generic retry message. If rollback or the conflict lookup fails, the public result remains a generic 500.
- Unexpected persistence failures roll back and return the same generic 500. No exception text, SQL, credentials, or hashes are logged or returned by this handler. The successful handler no longer performs an unnecessary post-commit refresh.
- The client requires both HTTP 201 and `status: "created"`. Generic legacy 201, 200, and 202 responses cannot show Account Created. A 409 displays an inline error and a Sign in action; 5xx responses, including non-JSON gateway failures, display a retry message. Failed attempts retain form values in component memory.

## Duplicate-email and enumeration decision

An explicit 409 is chosen for the requested normal interactive signup flow.
This deliberately reveals whether an email is registered, unlike the previous
generic response. The message reveals no account metadata or credentials. The
existing per-process registration limit of five attempts per source address per
60 seconds remains unchanged; it mitigates but does not eliminate enumeration,
particularly distributed attempts. No passwords are reset by signup. This change
does not implement a password-reset endpoint; it retains the existing sign-in
screen and its existing controls.

## Validation and release boundaries

Focused backend regressions use disposable in-memory SQLite and forbid MySQL
connections. Browser regressions forward only allowed local auth/history requests
to a loopback test fixture backed by disposable SQLite; external requests are
blocked. No production accounts or financial operations are used.

The original affected production account, runtime database identity, production
schema/constraints, and the exact failed-registration branch remain unverified.
SQLite checks do not replace validation of deployed MySQL constraints. This fix
has not been committed, pushed, or deployed. Backend and frontend must be released
together: the frontend intentionally rejects the old ambiguous 201 response.
