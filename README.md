# Sui-dhaaga

**Demo candidate:** full payment/alteration workflow and restart browser
verification are pending. See [Validation and boundaries](#validation-and-boundaries)
before presenting this as a verified demo.

An India-wide custom tailoring and doorstep logistics **demo**. Compare masked
ateliers, choose garment-specific measurements or a reference size template,
agree a timeline, and follow fabric pickup, stitching, delivery and fitting
approval. All prices are INR; payments, subscriptions and courier operations
are simulated. No real charging, financial escrow or bank payout is performed.

Repository: <https://github.com/shashanksagar/Sui-dhaaga>. This is independent of
Stitch Connect; never point it at that application's database or deployment.

## Business rules

- Customers/tailors see aliases, not counterpart names, emails, phone numbers,
  complete addresses or courier contacts. Admin is the private identity mediator.
- Shared profile text, design specs, chat, correction notes, feedback and images
  require Admin review/redaction. Originals stay private to their author/Admin.
  Contact filtering runs on client and server. **Regex cannot recognize all real
  names, addresses or identifying image content; human review is essential and
  is not a guarantee of perfect detection.** Use fictional data for the demo.
- Tailors edit city/expertise, private workshop details, portfolio and a garment
  catalog. Safe garment/measurement labels prevent labels becoming an unreviewed
  identity channel; a tailor chooses the exact required measurement subset.
- Admin sets the added commission (default 10% of tailor base price). Display
  prices include it. Order price, measurements and duration are frozen snapshots.
- Tailors need an approved profile AND an active, unexpired monthly subscription
  to appear in search or receive new orders. The simulated monthly fee is INR499.
  Subscription expiry never prevents finishing existing work.
- Customers explicitly agree to the advertised duration at checkout. Tailors
  confirm it or propose a revision; revised terms need customer acceptance before
  pickup. Production duration starts on fabric arrival at the workshop.
- Admin records 50% at actual fabric/reference-cloth pickup and 25% at doorstep
  garment delivery. Customer explicitly approves fitting/design and pays final
  25%. Nothing is charged at checkout.
- All amounts are integer paise. Pickup is ceil(total/2), delivery floor(total/4),
  and approval the remainder, so indivisible totals reconcile exactly.
- Fitting adjustments are free. Design changes need a reviewed note, an
  Admin/tailor quote, and customer acceptance/payment before reverse pickup.
  Design extras go entirely to the tailor, without another commission.
- Corrections can repeat through reverse pickup, workshop arrival, stitching
  and return delivery. Do not collect original delivery25% again. Final25% stays
  unpaid until final customer approval. Payout/earned commission only at COMPLETED.
- Ratings/reviews follow completion and are moderated before public publication.
- Version guards and transactional payment records reject stale/conflicting
  workflow changes. A failed simulated payment cannot advance a paid milestone.

## Run locally

Use Node.js 24.x, npm and this project's **own** Neon PostgreSQL database.

```powershell
npm ci
npm run setup
```

Setup creates ignored `.env` with fresh private auth/payment secrets and a demo
password if none exists. It never replaces an existing env file. Configure:

| Variable | Local value |
| --- | --- |
| `DATABASE_URL` | New database's pooled Neon PostgreSQL URL |
| `DATABASE_URL_UNPOOLED` | Same new database's direct URL (pooling off) |
| `NEXTAUTH_URL` | `http://localhost:3001` |
| `NEXTAUTH_SECRET` | Generated random private secret |
| `PAYMENT_SECRET` | Different generated private secret |
| `DEMO_PASSWORD` | Generated private demo password |
| `DEMO_MODE` | `true` |
| `NEXT_PUBLIC_CHAT_TRANSPORT` | `polling` |

Do not copy the original Stitch Connect env. Do not commit credentials.
For corporate CA trust, set `$env:NODE_USE_SYSTEM_CA='1'`; never disable TLS
verification. The official Neon WebSocket Prisma adapter uses verified WSS on
port443, preserves interactive PostgreSQL transactions and Vercel pool lifecycle
handling, and avoids this network's TCP5432 connection resets. Migrations use
the direct endpoint over WSS and transactional checksummed SQL.

```powershell
npx prisma generate
npm run db:migrate
npm run db:seed
npm run build
npm start
```

Open <http://localhost:3001>, the exact origin configured in `NEXTAUTH_URL`.
The server binds to loopback. The Sui-dhaaga fresh initial schema is for this
previously empty database, not an in-place conversion of the old USD application.
Never reset an existing unrelated database. Cloud builds do not run migrations.

### Demo accounts

| Role | Email |
| --- | --- |
| Customer | `customer@sui.local` |
| Tailors | `tailor1@sui.local` through `tailor5@sui.local` |
| Admin | `admin@sui.local` |

The private password is this project's `DEMO_PASSWORD`, shared only with demo
participants. It is stored as hashes; changing the env value after seeding does
not change existing account hashes. Signup supports CUSTOMER and TAILOR only.
New tailors complete profile review and the monthly-fee module before listing.
Seed uses fictional Indian addresses, five anonymous ateliers, original garment
artwork and two consistent example orders.

## Demo walkthrough

1. Customer: `/explore` compares up to three active approved tailors. Ask a
   masked pre-order inquiry or choose a garment, measurements/template, private
   addresses and an explicit estimated-duration agreement.
2. Admin: `/dashboard/admin` reviews specs/images/chat/profile content, redacting
   identities. Tailor: `/dashboard/tailor` confirms or proposes duration.
   Customer accepts any revision on the order screen.
3. Admin schedules fabric/template pickup and confirms pickup50% collection,
   then workshop arrival. Tailor starts stitching and marks the garment ready.
4. Admin dispatches final garment and records delivery25% at the customer's
   doorstep. Customer requests free fitting corrections or an accepted prepaid
   design change, or approves and simulates the last25% payment.
5. Reverse logistics repeat as needed. On completion, customer submits feedback;
   Admin reviews it and sees earned commission, subscription collections and
   tailor payout due. The ledger does not execute bank transfers.

Private images are JPEG/PNG/WebP, up to 3 MB. Unreviewed originals are not shared
through direct URLs. New image bytes live in private database rows; this storage
choice is intended for a small demo, not production-scale object storage.

## Manual Vercel deployment

No Vercel CLI or desktop app is required or installed.

1. Import **shashanksagar/Sui-dhaaga** into a separate Vercel project.
2. Choose **Next.js**, root `.`, Node.js **24.x**, install `npm ci`, build
   `prisma generate && next build`. Leave output at the Next.js default and use
   Fluid compute. Functions are configured in `cle1`, near the Ohio database.
3. Configure these Production variables privately:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | This new database's pooled URL |
   | `NEXTAUTH_URL` | Actual canonical HTTPS Vercel domain, no trailing slash |
   | `NEXTAUTH_SECRET` | Private random auth secret |
   | `PAYMENT_SECRET` | Different private random payment secret |
   | `DEMO_MODE` | `true` |
   | `NEXT_PUBLIC_CHAT_TRANSPORT` | `polling` |

   The direct migration URL and demo password are not needed on Vercel.
4. Apply schema and seed locally first, then deploy the latest `main`.
   Keep the explicit Prisma compiler WASM file tracing in `next.config.ts`.
5. Update `NEXTAUTH_URL` to Vercel's actual assigned domain if needed and
   redeploy. Chat mode is chosen at build time. Use the canonical domain rather
   than a per-deployment preview URL.
6. Test marketplace, each role's login, reviewed chat/media and a complete order
   with a correction cycle. If a public fictional-data demo is intended, review
   Production Deployment Protection; never publish the Admin password.

Any database password previously pasted into chat should be rotated in Neon.
Update local/Vercel values and redeploy. Secrets and deployment bindings are
excluded from Git.

## Validation and boundaries

Current feature-build evidence: the new database's two migrations and seed
succeeded; production build, lint, type-check and 17 focused tests passed. The
guided customer checkout browser test also passed. The all-in-one validation
tool repeatedly hit its host timeout during the longer order/correction flow.
**Full workflow and restart verification remain pending; this is not a completed
demo-readiness certification.** Cancelled test servers and known temporary
schemas were cleaned up. Run the complete browser suite directly in a terminal
without the tool's invocation timeout before calling the demo verified.

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

Only the original checked-in SVG artwork is pre-approved and seeded into the
portfolio store. Customer/tailor uploads still accept JPEG/PNG/WebP only and
require human review. Reseeding resets the five fictional demo profiles; do not
use it as a real subscription-renewal operation.

Tests use isolated temporary schemas in this new database, not the normal public
demo data. Browser flows cover consent/reference template, masked reviewed
chat, payment failure, paid/free repeated corrections, final approval, feedback
and persistence after restart. Chromium and loopback port3100 are required.
Network failures are reported explicitly; a passing build alone is not a runtime
or migration certification.

Demo scope excludes real carriers, payment providers, refunds/disputes, password
recovery/email verification, regulated escrow and actual payouts. Process-local
throttling is not distributed abuse control. The copied dependency audit has
three high-severity findings in the Prisma/config/effect chain
(<https://github.com/advisories/GHSA-7589-6fvf-x4pw>); this feature batch does not
perform unrelated forced dependency downgrades.
