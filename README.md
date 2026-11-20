# Sui-dhaaga - Neon/Vercel starter (database setup pending)

Separate repository: <https://github.com/shashanksagar/Sui-dhaaga>.

**This is the copied marketplace starter, not the completed Sui-dhaaga business
logic.** It still uses USD, two simulated 50/50 installments, the original
logistics flow and unmasked participant identities. INR, 50/25/25 payments,
subscriptions, timeline negotiation, moderation and alteration loops remain
unimplemented. The app displays this limitation. Use fictional data only.

The original Stitch Connect source, repository and database are not used by this
project. Configure this app with its own Neon database; never pull environment
variables from the original project.

## Current handoff status

- The supplied new Neon connection is configured only in ignored local `.env`.
  Pooled and direct read-only connections initially succeeded; the `public`
  schema was empty.
- Later connections reset with `ECONNRESET` / Prisma `ConnectionClosed`.
  **No migration or seed has been applied to the normal demo schema.**
- Lint, production build and type-check passed. Prisma compiler WASM is present
  in all 13 app route traces.
- Database tests could not start, and the database-backed `/explore` check
  returned HTTP 500. Browser tests were blocked during database preparation.
  This is not a verified working deployment yet.
- Dependency auditing reported three high-severity findings in the
  `prisma -> @prisma/config -> effect` dependency chain, including with
  `--omit=dev`: <https://github.com/advisories/GHSA-7589-6fvf-x4pw>.
  No forced downgrade or unrelated upgrade was applied.

**Before deploying**, use a network that can reach this Neon database and run
the migration, seed and verification commands below. Do not deploy the empty
database expecting the marketplace or login to work.

## Local setup

Use Node.js 24.x and npm. No Vercel CLI or desktop app is needed.

```powershell
npm ci
npm run setup
```

Setup generates fresh private session/payment secrets and a demo password in
ignored `.env`. It preserves an existing file. Configure the new project's
connection strings there, without committing them:

- `DATABASE_URL`: pooled Neon URL for application queries.
- `DATABASE_URL_UNPOOLED`: direct URL for migrations and isolated-schema tests.
  Obtain it from the same Neon database with connection pooling switched off.
- `NEXTAUTH_URL=http://localhost:3001`.
- `DEMO_MODE=true`; `NEXT_PUBLIC_CHAT_TRANSPORT=polling`.
- Keep the generated `NEXTAUTH_SECRET`, `PAYMENT_SECRET`, and `DEMO_PASSWORD`.

```powershell
npx prisma generate
npm run db:migrate
npm run db:seed
npm run build
npm start
```

Open <http://localhost:3001>. Use this exact origin for login and mutations.
The server binds to loopback. The migration runner records transactional
checksums; builds do not apply migrations or seed data.

The existing Prisma/pg adapter preserves pooling and validates TLS certificates.
If corporate CA trust is needed, set `$env:NODE_USE_SYSTEM_CA = '1'` for Node
commands. Do not disable TLS verification.

## Seeded accounts

| Role | Email |
| --- | --- |
| Customer | `customer@stitch.local` |
| Tailors | `tailor1@stitch.local` through `tailor5@stitch.local` |
| Admin | `admin@stitch.local` |

The legacy demo account names are retained for compatibility with existing
tests. Passwords use the **private `DEMO_PASSWORD` in this project's `.env`**,
not the original project's password. Seed creates five tailor profiles and two
orders. Reseeding preserves existing password hashes/payment/workflow state;
changing the env password alone does not update those hashes.

## Manual Vercel deployment

1. On Vercel, choose **Add New > Project** and import
   **shashanksagar/Sui-dhaaga**. Create a separate project; do not select the
   existing Stitch Connect deployment.
2. Framework: **Next.js**. Root directory: `.`. Node.js: **24.x**.
   Install: `npm ci`. Build: `prisma generate && next build` (already set in
   `vercel.json`). Leave output directory at the default. Use Fluid compute.
   Functions are configured in `cle1` (Cleveland), near the new Ohio database.
3. Add these **Production** environment variables privately:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | This new Neon database's pooled connection URL |
   | `NEXTAUTH_URL` | Your actual canonical HTTPS Vercel domain, no trailing slash |
   | `NEXTAUTH_SECRET` | This project's generated secret, or a new random 32-byte secret |
   | `PAYMENT_SECRET` | A different random secret |
   | `DEMO_MODE` | `true` |
   | `NEXT_PUBLIC_CHAT_TRANSPORT` | `polling` |

   Do not assume the new project gets a particular `.vercel.app` domain.
   Set `NEXTAUTH_URL` to the domain Vercel assigns; update it and redeploy if
   necessary. Use the canonical domain, not a deployment-specific preview URL.
   `DATABASE_URL_UNPOOLED` and `DEMO_PASSWORD` are not needed on Vercel.
4. Ensure the new database has been migrated and seeded locally before deployment.
   This is currently pending. From a network with working Neon access, run:

   ```powershell
   npx prisma generate
   npm run db:migrate
   npm run db:seed
   npm test
   npm run build
   npm run test:e2e
   ```

   Do not run migrations or seed in the Vercel build command.
5. Click **Deploy**. After any env change, redeploy: chat transport is selected at
   build time. Keep `next.config.ts`'s Prisma WASM file-tracing inclusion.
6. Once Ready, check `/explore` shows five tailors. Test signup/login, order
   creation, simulated payment, polling chat, tailor production and Admin
   logistics with separate browser profiles.
7. If a publicly accessible fictional-data demo is intended, review
   **Settings > Deployment Protection** for the production deployment. App auth
   still protects role pages. Never publish the seeded Admin password.

No database credentials or deployment bindings are included in Git. If a
connection string has been shared in chat or logs, rotate the database role
password in Neon, update local/Vercel variables, and redeploy.

## Validation

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

Integration and browser tests use randomly named temporary schemas in this
project's database and clean them afterward; they do not reset the normal
`public` demo data. Browser tests require an available Playwright Chromium
browser and loopback port 3100. The second browser batch verifies persistence
after restart. Polling mode works on Vercel; the custom local server also retains
Socket.io support.

Images are JPEG/PNG/WebP, limited to 3 MB and stored privately in Neon. Payments
and couriers are simulations only. There is no real charging, regulated escrow,
bank payout, carrier integration or production-commerce certification.
