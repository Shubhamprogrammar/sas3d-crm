# API

Base URL: `/api/v1`. Sessions use cookies set by Better Auth, so send credentials with each request.

## Response format

```json
{ "success": true, "message": "Operation completed successfully", "data": {}, "meta": {} }
```

```json
{ "success": false, "message": "Readable error message", "errors": [{ "path": "email", "message": "Invalid email" }] }
```

| Status | Meaning |
|---|---|
| 400 | Malformed request, forbidden keys or a broken business rule |
| 401 | Not signed in |
| 403 | Role lacks permission |
| 404 | Not found, or outside your record scope |
| 409 | Conflict: duplicate, stale update or invalid state |
| 422 | Validation failed, with field errors |
| 429 | Rate limited |
| 502 | Email or storage provider did not confirm |

## Conventions

- **Money:** integer minor units, e.g. `USD 12.50` is `1250`.
- **Rates:** basis points, e.g. `18%` is `1800`.
- **Quantities:** decimals with at most 3 places.
- **Lists:** `page`, `limit` (up to 100 in general), `search`, `sortBy`, `sortOrder`. `meta` holds `page`, `limit`, `total`, `pages`.
- **Date ranges:** `preset` is one of `today`, `last_7_days`, `last_30_days`, `this_month`, `last_month`, `this_year`, `custom`, with `from` and `to` for custom.

## Endpoints

### Public

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health and database status |
| POST | `/auth/sign-in/email` | Sign in |
| POST | `/auth/request-password-reset` | Email a reset link |
| POST | `/auth/reset-password` | Set a new password using a token |

### Session

| Method | Path | Description |
|---|---|---|
| POST | `/auth/sign-out` | Sign out |
| POST | `/auth/change-password` | Change password |
| GET | `/auth/get-session` | Current session |
| GET, PATCH | `/me` | Profile, permissions and preferences. Role and status cannot be changed here |

### Leads: `lead:*`

| Method | Path | Description |
|---|---|---|
| GET, POST | `/leads` | List, create. Filters: `status`, `source`, `priority`, `country`, `service`, `assignedTo`, `archived`. Create returns 409 with `DUPLICATE_LEAD` unless `allowDuplicate` is true |
| GET | `/leads/duplicates` | Check `email`, `phone` |
| GET | `/leads/export` | CSV, accepting the same filters |
| POST | `/leads/import` | Multipart `file`, returns per-row results |
| GET, PATCH, DELETE | `/leads/:id` | Read, update, archive |
| POST | `/leads/:id/restore` | Restore |
| POST | `/leads/:id/convert` | Convert to client, safe to repeat |

### Pipeline: `opportunity:*`

| Method | Path | Description |
|---|---|---|
| GET | `/opportunities/board` | Columns with per-currency totals and win rate |
| POST | `/opportunities` | Create for an existing client |
| GET, PATCH | `/opportunities/:id` | Read with history, update |
| POST | `/opportunities/:id/move` | `{ to, lostReason }`. LOST requires a reason |
| POST | `/opportunities/:id/convert` | WON only: `{ createProject, project }`, safe to repeat |

### Clients: `client:*`

| Method | Path | Description |
|---|---|---|
| GET, POST | `/clients` | List, create |
| GET, PATCH, DELETE | `/clients/:id` | Read with per-currency summary, update, archive |

### Tasks: `task:*`

| Method | Path | Description |
|---|---|---|
| GET, POST | `/tasks` | `view` is `today`, `upcoming` or `overdue`. Also `status`, `priority`, `assignedTo`, `lead`, `client`, `project`, `from`, `to` |
| GET, PATCH, DELETE | `/tasks/:id` | Read, update, soft delete |

### Activities: `activity:*`

| Method | Path | Description |
|---|---|---|
| GET | `/activities` | Timeline by `lead`, `client` or `project`, `kind`, `commType` |
| POST | `/activities` | Log communication |

### Proposals: `proposal:*`

| Method | Path | Description |
|---|---|---|
| GET, POST | `/proposals` | List, create |
| GET, PATCH, DELETE | `/proposals/:id` | Read, revise (records a revision), archive |
| GET | `/proposals/:id/pdf` | PDF |
| GET | `/proposals/:id/revisions` | Revision history |
| POST | `/proposals/:id/duplicate` | Copy as a new draft |
| POST | `/proposals/:id/status` | `SENT`, `VIEWED`, `ACCEPTED`, `REJECTED`, `EXPIRED` |
| POST | `/proposals/:id/send` | Email with PDF. Returns 502 unless the provider confirms |

### Projects: `project:*`, `projecttask:*`

| Method | Path | Description |
|---|---|---|
| GET, POST | `/projects` | List with computed progress, create |
| GET, PATCH, DELETE | `/projects/:id` | Read, update, archive |
| GET, POST | `/projects/:id/updates` | Updates, work notes, client feedback |
| GET, POST | `/milestones` | `?project=` required for list |
| PATCH, DELETE | `/milestones/:id` | Update, delete |
| GET, POST | `/project-tasks` | `?project=` required for list. `parentTask` makes a subtask |
| PATCH, DELETE | `/project-tasks/:id` | Assignees may change only `status` and `description` |

### Invoices: `invoice:*`

| Method | Path | Description |
|---|---|---|
| GET, POST | `/invoices` | List, create a draft |
| POST | `/invoices/preview-totals` | Calculate totals without saving |
| GET, PATCH, DELETE | `/invoices/:id` | Read with payments. Edit and delete apply to drafts only |
| GET | `/invoices/:id/pdf` | PDF |
| POST | `/invoices/:id/issue` | Draft to sent, with no email |
| POST | `/invoices/:id/send` | Email with PDF, and issue if draft |
| POST | `/invoices/:id/cancel` | `{ reason }`, requires no active payments |

### Payments: `payment:*`

| Method | Path | Description |
|---|---|---|
| GET, POST | `/payments` | List, record. Must match the invoice currency and cannot exceed the balance |
| POST | `/payments/:id/void` | `{ reason }`, keeps the record and restores the balance |

### Other

| Method | Path | Permission | Description |
|---|---|---|---|
| GET, POST | `/services` | `service:*` | Catalogue |
| GET, PATCH, DELETE | `/services/:id` | `service:*` | Delete deactivates |
| GET, POST | `/team` | `team:*` | Members |
| GET, PATCH | `/team/:id` | `team:*` | With assignments and stats |
| POST | `/team/:id/status` | `team:write` | Activate or deactivate |
| GET | `/dashboard` | `dashboard:read` | Sections limited to the role |
| GET | `/reports/sales`, `/finance`, `/projects`, `/team` | `report:*` | `format=csv` for export |
| GET | `/notifications` | Signed in | Own notifications only |
| GET | `/notifications/unread-count` | Signed in | |
| POST | `/notifications/read-all`, `/notifications/:id/read` | Signed in | |
| GET | `/search?q=` | Signed in | Respects permissions and scope |
| GET, POST | `/attachments` | `attachment:*` | By `entityType` (`LEAD`, `CLIENT`, `PROJECT`) and `entityId` |
| GET | `/attachments/:id/download` | `attachment:read` | Download |
| DELETE | `/attachments/:id` | `attachment:write` | Uploader or admin |
| GET | `/settings/preferences` | Signed in | Display preferences |
| GET, PATCH | `/settings` | `settings:*` | Company settings |
| GET | `/settings/roles` | `settings:read` | Permission matrix |
| GET | `/settings/audit-logs` | `audit:read` | Audit trail |
| GET | `/settings/system` | `settings:read` | Status and counts |
| GET | `/settings/export?collection=` | `data:export` | JSON export |

The complete role matrix is in `backend/src/config/permissions.ts`.

## Limits

600 requests per minute per IP overall; 10 sign-ins per minute; 5 reset requests per 5 minutes; JSON bodies up to 1 MB; uploads up to `MAX_UPLOAD_MB`; CSV import up to 5 MB and 5000 rows.
