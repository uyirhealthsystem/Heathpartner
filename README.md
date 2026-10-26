# Uyir Health Partner Service

Health Partner (HP) backend: profiles, District → Block → Village location, referrals, wallet and withdrawals.

## Architecture

- **Auth Service** only handles identity (login / registration). It holds **no** Health Partner profile data.
- **API Gateway** authenticates the request and injects the caller as `x-user-id` and `x-user-role` headers.
- **This service** owns ALL Health Partner data: profile (name, phone, email, date of birth, gender, address, photo), location (district / block / village), referral code, wallet, referrals, bank account and withdrawals.
- `x-user-id` is stored as `user_id`; `x-user-role` decides access:

| Role | Can use |
|---|---|
| `HP` | Health Partner, profile, referral and payment APIs; read districts / blocks / villages |
| `ADMIN`, `SUPER_ADMIN` | Create districts / blocks / villages; district level Health Partner APIs |

- Location hierarchy: a **District** has **Blocks**, a Block has **Villages**. Every Health Partner must have a district; block and village are optional, and a village needs its block. The service checks the block belongs to the district and the village to the block.
- Reward is ₹10 for each successful referral.

## Configuration

`.env`:

```text
DATABASE_URL=postgres://...
# DIRECT_URL=postgres://...   # Neon: direct (non "-pooler") URL, used for migrations
PORT=3000
# DB_SSL=false   # only for a local Postgres without SSL
```

## Run

```bash
npm install
npm run db:migrate
npm run dev
```

## Database migrations (Prisma)

Prisma is used **only for migrations**; the app still queries Postgres with `pg`. The schema lives in `prisma/schema.prisma`, migrations in `prisma/migrations/`.

| Command | What it does |
|---|---|
| `npm run db:migrate` | Apply pending migrations. Safe to re-run. Used by CI, EC2 deploys and the Docker image. |
| `npm run db:migrate:dev -- --name add_x` | **Dev database only.** Edit `schema.prisma`, then run this to generate + apply a new migration. Commit the new folder. |
| `npm run db:migrate:status` | Show which migrations are applied. |

- A database created by the old `init-db.ts` (tables but no Prisma history) is baselined automatically by `db:migrate`: it re-runs the idempotent `0_init` SQL to fill in anything missing, then marks it applied.
- The case-insensitive unique indexes on `LOWER(name)` and the CHECK constraints on `referrals` aren't expressible in `schema.prisma`; they live in the migration SQL and Prisma leaves them alone. Add similar things by hand-editing a migration (`db:migrate:dev -- --create-only`).
- CI fails if `schema.prisma` and the migrations drift apart.
- Never run `prisma migrate dev`, `migrate reset` or `db push` against a shared / production database — they can drop tables. Give this service its own database (or schema); if another Prisma service shares it, both will write to the same `_prisma_migrations` table.

## Deployment (AWS EC2 + GitHub Actions)

A systemd service on **Amazon Linux 2023**, releases uploaded over SSH (same layout as authservice).

```text
/opt/health-partner-service/
  current -> releases/<timestamp>     # what systemd runs
  releases/<timestamp>/               # last 5 kept
  shared/health-partner-service.env   # DATABASE_URL, PORT (never committed)
```

**Pipeline** (`.github/workflows/ci-cd.yml`):

1. **CI** (every push / PR to `main`): `npm ci` → typecheck → build → `db:migrate` + schema drift check on a throwaway Postgres → start the built server → run the whole Postman collection with Newman.
2. **Deploy** (push to `main` or manual run, only if CI passed): build → rsync `dist/`, `prisma/`, `prisma.config.ts`, `package*.json`, `deploy/` to `releases/next` → `deploy/remote-release.sh` on the host: `npm ci --omit=dev`, apply Prisma migrations, switch `current`, restart, health check. **If the health check fails it rolls back** to the previous release.

**One-time EC2 setup** (Amazon Linux 2023 - Amazon Linux 2 is not supported, its glibc is too old for Node 22):

```bash
scp -i your-key.pem -r deploy ec2-user@<EC2_HOST>:~/
ssh -i your-key.pem ec2-user@<EC2_HOST> 'bash ~/deploy/setup-ec2.sh'
ssh -t -i your-key.pem ec2-user@<EC2_HOST> 'vi /opt/health-partner-service/shared/health-partner-service.env'   # DATABASE_URL, PORT
```

**GitHub secrets** (Settings → Secrets and variables → Actions, `production` environment):

| Secret | Value |
|---|---|
| `EC2_HOST` | EC2 public DNS / IP |
| `EC2_USER` | the SSH user that ran `setup-ec2.sh` (`ec2-user` on Amazon Linux) |
| `EC2_SSH_KEY` | the `.pem` private key you use to SSH in as `ec2-user` |

Keep the service port (`PORT`, default 3000) closed to the internet in the EC2 security group — only the API Gateway should reach it, since the service trusts `x-user-id` / `x-user-role`.

Useful on the host: `sudo systemctl status health-partner-service`, `journalctl -u health-partner-service -f`.

## Postman

Import both files from `postman/`:

- `uyir-health-partner-service.postman_collection.json` — all APIs, folders 1 → 7 run top to bottom as a full flow (Collection Runner works). IDs are saved into collection variables as it runs.
- `uyir-health-partner-service.local.postman_environment.json` — **Health Partner Service - local**: `baseUrl`, the placeholder `x-user-id` / `x-user-role` values (`hpUserId`, `newHpUserId`, `hpRole`, `adminUserId`, `adminRole`) and the district / block / village names.

Select the environment before running. On re-runs, change `hpUserId`, `newHpUserId` and the location names.

## API

All `/api/v1/*` requests need these headers (set by the API Gateway; send them yourself when calling the service directly):

```text
x-user-id: <AUTH_USER_ID>
x-user-role: HP | ADMIN | SUPER_ADMIN
```

Missing headers → `401`; wrong role for the endpoint → `403`.

### Location master (District → Block → Village)

| Method | Path | Role |
|---|---|---|
| GET | `/api/v1/districts` | any role |
| POST | `/api/v1/districts` | ADMIN / SUPER_ADMIN |
| GET | `/api/v1/districts/:districtId/blocks` | any role |
| POST | `/api/v1/districts/:districtId/blocks` | ADMIN / SUPER_ADMIN |
| GET | `/api/v1/districts/:districtId/blocks/:blockId/villages` | any role |
| POST | `/api/v1/districts/:districtId/blocks/:blockId/villages` | ADMIN / SUPER_ADMIN |

POST body: `{ "name": "Madurai" }`. Names are unique (case-insensitive) within their parent.

### District level Health Partners (ADMIN / SUPER_ADMIN)

GET `/api/v1/districts/:districtId/health-partners`

Query (all optional): `blockId`, `villageId`, `status` (ACTIVE | INACTIVE), `search` (name or phone), `page` (default 1), `limit` (default 20, max 100).

```json
{
  "district": { "id": "dist_...", "name": "Madurai" },
  "data": [
    {
      "healthPartnerId": "hp_...",
      "fullName": "Ravi Kumar",
      "phone": "9876543210",
      "status": "ACTIVE",
      "districtId": "dist_...", "districtName": "Madurai",
      "blockId": "blk_...", "blockName": "Melur",
      "villageId": "vil_...", "villageName": "Kottampatti",
      "...": "other profile fields"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

GET `/api/v1/districts/:districtId/health-partners/summary`

```json
{
  "district": { "id": "dist_...", "name": "Madurai" },
  "total": 3, "active": 2, "inactive": 1, "withoutBlock": 0,
  "blocks": [
    {
      "blockId": "blk_...", "blockName": "Melur", "total": 2, "withoutVillage": 1,
      "villages": [
        { "villageId": "vil_...", "villageName": "Kottampatti", "total": 1 },
        { "villageId": "vil_...", "villageName": "Thiruvathavur", "total": 0 }
      ]
    }
  ]
}
```

### 1. Create Health Partner (HP)

POST `/api/v1/health-partners`

The user id comes from `x-user-id`. Required: `fullName`, `phone`, `districtId`. Optional: `blockId`, `villageId` (needs `blockId`), `email`, `dateOfBirth` (YYYY-MM-DD), `gender` (MALE | FEMALE | OTHER), `addressLine1`, `addressLine2`, `city`, `state`, `pincode`, `profilePhotoUrl`, `referralCode`.

```json
{
  "fullName": "Ravi Kumar",
  "phone": "9876543210",
  "districtId": "dist_...",
  "blockId": "blk_...",
  "villageId": "vil_...",
  "referralCode": "HPXXXXXX"
}
```

With `referralCode`, the referral is created and ₹10 credited to the referrer in the same database transaction.

### 2. Dashboard

GET `/api/v1/health-partners/dashboard`

### 3. Status / referral code

PATCH `/api/v1/health-partners/me` — `{ "status": "ACTIVE" | "INACTIVE", "referralCode": "..." }` (both optional)

### 4. Profile

GET `/api/v1/profile`

PATCH `/api/v1/profile` — any profile field. Location is replaced as a group: send `districtId` with optional `blockId` / `villageId` (omitted or `null` = cleared).

```json
{
  "districtId": "dist_...",
  "blockId": "blk_...",
  "addressLine1": "5 Temple Road"
}
```

### 5. Citizen referral

POST `/api/v1/referrals`

```json
{
  "referralCode": "HPXXXXXX",
  "referredUserId": "CITIZEN_AUTH_USER_ID",
  "referredType": "CITIZEN"
}
```

GET `/api/v1/referrals` — my referrals

### 6. Payments

- GET `/api/v1/payments` — wallet balance
- GET `/api/v1/payments/history` — reward transactions
- POST `/api/v1/payments/bank` — save bank account

  ```json
  {
    "accountHolderName": "Ravi Kumar",
    "accountNumber": "123456789012",
    "ifscCode": "SBIN0001234",
    "bankName": "State Bank of India"
  }
  ```

- POST `/api/v1/payments/withdraw` — `{ "amount": 10 }`
- GET `/api/v1/payments/withdrawals` — withdrawal history

## Important

Do not add a local `users` table and do not store HP profile data in Auth Service. `user_id` comes from the `x-user-id` header; all Health Partner data lives in this service.
