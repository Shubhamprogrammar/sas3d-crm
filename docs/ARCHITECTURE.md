# Architecture

## Overview

SAS3D CRM is a modular monolith: one Next.js frontend and one Express API, sharing one MongoDB database.

```
Browser ──> Next.js (pages + /api/v1 rewrite) ──> Express API ──> MongoDB replica set
                                                     ├── Better Auth (mounted at /api/v1/auth)
                                                     ├── Scheduler (in process, Mongo lock)
                                                     ├── Resend (optional)
                                                     └── Local disk or Cloudinary
```

The browser only ever talks to the frontend origin. Next.js forwards `/api/v1/*` to the API, which keeps session cookies first-party without any cross-site cookie configuration.

## Backend

Each module in `src/modules/` follows the same split where it earns its place:

| File | Responsibility |
|---|---|
| `model.ts` | Mongoose schema and indexes |
| `validator.ts` | Zod request schemas |
| `service.ts` | Business logic, the only layer that writes to the database |
| `controller.ts` | Translates HTTP to service calls |
| `routes.ts` | Paths and permission requirements |

Small modules (notifications, search, team, settings) combine the controller into `routes.ts`, as separate files would add only indirection. Pure rules live in their own files so they can be tested without a database: `utils/money.ts`, `invoices/balance.ts`, `opportunities/transitions.ts`, `projects/progress.ts`, `proposals/status.ts`.

### Request lifecycle

`helmet → CORS → request log → rate limit → Better Auth (its routes only) → JSON body → cross-origin check → operator rejection → requireAuth → requirePermission → controller → service → error handler`

Better Auth is mounted before the JSON parser because it reads the raw body.

### Authentication

Better Auth runs inside Express using its MongoDB adapter, sharing Mongoose's driver connection. Express calls `auth.api.getSession()` on every protected request and then reloads the user, so frontend checks are never relied on:

- A role change applies on the next request.
- Deactivating a user revokes their sessions, and `requireAuth` also refuses the account.
- `proxy.ts` in Next.js only checks that a cookie exists, as a convenience redirect.

Public sign-up is off. `provisionUser` in `config/auth.ts` creates accounts through Better Auth's internal adapter.

### Authorization

Two layers:

1. **Role permissions:** `config/permissions.ts` is the single matrix. `requirePermission` guards each route.
2. **Record scope:** `services/scope.service.ts` returns the filter of what an actor may see. Services merge it into every query, so a record outside scope gives 404 and reveals nothing.

| Role | Leads and opportunities | Clients | Projects | Proposals | Invoices |
|---|---|---|---|---|---|
| Super Admin, Admin | All | All | All | All | All |
| Sales | Assigned or created | Managed or created | Created | Own | None |
| Project Manager | None | Clients of their projects | Managed, member or created | None | None |
| Developer | None | None | Member of | None | None |
| Finance | None | All | All (read) | All (read) | All |

Admins cannot create or modify Admins or Super Admins, and the last active Super Admin cannot be removed.

### Money

All amounts are integer minor units, and all seven supported currencies have 2 decimal places. Quantities are held in thousandths and rates in basis points during calculation, and every multiplication goes through `BigInt` with half-up rounding. There is one calculation path: the invoice and proposal editors call `POST /invoices/preview-totals`, so previews, stored totals and PDFs cannot disagree. Totals sent by a client are ignored.

Discount and tax apply at document level: `subtotal − discount = taxable`, `taxable × rate = tax`.

Currencies are never added together. Every financial report and dashboard figure is grouped by currency, and money charts show one selected currency at a time. No exchange-rate feature exists.

### Consistency

Multi-document writes use transactions, retried by the driver on transient errors. Other guards:

- **Payments:** the update filter `amountDue: { $gte: amount }` makes overpaying impossible even under concurrency.
- **Pipeline moves:** the filter on the current stage is a compare-and-swap, so a stale drag gets a 409.
- **Conversions:** unique indexes on `Client.sourceLead` and `Project.opportunity` make repeats and races safe.
- **Document numbers:** an atomic counter plus unique indexes.

### Background jobs

`services/jobs.service.ts` runs in the API process on an interval. A lock in `joblocks` ensures that only one instance runs a cycle. Each cycle marks overdue invoices, expires proposals, and sends follow-up, task and milestone reminders. Reminder dedupe keys include the due time, so a repeat run stays silent and a rescheduled item notifies again. Failures in one job do not stop the rest.

### Integrations

| Concern | Abstraction | Implementations |
|---|---|---|
| Email | `EmailProvider` | Resend, plus a not-configured provider that reports `sent: false` |
| Storage | `storeFile` | Local disk, Cloudinary |
| Communication | `logCommunication(actor, input, { channel, externalId })` | Manual only. Gmail, email or WhatsApp sync can call the same function |

A document is marked as emailed only after the provider confirms it.

## Frontend

- `components/ui` holds the hand-built design system, with no component library.
- `hooks/use-api.ts` wraps TanStack Query. Query keys are `[path, params]`, and mutations invalidate by path prefix.
- `features/` holds feature forms and panels. Pages in `app/` compose them.
- Business rules stay on the server. The client only converts decimal text to minor units for display and input, as strings rather than floats.
- `useMe().can()` hides what a user cannot do, for usability only.
- Colors are CSS variables in `globals.css`, with a separate selected set for dark mode.
- Every chart can switch to a table, so no figure relies on color or hover alone.

## Decisions

| Decision | Reason |
|---|---|
| Next.js rewrite instead of direct cross-site calls | First-party cookies, no CORS complexity |
| Better Auth inside Express | One service owns identity and API authorization |
| Opportunity auto-created per lead | Every lead appears on the board, and lead status can never disagree with its stage |
| Native HTML5 drag and drop | No dependency. A Move menu on every card covers keyboard and touch |
| Native date inputs | Accessible and mobile-friendly without a date library |
| In-process scheduler | No extra infrastructure at this scale |
| Reset links built from `FRONTEND_URL` | A caller-supplied redirect could deliver a reset token off-site |
