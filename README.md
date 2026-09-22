<div align="center">

# WHOOSH

### Group payments, settled together.

**A V1 sandbox for simulating shared purchases, group authorization, and automatic settlement.**

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white) ![Status](https://img.shields.io/badge/status-V1%20prototype-8B5CF6)

<br />

<img src="docs/images/whoosh-sandbox-demo.png" alt="WHOOSH sandbox interface" width="900" />

</div>

<br />

> **No real money moves here.** WHOOSH uses fictional members and simulated CAD balances to explore what it could look like if shared expenses were handled as part of the purchase itself—not reconciled afterward.

## The idea

Someone fronts dinner. Four people share it. Usually, the group spends the next few days chasing transfers and doing mental math.

WHOOSH models a different flow: capture the group at authorization, split responsibility immediately, record the purchase in a ledger, and create the settlement obligations automatically.

```text
  $200 Uber Eats order

  Sarah pays ──► WHOOSH authorizes & records ──► Each participant owes their share
                                                      │
                                                      ▼
                                          Pending settlements are processed
```

## What’s in V1

| | Feature | What it does |
|:--:|---|---|
| 👥 | **Private demo group** | Starts each browser with four fictional members and funded simulated wallets. |
| 🧾 | **Group purchase flow** | Choose a merchant, amount, participants, and the member paying up front. |
| ➗ | **Equal splits** | Calculates an even split, including accurate cent-level rounding. |
| ✓ | **Authorization simulation** | Validates the payer’s balance before recording the purchase. |
| 📒 | **Double-entry ledger** | Records successful purchases and settlements as balanced journal entries. |
| ↔ | **Automatic obligations** | Creates a pending settlement from each participant to the payer. |
| ⚡ | **Settlement simulations** | Process a successful payment—or test forced failures and insufficient funds. |
| 🔎 | **Inspectable sandbox** | View API payloads, balance changes, activity, and the settlement queue as you go. |
| ↻ | **Fresh reset** | Start over with a new isolated demo group anytime. |

## A purchase in WHOOSH

```text
  1. Pick the group        2. Authorize the purchase       3. Settle obligations

  Sarah, Jordan, Maya      Payer wallet is debited          Each participant pays
  & Alex split $200        for the full $200                their $50 share to Sarah
```

The current V1 deliberately focuses on **equal splits** and the underlying accounting flow. That keeps the sandbox small enough to make the payment model easy to inspect.

## Built with

| Frontend | Backend | Data |
|---|---|---|
| React · TypeScript · Vite | Express · Zod | PostgreSQL · Drizzle ORM |

The repository is a small monorepo: `apps/web` contains the interface, `apps/api` contains the API and ledger logic, and `packages/shared` holds shared domain and money utilities.

## Run it locally

**You’ll need:** Node.js 22+ and PostgreSQL—or Docker for the included local database.

```bash
npm install
Copy-Item .env.example .env
docker compose up -d postgres
npm run db:migrate
npm run dev
```

Then open **http://localhost:5173**. The API runs at **http://localhost:3000**.

Add this connection string to `.env` when using the included Docker database:

```text
DATABASE_URL=postgres://whoosh:whoosh@localhost:5432/whoosh
```

<details>
<summary><strong>Useful commands</strong></summary>

<br />

```bash
npm run typecheck
npm run build
npm run db:migrate
npm run dev:api
npm run dev:web
npm run test --workspace=@whoosh/api
```

</details>

## What V1 is not

WHOOSH is a product concept and developer sandbox, not a payment service. It does not have user accounts, identity verification, card or bank connections, real payment rails, notifications, or production money movement. A browser-local demo-group ID keeps sandbox sessions separate; it is not an authorization system.

## Deploy

WHOOSH deploys as one Vercel project: the web app calls same-origin `/api/*`, which Vercel routes to the Express handler. PostgreSQL is the only external dependency; Neon Postgres is a good fit.

1. Create a Neon project and copy its pooled and direct connection strings.
2. Import this repository into Vercel, using the repository root as the project root.
3. Set `DATABASE_URL` to the pooled string and `DATABASE_URL_UNPOOLED` to the direct string.
4. Deploy, then check `/api/health`.

For a split frontend/API deployment, configure `CORS_ORIGIN` and `VITE_API_URL`. Keep database URLs server-side—never put one in a `VITE_` variable.

---

<div align="center">

Built as an exploration of a more native way to handle shared expenses.

</div>
