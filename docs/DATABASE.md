# Database

## Replica set requirement

The app uses MongoDB transactions, which need a replica set. A single node is enough.

- **MongoDB Atlas:** every cluster is a replica set, so nothing extra is needed.
- **Docker Compose:** the `mongo` service initialises itself.
- **Local `mongod`:**

  ```bash
  mongod --dbpath ./data --replSet rs0 --bind_ip 127.0.0.1
  mongosh --eval 'rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "127.0.0.1:27017" }] })'
  ```

  Then use `MONGODB_URI=mongodb://127.0.0.1:27017/sas3d_crm?replicaSet=rs0`.

On a standalone server, any write that uses a transaction fails with an error from MongoDB.

Collections and indexes are created at startup by `initDatabase()`.

## Conventions

- Timestamps are stored in UTC. Calendar dates such as invoice due dates are stored as midnight UTC.
- Money is an integer in minor units, always stored beside its currency.
- Business records carry `createdAt`, `updatedAt`, and `createdBy` and `updatedBy` where relevant.
- Soft deletion uses `archivedAt`, `deletedAt` or a status. Unbounded data lives in its own collection rather than in an array.

## Collections

| Collection (model) | Purpose | Key relations | Notable indexes |
|---|---|---|---|
| `user` (User) | Team members, owned jointly with Better Auth | | unique `email`, `role`, `status` |
| `session`, `account`, `verification` | Better Auth sessions, credentials and tokens | `userId` | unique `token`, TTL on `expiresAt` |
| `leads` (Lead) | Potential clients | `assignedTo`, `opportunity`, `convertedClient` | status, source, country, assignee, `email`, `phoneDigits`, `nextFollowUpAt` |
| `opportunities` (Opportunity) | Pipeline cards | `lead`, `client`, `project`, `assignedTo` | unique partial `lead`, stage |
| `stagehistories` (StageHistory) | Every stage change | `opportunity`, `changedBy` | `opportunity + createdAt` |
| `clients` (Client) | Customers | `relationshipManager`, `sourceLead` | unique partial `sourceLead`, `email`, `name` |
| `tasks` (Task) | CRM tasks and follow-ups | `lead`, `client`, `project`, `assignedTo` | assignee + status + due date |
| `activities` (Activity) | System events and logged communication | `lead`, `client`, `project`, `actor` | one per relation by `occurredAt` |
| `proposals` (Proposal) | Quotations | `client`, `lead`, `opportunity` | unique `number`, status, validity |
| `proposalrevisions` (ProposalRevision) | Snapshots before each edit | `proposal` | unique `proposal + revision` |
| `projects` (Project) | Delivery work | `client`, `opportunity`, `projectManager`, `team` | unique `code`, unique partial `opportunity` |
| `milestones` (Milestone) | Project milestones | `project` | `project + dueDate` |
| `projecttasks` (ProjectTask) | Tasks and subtasks | `project`, `milestone`, `parentTask`, `assignedTo` | `project + parentTask` |
| `projectupdates` (ProjectUpdate) | Updates, work notes, client feedback | `project`, `author` | `project + createdAt` |
| `invoices` (Invoice) | Invoices with balance | `client`, `project` | unique `number`, status + due date, currency + issue date |
| `payments` (Payment) | Payment records, voided rather than deleted | `invoice`, `client`, `recordedBy` | unique partial `invoice + transactionReference` |
| `services` (Service) | Service catalogue | | unique `name` |
| `notifications` (Notification) | In-app notifications | `recipient` | recipient + read state, unique sparse `dedupeKey` |
| `auditlogs` (AuditLog) | Append-only audit trail | `actor` | `createdAt`, entity, actor |
| `companysettings` (CompanySettings) | Singleton settings | | unique `key` |
| `counters` (Counter) | Document number sequences | | |
| `joblocks` (JobLock) | Scheduler lock | | |
| `attachments` (Attachment) | File metadata | `entityType + entityId` | entity + `deletedAt` |

The `Service` model name refers to the catalogue. Application services are in `src/services/`.

## Invoice invariants

- `amountPaid + amountDue = total` on every non-cancelled invoice.
- `status` is derived from the balance by `deriveInvoiceStatus`, except for `DRAFT` and `CANCELLED`.
- Only drafts can be edited or deleted. Issued invoices are cancelled, and only once their payments are voided.

## Seeding

`npm run seed` is safe to repeat. It creates default settings, a price-free service catalogue and the first Super Admin from environment variables. No real or fictional business records are created. `npm run seed:demo` adds `[DEMO]` records for local use, and refuses to run in production.

## Backups

The application does not perform backups. Use Atlas continuous backups in production, or schedule `mongodump`. See [DEPLOYMENT.md](DEPLOYMENT.md).
