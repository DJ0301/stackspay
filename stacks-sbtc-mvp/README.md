# StacksPay — sBTC Payment Gateway (MVP)

StacksPay is an MVP Bitcoin payment gateway built on the Stacks blockchain using sBTC. It includes:

- Backend API (Express, MongoDB) for payment creation, confirmation, webhooks, price feed, and a docs-driven chatbot.
- Frontend (React + Vite) for merchant dashboard and embeddable payment experiences.
- Clarity smart contract `sbtc-payment-gateway` with tests and deployment plans.
- Documentation for API and Widget integration in `docs/`.


## Repository Structure

- `backend/` — Express API exported for serverless (Vercel) or Node server.
- `frontend/` — React + Vite app (ready for Vercel static build).
- `contracts/` — Clarity contract(s).
- `deployments/` — Clarinet deployment plans for simnet and testnet.
- `settings/Devnet.toml` — Devnet config with funded accounts for local dev.
- `tests/` — Contract tests using `vitest-environment-clarinet`.
- `docs/` — API reference and widget integration guide.


## Prerequisites

- Node.js 18+
- npm 9+
- MongoDB (Atlas or local)
- Clarinet (for contract dev/testing): https://docs.hiro.so/clarinet


## Environment Variables

### Backend (`backend/.env`)
Key variables used in `backend/server.js`:

- `NETWORK` — `testnet` or `mainnet` (default `testnet`)
- `PORT` — Backend port (default `3001`)
- `CONTRACT_ADDRESS` — Deployed contract address
- `CONTRACT_NAME` — Contract name (e.g., `sbtc-payment-gateway-new`)
- `MERCHANT_ADDRESS` — Default merchant payout address (can be overridden per request)
- `JWT_SECRET` — Secret for merchant auth tokens
- `WEBHOOK_SECRET` — Secret for signing outbound webhooks
- `MONGODB_URI` — Mongo connection string
- `FRONTEND_URL` — Used for CORS/links
- `GROQ_API_KEY` — Optional, powers the chatbot endpoint `/api/chat`

Security note: never commit secrets to version control. Use local `.env` files and Vercel/hosted environment variables.

### Frontend (`frontend/.env` or `.env.local`)
See `frontend/.env.example`:

- `VITE_API_URL` — Base URL of the backend API (e.g., `http://localhost:3001` or your deployed backend)
- `VITE_WIDGET_BASE_URL` — Optional custom widget base URL


## Backend: Run Locally

From the repo root:

```bash
# Install root dev deps (tests etc.)
npm install

# Install backend deps
npm install --prefix backend

# Create and configure backend/.env (copy example values if needed)
cp backend/.env backend/.env.local  # optional convention; server.js reads .env by default

# Start the backend locally
node backend/server.js
# Backend listens on PORT (default 3001) and serves routes under /api/*
```

Notable endpoints (see `docs/API_DOCUMENTATION.md` for full details):

- `GET /api/health` — health + network/contract info
- `GET /api/widget/config` — config for embeddable widget
- `POST /api/payments/create` — create payment in sBTC or USD
- `POST /api/mock-webhooks/send` — send mock webhook to a URL with signature
- `POST /api/chat` — chatbot backed by GROQ when `GROQ_API_KEY` is set

The Express app is exported in `backend/api/[[...all]].js` for Vercel serverless routing (`/api/*`).


## Frontend: Run Locally

```bash
# Install frontend deps
npm install --prefix frontend

# Configure environment
cp frontend/.env.example frontend/.env
# Edit VITE_API_URL to your local or deployed backend

# Start the dev server (Vite)
npm run --prefix frontend dev
# App will run at http://localhost:5173/ (default Vite port)
```

Vercel config for the frontend is in `frontend/vercel.json` (static build with `vite build`).


## Smart Contracts

- Contract: `contracts/sbtc-payment-gateway.clar`
- Clarinet project: `Clarinet.toml`
- Simnet and Testnet deployment plans in `deployments/`.

Read-only helpers exposed by the contract include:

- `get-payment` — query recorded payments.
- `get-sbtc-balance` — balance for a principal.
- `get-merchant` — current merchant principal.

Public entrypoints:

- `pay` — pay legacy default merchant.
- `pay-to` — pay a provided merchant principal (multi-merchant support).
- `withdraw`, `set-merchant`, `debug-transfer` — admin/diagnostic.


## Contract Testing

The repository uses `vitest` with `vitest-environment-clarinet` for contract tests.

```bash
# From repo root
npm install
npm run test         # runs vitest once
npm run test:watch   # watches tests and contracts, runs coverage
```

Example test: `tests/sbtc-payment-gateway.test.ts`.


## Deployment

### Frontend (Vercel)

- `frontend/vercel.json` is configured for Vite static builds.
- Build command: `npm run build`
- Output directory: `dist`
- SPA routing to `index.html`

### Backend (Vercel or Node server)

- The backend is compatible with Vercel serverless via `backend/api/[[...all]].js` which re-exports the Express app.
- On Vercel, set required environment variables in the project settings.
- Alternatively, run as a standalone Node server: `node backend/server.js` on your infrastructure.

### Contracts

- Use Clarinet to simulate and iterate locally.
- For testnet deployment, see `deployments/default.testnet-plan.yaml` and adjust addresses/costs as needed.


## Webhooks

Webhooks are signed with `X-Webhook-Signature` (HMAC-SHA256 using `WEBHOOK_SECRET`).

- Test quickly using the local echo endpoint: `POST /api/echo`.
- Send a mock event to any URL: `POST /api/mock-webhooks/send` with `{ url, event, payload?, secret? }`.

Verify signatures on your server before trusting events.


## Documentation

- API Reference: `docs/API_DOCUMENTATION.md`
- Widget Integration Guide: `docs/WIDGET_INTEGRATION_GUIDE.md`


## Notes & Tips

- The backend disables HTTP caching to avoid 304s during frontend polling loops.
- BTC price is fetched from multiple sources and median-filtered with a short cache.
- Amounts submitted as `amountUSD` are converted to sBTC using the current price feed; primary stored currency is sBTC.
- Payments created via payment links or product checkouts can augment related entities (usage counts, customer stats) when confirmed.


## License

This project is open-sourced for demonstration purposes. See individual files for headers or adapt to your licensing needs.
