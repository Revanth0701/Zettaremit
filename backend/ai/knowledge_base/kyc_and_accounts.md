# User Accounts, KYC, and Authentication

## User Registration Requirements
To create a ZettaRemit account, users submit the registration form:
- **Full Name**: Required. Must be 1 to 100 characters, trimmed of whitespace, and contain valid printable characters.
- **Email Address**: Required. Must be a valid email format, max 150 characters, normalized to lowercase, and unique across the system.
- **Password**: Required. Must be at least 12 characters long. Due to bcrypt hashing constraints, passwords cannot exceed 72 bytes. Passwords are securely hashed with bcrypt using unique salts.
- **Phone Number**: Optional. Maximum 20 characters; must be unique across accounts if provided.
- **Rate Limit**: Registration is restricted to 5 attempts per minute per IP address.

## Identity Verification (KYC)
- **Automatic KYC Record**: Registration automatically creates a linked `UserVerification` record.
- **Document Information**:
  - `document_type`: Optional at registration (e.g., Passport, Driver's License, National ID). Defaults to `"NONE"` if omitted. Maximum 50 characters.
  - `document_number`: Optional document identification number. Maximum 100 characters.
- **Verification Status**: Initial KYC status is automatically marked as **`PENDING`**.
- **Verification ID**: Formatted with a unique prefix: `KYC-[UUID]`.

## Authentication & Session Management
- **Sign In**: Users log in via `POST /users/login` with their registered email and password.
- **Timing Equalizer**: Password verification uses constant-time bcrypt checks to protect against timing attacks.
- **Access Tokens**: Successful login issues a signed JSON Web Token (JWT) bearer access token valid for **15 minutes** (900 seconds).
- **Personalized Greeting**: Upon login, the backend returns the user's registered full name. The frontend stores this in session storage to display a personalized greeting on the dashboard.
- **Sign Out**: Logging out immediately clears session storage and redirects the user to the welcome screen.
