# Deployment

The recommended setup is the frontend on Vercel, the API on Render or another Node host, and the database on MongoDB Atlas. This configuration has been tested with Docker Compose and in production mode locally. It has not been deployed to these hosted services, so run the checklist below after your first deployment.

## 1. Database: MongoDB Atlas

1. Create a cluster. Every Atlas cluster is a replica set, so transactions work.
2. Create a database user with read and write access to a `sas3d_crm` database.
3. Allow the API host's outbound IPs under Network Access.
4. Use a connection string like `mongodb+srv://USER:PASSWORD@CLUSTER/sas3d_crm`.

## 2. API: Render or similar

| Setting | Value |
|---|---|
| Root directory | `backend` |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm start` |
| Health check | `/api/v1/health` |
| Node version | 22 or newer |

Or deploy `backend/Dockerfile`.

Environment:

```
NODE_ENV=production
TRUST_PROXY=2
MONGODB_URI=<Atlas connection string>
BETTER_AUTH_SECRET=<openssl rand -base64 32>
BETTER_AUTH_URL=https://crm.sas3d.in
FRONTEND_URL=https://crm.sas3d.in
RESEND_API_KEY=<key>
EMAIL_FROM=SAS3D CRM <crm@sas3d.in>
STORAGE_DRIVER=cloudinary
CLOUDINARY_CLOUD_NAME=<name>
CLOUDINARY_API_KEY=<key>
CLOUDINARY_API_SECRET=<secret>
```

`TRUST_PROXY` is the number of proxies between the client and the API. With Vercel's rewrite in front of Render it is 2. Set it correctly, because rate limits depend on the client IP.

Seed once, with `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` set: run `npm run seed:prod` from a shell on the host. Then remove the password from the environment.

**File storage:** the default `local` driver writes to disk, which is lost on redeploy on most hosts unless a persistent disk is attached. Use Cloudinary or a persistent disk in production. Files uploaded through the Cloudinary driver have unguessable but publicly reachable URLs, so choose a persistent disk if your documents require strict access control.

## 3. Frontend: Vercel

| Setting | Value |
|---|---|
| Root directory | `frontend` |
| Framework | Next.js |
| Environment | `BACKEND_URL=https://<your-api-host>` |

`BACKEND_URL` is read at build time, so redeploy after changing it. Vercel limits proxied request bodies to about 4.5 MB, which caps uploads made through the rewrite; lower `MAX_UPLOAD_MB` to match, or host the frontend elsewhere if you need larger files.

## Cookies, CORS and sessions

**Recommended: the same origin through the rewrite.** The browser sees one site, so cookies are first-party and CORS is not involved. `BETTER_AUTH_URL` and `FRONTEND_URL` are both the frontend's URL, and `COOKIE_DOMAIN` stays empty.

**Alternative: separate subdomains**, such as `crm.sas3d.in` and `api.sas3d.in`, with the browser calling the API directly. This needs code and environment changes:

- Set `BETTER_AUTH_URL=https://api.sas3d.in`, `FRONTEND_URL=https://crm.sas3d.in` and `COOKIE_DOMAIN=.sas3d.in`.
- Point `baseURL` in `frontend/src/services/api.ts` and `auth-client.ts` at the API origin.
- Both must be HTTPS subdomains of one registrable domain, keeping cookies SameSite.

Separate unrelated domains are not supported, because the cookies are SameSite=Lax.

In production, cookies are `Secure` with a `__Secure-` prefix, so the site must be served over HTTPS.

## Docker

`docker compose up -d --build` runs the whole stack for local use. For a production Compose setup, set `APP_ENV=production`, serve it behind an HTTPS reverse proxy, change the auth URLs in `docker-compose.yml`, and do not publish the MongoDB port.

The frontend image takes `BACKEND_URL` as a build argument.

## Scaling

The API can run several instances: the scheduler lock prevents duplicate job runs. Two things are per-process and would need a shared store to be exact across instances: the API rate limiter and Better Auth's rate limiter. With local storage, all instances must share one disk, so use Cloudinary instead.

## Backups

The application does not back up data.

- **Atlas:** enable continuous cloud backup and test a restore.
- **Self-hosted:** schedule `mongodump` and copy the output off the server:

  ```bash
  mongodump --uri="$MONGODB_URI" --gzip --archive="sas3d-$(date +%F).gz"
  ```

Back up the `uploads` volume too when using local storage. Include `user`, `account` and `session`, which hold authentication data, and protect the archives accordingly. The JSON export in Settings is for data portability and does not replace backups.

## Post-deployment checklist

- [ ] `GET /api/v1/health` returns `connected`.
- [ ] Sign in works, and the session cookie is `Secure` and `HttpOnly`.
- [ ] Settings > System shows email as configured and jobs as having run.
- [ ] Request a password reset and receive the email. Its link opens your frontend.
- [ ] Upload and download a file.
- [ ] Email a proposal to yourself.
- [ ] After 11 failed sign-ins in a minute, the next attempt gets a 429.
