# About ZettaRemit

## Platform Overview
ZettaRemit is an educational cross-border remittance simulation application. It demonstrates the technical architecture, mathematical precision, and security workflows required for international money transfers from India to the United States.

## Simulation-Only Limitations
- **No Real Money Movement**: ZettaRemit is strictly a software simulation. No real money, fiat currency, bank deposits, or actual financial assets are transferred, debited, or credited.
- **No Bank Account Debits**: No actual cash or real money ever leaves the user's Indian bank account, debit card, or UPI wallet.
- **Simulated Transaction Status**: Every transaction processed on the platform is assigned the status `SIMULATED`.
- **User Notice**: Every transfer confirmation returns the explicit message: *"Simulated transfer recorded; no funds moved"*.
- **No Banking Rail Connections**: ZettaRemit is not connected to live settlement systems, ACH rails, Fedwire, SWIFT settlement, or NEFT/RTGS/IMPS networks.

## Physical Offices, Contact Information, and Scope Boundaries
- **No Physical Office or Branches**: ZettaRemit is an open-source educational software simulation; it does not operate physical branch offices, walk-in customer service centers, or corporate headquarters.
- **No Customer Support Phone Number**: There is no customer support telephone number, hotline, or call center.
- **Digital and Codebase Only**: All documentation, architecture guides, and user assistance are provided strictly through this digital knowledge base and the open-source software repository.

## Technology Stack & Decoupled Architecture
1. **Frontend**: Built with React Native and Expo Web, deployed to Cloudflare Pages (`https://zettaremit-app.pages.dev`). Provides a clean, responsive web interface for desktop, laptop, and mobile devices.
2. **Backend API**: Built with Python FastAPI, hosted on Render (`https://zettaremit-app.onrender.com`). Manages user registration, JWT session issuance, rate limiting, quote coordination, and transaction recording.
3. **Calculation Service**: An internal Java Spring Boot microservice running on port 8082. Performs high-precision, deterministic financial calculations independently to verify transfer arithmetic before any quote or transaction is finalized.
4. **Database**: Managed Aiven MySQL database storing user records, KYC profiles, and transaction logs. Local development supports an isolated SQLite database.

## Core Capabilities
- Self-service user registration and authentication.
- Real-time exchange rate retrieval from a live market reference rate provider.
- Cryptographically signed exchange quotes valid for 5 minutes.
- Transfer creation with client-side idempotency protection.
- Chronological simulated transaction history review.
