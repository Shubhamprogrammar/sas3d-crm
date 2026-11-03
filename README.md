# SAS3D CRM

The internal CRM and business management system for [SAS3D](https://sas3d.in). It covers the whole client lifecycle: capturing a lead, working the sales pipeline, sending proposals, delivering projects, invoicing, recording payments and reporting. It supports Indian and international clients in seven currencies.

## Features

| Area | What it does |
|---|---|
| Leads | CRUD, archive, search, filters, sorting, CSV import and export, duplicate warnings, conversion to client |
| Pipeline | Kanban with drag and drop, stage history, lost reasons, per-currency stage totals, win rate, conversion to client and project |
| Clients | Profiles with overview, projects, proposals, invoices, payments, communication, activity and documents tabs |
| Tasks | List and calendar views, today, upcoming and overdue, server-side reminders |
| Communication | Timeline of emails, calls, WhatsApp, meetings, LinkedIn messages and notes, logged manually |
| Proposals | Line items, discounts, tax, revisions, duplication, branded PDF, status tracking |
| Projects | Milestones, tasks and subtasks, team, updates, client feedback, files, progress computed from real work |
| Invoices | Draft, issue, cancel, PDF, partial and multiple payments, voiding, automatic overdue detection |
| Reports | Sales, finance, projects and team, with date filters and CSV export |
| Platform | Six roles, record-level access control, notifications, global search, settings, audit log, dark theme |

## Technology

- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS, TanStack Query, React Hook Form, Zod, Recharts, Lucide
- **Backend:** Node.js, Express, TypeScript, Mongoose, Zod, Better Auth, PDFKit, Pino
- **Database:** MongoDB, run as a replica set because the app uses transactions
- **Testing:** Vitest, Supertest, mongodb-memory-server, Playwright

Architecture details are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Folder structure

```
sas3d-crm/
├── backend/
│   ├── src/
│   │   ├── config/       env, auth, permissions, constants
│   │   ├── database/     connection, seeds, schema helpers
│   │   ├── middleware/   authentication, security, errors
│   │   ├── modules/      one folder per business module
│   │   ├── services/     audit, activity, email, PDF, jobs, storage, scopes
│   │   ├── utils/        money, dates, CSV, HTTP, query helpers
│   │   ├── validators/   shared Zod fragments
│   │   ├── app.ts        Express app
│   │   └── server.ts     entry point
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── app/          routes
│   │   ├── components/   design system, layout, charts
│   │   ├── features/     feature forms and panels
│   │   ├── hooks/ lib/ services/ types/ utils/
│   └── e2e/              Playwright tests
├── docs/
└── docker-compose.yml
```

## Quick start with Docker

Requires Docker with Compose. The stack uses ports 3000, 4000 and 27017 on localhost, so stop anything already using them.

```bash
cp .env.example .env               # then replace every value
docker compose up -d --build
docker compose run --rm seed       # creates the first administrator and default services
```

Open <http://localhost:3000> and sign in with `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`.

## Running without Docker

**Prerequisites:** Node.js 22 or newer, and MongoDB 7 or newer running as a replica set.

The easiest way to get the database is `docker compose up -d mongo`. To use a local `mongod` instead, see [docs/DATABASE.md](docs/DATABASE.md).

```bash
# Backend (http://localhost:4000)
cd backend
npm install
cp .env.example .env     # set BETTER_AUTH_SECRET and SEED_ADMIN_* at least
npm run seed
npm run dev

# Frontend (http://localhost:3000), in a second terminal
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Optional sample data, clearly labelled `[DEMO]`, is available locally with `DEMO_USER_PASSWORD=... npm run seed:demo` in `backend/`. It refuses to run in production.

### Environment variables

**Backend** (`backend/.env.example` has the full list):

| Variable | Required | Purpose |
|---|---|---|
| `MONGODB_URI` | Yes | Connection string, including `replicaSet` |
| `BETTER_AUTH_SECRET` | Yes | Session signing secret, at least 32 characters |
| `BETTER_AUTH_URL` | Yes | Public URL the browser uses for the app |
| `FRONTEND_URL` | Yes | Comma-separated allowed browser origins. The first is used in emailed links |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | For seeding | First administrator |
| `TRUST_PROXY` | In production | Number of reverse proxies in front of the API |
| `COOKIE_DOMAIN` | Separate subdomains only | Shared cookie domain |
| `RESEND_API_KEY`, `EMAIL_FROM` | For email | Without a key, no email is sent, and the app says so |
| `STORAGE_DRIVER`, `CLOUDINARY_*` | For Cloudinary | Defaults to local disk |
| `JOBS_ENABLED`, `JOB_INTERVAL_SECONDS` | No | Background reminders and overdue checks |

**Frontend:** `BACKEND_URL` is where Next.js forwards `/api/v1`. It is read at build time.

## Testing

```bash
cd backend && npm test            # unit and integration, starts its own replica set
cd frontend && npm test           # unit
cd frontend && E2E_MONGODB_URI="mongodb://127.0.0.1:27017/sas3d_e2e?replicaSet=rs0" npm run test:e2e
```

- Backend tests use `/usr/bin/mongod` when it exists, or `MONGOMS_SYSTEM_BINARY`. Otherwise they download MongoDB.
- End-to-end tests need a running replica set and resets only a database whose name contains `e2e`. They use the installed Chrome. Set `E2E_BROWSER_CHANNEL=` and run `npx playwright install chromium` to use Playwright's browser instead.

Lint and type checks: `npm run lint` and `npm run typecheck` in each package.

## Deployment

The target is Vercel for the frontend, Render or another Node host for the API, and MongoDB Atlas. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## API

REST under `/api/v1`, with a consistent response envelope. Monetary values are integers in minor units. See [docs/API.md](docs/API.md).

## Security notes

- Every API route except health and sign-in requires a session verified against the database. The role and status are reloaded on each request, so changes apply immediately.
- Authorization happens on the server: role permissions plus record-level scoping. Records outside a user's scope return 404.
- Public sign-up is disabled. Accounts are created by administrators.
- Password hashes live in Better Auth's `account` collection and are unreachable through the user model.
- Input is validated with Zod. Mongo operator keys are rejected, search terms are escaped, and URLs must be http or https.
- Cookies are HttpOnly and SameSite=Lax, and Secure in production. Cross-origin writes are refused.
- Uploads are checked against a type allowlist and the file's actual bytes, stored under random names and served only as downloads.
- CSV exports neutralise spreadsheet formulas.
- Issued invoices and payments are never deleted, and financial actions are audited.

Never commit `.env` files. Only `.env.example` files with placeholders belong in the repository.

## More documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/DATABASE.md](docs/DATABASE.md)
- [docs/API.md](docs/API.md)
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- [docs/USER_GUIDE.md](docs/USER_GUIDE.md)
- [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md)
