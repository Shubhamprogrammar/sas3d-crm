# Implementation status

Last updated: 2026-11-03. Everything in the master prompt's phases 1 to 8 is implemented. Items needing external accounts are listed below.

## Verified

| Check | Result |
|---|---|
| Backend tests (unit and integration, real replica set) | 95 of 95 passed (`cd backend && npm test`) |
| Frontend unit tests | 4 of 4 passed (`cd frontend && npm test`) |
| End-to-end tests (real browser, frontend, API, database) | 5 of 5 passed (`cd frontend && npm run test:e2e`) |
| TypeScript, ESLint, production builds | Clean in both packages |
| Compiled API in production mode | Secure cookies, rate limiting, health check |
| Docker Compose stack | Builds, seeds, signs in through the proxy, runs jobs |

## Not verified: needs external accounts

| Feature | Status |
|---|---|
| Resend email | Implemented against its documented REST API. Tested only with a fake provider. Configure `RESEND_API_KEY` |
| Cloudinary storage | Implemented against its documented upload API. Never run against the real service. Configure `CLOUDINARY_*` |
| Vercel, Render, Atlas deployment | Configuration documented, not deployed. Run the checklist in DEPLOYMENT.md |

## Known limitations

- PDFs use built-in fonts, which cover Western European characters. Names in scripts such as Devanagari, Arabic or Chinese will not print correctly. Embedding a Unicode font in `pdf.service.ts` would resolve this.
- Dropdowns for choosing clients, leads and projects show the first 100 records, sorted. A searchable picker is needed if a list grows past that.
- Profile images are URLs. There is no upload for them.
- The Gmail, email-provider and WhatsApp integrations are not built. `logCommunication` accepts `channel` and `externalId` for adding them.
- The company-level `preferences.theme` setting is stored but unused. Theme is chosen per browser.
- Rate limits are per process. Exact limits across several API instances would need a shared store.
- Search is a case-insensitive scan, adequate for an agency's data size. Atlas Search would be the upgrade.
- Discount and tax apply to the whole document rather than per line, so revenue by service is before discount and tax.
- Exchange rates are not implemented, by design: currencies are never combined.
- S3-compatible storage is not implemented. The brief allowed Cloudinary or S3, and Cloudinary was chosen.
- The repository has not been initialised with git. Run `git init` when ready.
