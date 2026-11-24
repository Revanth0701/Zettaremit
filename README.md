# ZettaRemit — Educational Cross-Border Remittance Simulation

## Current unified release candidate

Current TiDB release instructions, exact configuration and approval gates are in
[the Render runbook](docs/RENDER_RUNBOOK.md), [migration review](docs/TIDB_MIGRATION.md)
and [dependency security review](docs/DEPENDENCY_SECURITY_REVIEW.md). The canonical
frontend is https://zettaremit.pages.dev/; the older project remains unchanged.
The isolated candidate preserves the upstream application and README, with no
commit, push or deployment authorized. Historical test counts below are dated evidence.

The local integration candidate also includes registration reliability and signup/navigation
updates. See [registration response contract](docs/REGISTRATION_CONTRACT.md) and
[local reconciliation evidence](docs/GIT_RECONCILIATION.md). These changes are not deployed.

The canonical source for the entire application is **Revanth0701/Zettaremit**.
The current candidate adds Gemini Hybrid RAG (BM25F + optional semantic retrieval + RRF),
owner-scoped agent tools, paginated transaction history with independent total/page counts,
and authenticated streaming. AI and hosted embeddings are explicit opt-ins. Historical
architecture descriptions below do not establish production deployment or API availability.

See [repository migration plan](docs/REPOSITORY_UNIFICATION_PLAN.md),
[AI implementation](docs/AI_UPGRADE.md), and
[production readiness gates](docs/PRODUCTION_DEPLOYMENT_READINESS.md).
Production schema, backups/restoration, model quotas, remaining build-tool findings and
memory headroom require verification before deployment. No automated database migration,
real payment, or support-ticket submission is provided. Source consolidation does not
move accounts or transaction data. Use `python -B tools/test_ai_offline.py` for safe
offline backend tests while local hosted AI is enabled. Prior verified tests: backend
191, frontend 104, Java 10; these are release evidence, not a claim of new test execution.


[![Live Demo](https://img.shields.io/badge/Live%20Demo-zettaremit.pages.dev-0047AB?style=for-the-badge&logo=cloudflarepages&logoColor=white)](https://zettaremit.pages.dev)
[![Frontend](https://img.shields.io/badge/Frontend-React%20Native%20%2F%20Expo%20Web-4630EB?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev)
[![Backend](https://img.shields.io/badge/Backend-FastAPI%20%2F%20Python%203.12-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Microservice](https://img.shields.io/badge/Microservice-Java%2021%20%2F%20Spring%20Boot%203.5-6DB33F?style=for-the-badge&logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
[![Database](https://img.shields.io/badge/Database-TiDB%20Cloud-4479A1?style=for-the-badge&logo=mysql&logoColor=white)](https://www.pingcap.com/tidb-cloud/)
[![AI Assistant](https://img.shields.io/badge/AI%20Assistant-BM25%20RAG%20%2B%20Gemini-FF6F00?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev)

> **Educational Simulation Notice:** ZettaRemit is a full-stack software engineering portfolio project demonstrating distributed system design, secure transaction processing, and low-latency AI retrieval for an Indian Rupee (INR) to US Dollar (USD) remittance workflow. It does not move fiat currency, integrate with central banking rails, or ingest real government identity documents.

---

## 1. Project Overview & Key Features

ZettaRemit showcases an enterprise-grade, polyglot software architecture designed to model the end-to-end lifecycle of cross-border financial clearings. The application emphasizes clean separation of concerns, defensive security practices, financial arithmetic precision, and high-performance in-memory search on resource-constrained cloud infrastructure.

### Key Capabilities

* **Multi-Tiered Exchange Rate Resiliency:** Features an automated 3-tier fallback architecture (Primary live exchange rate API → Secondary direct public gateway → validated cached snapshot (up to 96 hours)) ensuring best-effort availability for rate previews even during cloud cold starts.
* **Cryptographically Signed Transfer Quotes:** Prevents client-side price tampering by issuing HMAC-SHA256 signatures with 5-minute time-to-live (TTL) timestamps for every exchange rate quote.
* **Idempotent Transaction Pipeline:** Client-generated idempotency keys (`Idempotency-Key` HTTP header) enforced by database unique constraints guarantee at-most-once transfer execution across network retries.
* **Render Free Cold-Start Readiness Polling:** The client implements an exponential-backoff health check (`GET /health`) before login submission, displaying progressive connection states ("*Connecting to ZettaRemit...*", "*This may take a moment.*") and avoiding false-positive network timeout errors.
* **Lightweight In-Memory BM25F RAG Assistant:** An AI customer support assistant powered by a pure-Python in-memory BM25F retrieval engine and remote Gemini LLM inference (`gemini-3.1-flash-lite`), avoiding PyTorch and heavy vector DB dependencies; 512 MiB production headroom still requires validation.
* **Zero-PII Educational KYC Simulation:** Multi-step onboarding with educational identity verification badges, avoiding the storage or transmission of real personal identification data.

---

## 2. System Architecture

The system follows a polyglot microservice model separating user-facing routing, core ledger persistence, transaction calculations, and AI knowledge retrieval:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        CLIENT / WEB BROWSER                            │
│                 React Native / Expo Web Application                    │
│                  Hosted on Cloudflare Pages CDN                        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS (Strict TLS / CORS)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     RENDER FREE CONTAINER (512 MB)                     │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    FASTAPI GATEWAY (Python 3.12)                 │  │
│  │  • JWT Auth & Bcrypt (15-min TTL)   • In-Memory Rate Limiting    │  │
│  │  • HMAC-SHA256 Quote Signing        • Cold-Start Health Probes   │  │
│  │  • Server-Sent Events (SSE) Stream  • In-Memory BM25F Retriever  │  │
│  └──────────────────┬───────────────────────────────┬───────────────┘  │
│                     │                               │                  │
│                     │ Loopback HTTP (127.0.0.1:8082)│ Remote HTTPS     │
│                     │ Shared Secret Bearer Auth     │ TLS v1.3         │
│                     ▼                               ▼                  │
│  ┌─────────────────────────────────────┐  ┌─────────────────────────┐  │
│  │    TRANSACTION SERVICE (Java 21)    │  │   GEMINI CLOUD LLM      │  │
│  │  • Spring Boot 3.5.16 Microservice  │  │   Inference API         │  │
│  │  • Exact BigDecimal Math            │  │   Model: gemini-3.1-flash-lite     │  │
│  │  • Internal Loopback Only           │  │   (Remote AI execution) │  │
│  └─────────────────────────────────────┘  └─────────────────────────┘  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Encrypted MySQL Protocol (TLS required)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      TIDB CLOUD MYSQL-COMPATIBLE DATABASE                      │
│       • Enforced SSL/TLS with CA Certificate Verification              │
│       • Users, Verified Profiles, and Signed Ledger Tables             │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack Breakdown

| Layer | Technologies | Primary Responsibilities |
| :--- | :--- | :--- |
| **Frontend** | React Native `0.81`, Expo Web `~54`, React Navigation `v7` | Responsive mobile & desktop interface, rate ticker, cold-start readiness polling, AI streaming. |
| **API Gateway** | Python `3.12`, FastAPI `0.161`, Pydantic `v2`, SQLAlchemy `2.x` | REST routing, JWT authentication, quote signing, rate limiting, and RAG orchestration. |
| **Transaction Service** | Java `21`, Spring Boot `3.5.16`, Gradle `8.x`, Groovy Spock | Isolated internal microservice performing high-precision financial arithmetic. |
| **Database** | TiDB Cloud (MySQL protocol), PyMySQL with SSL verification | ACID ledger storage, unique idempotency constraints, relational integrity. |
| **AI Subsystem** | Custom BM25F Retriever, Gemini (`gemini-3.1-flash-lite`), SSE | Document chunking, title-boosted term retrieval, streaming responses; production memory headroom remains a release gate. |
| **Infrastructure** | Cloudflare Pages, Render Docker Web Service, Multi-stage Docker | Global edge frontend deployment and co-hosted containerized microservices. |

---

## 4. Subsystem Deep Dives

### A. React Native & Expo Web Frontend (`frontend/`)

* **Responsive Hybrid Layout:** Adapts seamlessly between desktop workstations (dual-column split layout with `#001E62` navy branding) and mobile viewports (collapsible bottom navigation, optimized touch targets).
* **Cold-Start Resilience Workflow (`frontend/lib/readiness.js`):** Render Free spins down after 15 minutes of inactivity. When a user submits credentials, the client immediately checks `GET /health` with a 6-second timeout and 2-second polling intervals. Once healthy, it dispatches the authentication request **exactly once**, preventing duplicate requests or gateway timeouts (`504 Gateway Timeout`).
* **Interactive AI Assistant (`frontend/screens/AIAssistantScreen.js`):** Built-in chat interface connecting to `/ai/ask-stream` with chunk-by-chunk Server-Sent Event (SSE) rendering, multi-turn conversation memory, suggested topic pills, and prominent simulation disclosures.

### B. Python FastAPI Gateway (`backend/`)

* **Pydantic Validation:** All request and response models strictly forbid undocumented fields (`extra="forbid"`) to prevent parameter injection.
* **Cryptographic Quote Protocol (`backend/quotes.py`):**
  $$\text{Signature} = \text{HMAC-SHA256}_{K_{\text{internal}}}\left(\text{gross\_inr} \parallel \text{net\_inr} \parallel \text{receive\_usd} \parallel \text{rate} \parallel \text{expiry}\right)$$
  When a transfer is initiated, the server re-computes the HMAC digest and checks timestamp expiration ($T \le 300\text{s}$) before accepting the transaction.
* **Rate Limiting Engine (`backend/rate_limit.py`):** In-memory sliding-window limiter enforcing per-IP and per-token request ceilings across sensitive endpoints (`/users/login`, `/users/register`, `/ai/ask`).

### C. Java Spring Boot Microservice (`services/transaction-service/`)

* **Financial Arithmetic Standard:** Built with Java 21 using `java.math.BigDecimal` and `RoundingMode.HALF_UP` to prevent binary floating-point rounding errors common in currency conversions.
* **Network Isolation:** Listens strictly on `127.0.0.1:8082` inside the Docker container. Does not expose a public port or route.
* **Internal Authentication Filter (`InternalAuthenticationFilter.java`):** Validates a 256-bit cryptographically secure token (`INTERNAL_SERVICE_TOKEN`) on every request. Rejects unauthorized or external access with sanitized HTTP 401/403 responses.

### D. Lightweight BM25 RAG Architecture (`backend/ai/`)

* **The Problem:** Hosting deep learning embedding models (e.g. PyTorch, Sentence Transformers) and local vector stores (ChromaDB) alongside FastAPI and Java exceeds the 512 MB memory limit of free cloud hosting, and require independent resource validation; do not assume sufficient memory headroom.
* **The Solution:** A lightweight, pure-Python BM25F (Best Matching 25 with Field Weighting) retrieval engine:
  * Indexes 8 structured Markdown knowledge base files at startup (~2 ms).
  * Computes BM25 relevance scores with configurable field boosting ($3.0\times$ title boost, keyword prioritization).
  * Consumes **< 2 MB of RAM**, leaving ample headroom for Python and Java processes.
* **Gemini LLM Integration (`backend/ai/gemini_client.py`):** Offloads inference to Gemini running `gemini-3.1-flash-lite`, delivering ~1.0s inference latency while keeping local container RSS around ~295 MB.

---

## 5. Security & Defensive Engineering Standards

| Risk Area | Applied Mitigation | Source Verification |
| :--- | :--- | :--- |
| **Credential Storage** | Passwords hashed using Bcrypt with per-user salt; maximum 72-byte truncation check enforced. | [`backend/main.py`](backend/main.py) |
| **Token Hijacking** | Short-lived JSON Web Tokens (15-minute lifespan / 900s) signed with HS256. | [`backend/auth.py`](backend/auth.py) |
| **Replay Attacks** | Idempotency keys required on transfer creation; duplicate keys return identical transaction records without double-executing. | [`backend/main.py`](backend/main.py) |
| **Price Tampering** | Server-signed HMAC-SHA256 quotes; frontend cannot modify fees, payout amounts, or exchange rates. | [`backend/quotes.py`](backend/quotes.py) |
| **Microservice Boundary** | Java service bound to loopback `127.0.0.1`; internal token authentication filter required. | [`TransactionController.java`](services/transaction-service/src/main/java/com/zettaremit/transaction/controller/TransactionController.java) |
| **Database Encryption** | Mandatory SSL/TLS connection (`ssl.CERT_REQUIRED`) with CA certificate hostname verification. | [`backend/database_config.py`](backend/database_config.py) |
| **Prompt Injection** | Strict prompt sanitization, context boundary isolation, and explicit system guardrails prohibiting out-of-domain financial advice. | [`backend/ai/rag_service.py`](backend/ai/rag_service.py) |

---

## 6. Repository Structure

```text
ZettaRemit/
├── .dockerignore                           # Strict Docker build context exclusions
├── .gitignore                              # Clean exclusions for secrets, DBs, and build outputs
├── Dockerfile                              # Multi-stage build (Java Gradle build + Python runtime)
├── README.md                               # Recruiter and engineering documentation
├── render.yaml                             # Infrastructure-as-code blueprint for Render
├── backend/
│   ├── .env.example                        # Template environment variables (no secrets)
│   ├── main.py                             # FastAPI entrypoint, middleware, routes
│   ├── auth.py                             # JWT token generation and validation
│   ├── quotes.py                           # HMAC quote creation and verification
│   ├── money.py                            # Fee rules, calculations, and data models
│   ├── exchange_rates.py                   # Multi-tier exchange rate provider with TTL cache
│   ├── database_config.py                  # MySQL / SQLite connection factory with SSL
│   ├── rate_limit.py                       # In-memory sliding-window rate limiter
│   ├── migrations/                         # Reviewed relational SQL migrations
│   ├── ai/
│   │   ├── lightweight_retriever.py        # Pure-Python in-memory BM25F retriever
│   │   ├── gemini_client.py                # Async Gemini API client (streaming SSE)
│   │   ├── rag_service.py                  # RAG context builder and prompt orchestration
│   │   ├── router.py                       # AI API endpoints (/ai/ask, /ai/ask-stream, /ai/health)
│   │   └── knowledge_base/                 # 8 curated domain knowledge Markdown docs
│   └── test_*_offline.py                   # 122 automated backend offline unit & security tests
├── frontend/
│   ├── .env.example                        # Public frontend configuration template
│   ├── App.js                              # Navigation container & route definitions
│   ├── index.js                            # Web & native application entrypoint
│   ├── components/                         # Modular UI cards, calculators, and rate tickers
│   ├── screens/                            # DashboardScreen, LoginScreen, AIAssistantScreen, etc.
│   ├── lib/                                # API client, readiness polling, quote flow
│   └── tests/                              # 104 automated offline Node.js test suites
├── services/
│   └── transaction-service/                # Java Spring Boot 3.5 calculation microservice
│       ├── build.gradle                    # Gradle build definition
│       └── src/main/java/                  # Spring Boot application, controllers, filters
└── tools/                                  # Local development orchestration scripts
```

---

## 7. Local Development Setup

### Prerequisites

* **Node.js** `v20+` or `v22+` and `npm`
* **Python** `3.10+` or `3.12+`
* **Java Development Kit (JDK)** `21`
* **Git**

### 1. Clone the Repository

```bash
git clone https://github.com/Revanth0701/Zettaremit.git
cd Zettaremit
```

### 2. Frontend Setup (Expo Web)

```bash
cd frontend
npm ci
npm test             # Runs all 104 automated unit & integration tests
npm run web          # Starts Expo Web development server on http://localhost:8081
```

### 3. Backend Setup (FastAPI)

```bash
cd ../backend
python -m venv .venv
source .venv/bin/activate       # On Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Create local environment file from template
cp .env.example .env

# Generate secure random local signing secrets
python ../tools/configure_local_secrets.py  # local development only; preserve valid secrets

# Run offline unit test suite (191 tests)
python -B ../tools/test_ai_offline.py

# Start the FastAPI server on port 8000
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

### 4. Java Transaction Microservice Setup

```bash
cd ../services/transaction-service
./gradlew test        # Runs Groovy Spock specs and JUnit 5 snapshot tests
./gradlew bootRun     # Starts internal service on http://127.0.0.1:8082
```

---

## 8. Verification & Testing

Every layer of the application is covered by comprehensive offline automated tests that do not depend on external networks or live databases:

```bash
# 1. Run all Frontend Test Suites (104 tests)
npm --prefix frontend test

# 2. Run all Backend Test Suites (191 tests)
python -B tools/test_ai_offline.py

# 3. Verify Production Web Bundle Export
npm --prefix frontend run build:web
```

### Test Coverage Highlights

* **Frontend:** Cold-start readiness polling, 3-tier exchange rate fallback, HMAC quote acceptance, session token lifecycle, 401 auto-logout, PII input elimination, AI streaming response parsing.
* **Backend:** JWT authentication, bcrypt validation, quote signature verification, sliding-window rate limiting, MySQL SSL enforcement, BM25 retrieval accuracy, prompt injection defense.
* **Microservice:** `BigDecimal` exchange calculations, Groovy Spock data tables, loopback authentication filter validation, exchange rate vector snapshot comparisons.

---

## 9. Deployment Architecture

* **Frontend:** Deployed to **Cloudflare Pages**, serving static HTML/JS bundles globally via edge CDN with automated caching headers and sub-second asset distribution.
* **Backend:** Deployed as a single multi-stage Docker container on **Render Free Web Service**, executing both the FastAPI gateway (Python) and the transaction service (Java 21) within a shared Linux environment.
* **Database:** Hosted on **TiDB Cloud** with strict TLS/SSL certificate verification.
* **AI Subsystem:** Hybrid setup combining in-process BM25F document retrieval with remote Gemini inference.

---

## 10. Educational Disclaimer & License

ZettaRemit was created strictly as an educational software engineering project to demonstrate distributed microservice architecture, cryptographic security protocols, and memory-efficient retrieval-augmented generation. It is not licensed or authorized for commercial money transmission, banking activities, or financial advisory services.

All rights reserved © 2026 Revanth N R.
