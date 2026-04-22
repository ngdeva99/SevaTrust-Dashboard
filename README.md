# Trust Management System

Admin-managed membership, subscriptions, payments, and mailing-list system for a religious trust.

Phase 1 of the plan described in `ARCHITECTURE_v2.md`. This repository covers:

- Database schema on Supabase (Postgres)
- Admin authentication
- Member list, create, edit
- Subscription tracking (life and annual)
- Offline payment recording (cheque, cash, UPI, bank transfer)
- Indian financial-year receipt numbering
- PAN collection with AES-256-GCM encryption at rest
- Monthly mailing-list PDF generator (3-column printable grid)
- Legacy `.doc` parser + CSV importer

Not yet built (planned for later phases):

- Razorpay integration for online payments
- Public book catalogue and orders
- Member status page at `/m/[token]` with self-service renewals
- Address change approval queue
- SMS/email sending

---

## What you need before starting

1. A Supabase account (free)
2. Node.js 20.9 or newer — check with `node --version`
3. `pnpm` (recommended) or `npm`
4. Python 3.10+ (for the one-time legacy import)
5. LibreOffice (for converting `.doc` → `.docx`)

On macOS:
```bash
brew install node pnpm python libreoffice
```

On Ubuntu:
```bash
sudo apt install nodejs npm python3-pip libreoffice
sudo npm install -g pnpm
```

---

## Step 1 — Create your Supabase project

1. Go to https://supabase.com and sign up / sign in.
2. Click **New project**.
3. Fill in:
   - **Project name:** trust-management (or whatever you like)
   - **Database password:** generate a strong one and save it to a password manager
   - **Region:** `ap-south-1 (Mumbai)` — keeps the data in India
4. Wait ~2 minutes for provisioning.
5. Once the dashboard loads, go to **Project Settings → API**. You'll see three things you need:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **anon public** key — long JWT starting with `eyJ…`
   - **service_role** key — another JWT starting with `eyJ…` (click "reveal")

Keep that tab open — you'll paste those values into `.env.local` in Step 3.

---

## Step 2 — Run the schema migrations

In the Supabase dashboard:

1. Go to **SQL Editor → New query**.
2. Open `supabase/migrations/001_initial_schema.sql` from this repo, copy all of it, paste into the SQL editor, click **Run**.
3. Open `supabase/migrations/002_rls_policies.sql`, copy all, paste, **Run**.

You should see "Success. No rows returned" for both. You can verify:

- Go to **Table Editor** — you'll see `members`, `subscriptions`, `books`, `orders`, `payments`, `publications`, `admins`, and others.
- Go to **Database → Extensions** — `pgcrypto` and `pg_trgm` should be enabled.

---

## Step 3 — Install and configure the app

```bash
pnpm install
cp .env.example .env.local
```

Now edit `.env.local`:

1. Paste the Project URL into `NEXT_PUBLIC_SUPABASE_URL`.
2. Paste the anon key into `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Paste the service_role key into `SUPABASE_SERVICE_ROLE_KEY`. **This key bypasses all security** — never commit `.env.local`, never paste the service role key anywhere public.
4. Generate an encryption key for PAN data:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
   Paste the output into `APP_ENCRYPTION_KEY`.
   **Save a copy of this value somewhere safe** (password manager).
   If you lose it, any PANs you've stored can never be decrypted again.
5. Leave Razorpay, MSG91, and Resend blank for now.

---

## Step 4 — Create the first admin user

```bash
pnpm seed
```

You'll be prompted for email, name, and password. The script creates a Supabase Auth user and links it to a row in the `admins` table.

---

## Step 5 — Start the dev server

```bash
pnpm dev
```

Open http://localhost:3000 — you'll be redirected to `/login`. Sign in with the admin credentials you just created.

You should land on the dashboard with zeros across the board (no members yet).

---

## Step 6 — Import the legacy member list

This is a one-time operation.

### 6a. Convert the `.doc` to `.docx`

```bash
soffice --headless --convert-to docx LIFE_MEMBER_LIST__MASTER__-_MAR_2016.doc
```

### 6b. Parse into a CSV

```bash
pip install python-docx
python scripts/parse_members_doc.py \
  --input LIFE_MEMBER_LIST__MASTER__-_MAR_2016.docx \
  --output members_parsed.csv
```

You'll see output like:
```
Parsing LIFE_MEMBER_LIST__MASTER__-_MAR_2016.docx...
  Found 630 unique member entries

Wrote members_parsed.csv
Confidence breakdown:
  high            609
  needs_review    15
  ok              6
```

### 6c. Review the CSV (recommended but optional)

Open `members_parsed.csv` in Excel/Numbers/Google Sheets. Sort by `parse_confidence` and look at the `needs_review` rows. Usually these are:

- USA addresses (no 6-digit PIN)
- Unusually long addresses that wrap weird
- Occasional garbage cells from the original document

Fix them in-place and save, or leave them — they'll still import, just with a note so the admin can clean them up later.

### 6d. Import into Supabase

```bash
pnpm import-members members_parsed.csv
```

This creates one member per row, assigns `LM-0001`, `LM-0002`, … codes, generates a unique access token for each, and creates a life-member subscription with no end date (matching your current setup).

Refresh http://localhost:3000/admin/members and you should see all ~630 members.

---

## Daily workflow (after setup)

The admin opens `/admin` and usually does one of three things:

1. **Record a payment** that came in as a cheque/cash/UPI:
   - Click the member → **Record payment** → fill form → save.
   - Receipt number auto-generates (e.g., `RCT/2026-27/00042`).
2. **Add a new member** who walked in or called:
   - **Members → New member** → fill form → save.
3. **Print the monthly mailing list**:
   - **Mailing list** → apply filters (language, active only) → **Generate PDF** → print.

---

## Project layout

```
supabase/migrations/     SQL to run on Supabase
scripts/                 One-off scripts (parser, seed, import)
src/
  app/
    (admin)/             Admin pages
    login/               Sign-in page
    api/                 Server-only routes (PDF generation, webhooks)
  components/
    ui/                  Button, Input, Card, etc.
    admin/               Admin-specific forms
  lib/
    supabase/            Database clients (server vs. service role)
    crypto/              PAN encryption (AES-256-GCM)
    pdf/                 PDF document components
  middleware.ts          Session refresh and /admin auth guard
```

---

## Backups

Supabase takes daily automatic backups on the free tier. In addition, export a full dump weekly:

- **Database → Backups** in the Supabase dashboard, or
- Command-line `pg_dump` using the connection string from **Project Settings → Database**.

Store those dumps in a Google Drive folder the trustees control.

---

## Security notes

- The `SUPABASE_SERVICE_ROLE_KEY` bypasses all row-level security. Only the Next.js server uses it. It must **never** be sent to the browser.
- `APP_ENCRYPTION_KEY` encrypts PAN data at rest. Losing this key means losing access to stored PANs — there's no recovery. Store a copy in a secure password manager.
- All admin actions write to the `audit_log` table. Query it anytime for an audit trail.
- Admin auth uses email + password. Strong passwords are your responsibility; consider enabling MFA from the Supabase dashboard.

---

## Troubleshooting

**"Not signed in" loops on /login:** check that `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set and that the admin user exists in both the `auth.users` table and the `admins` table.

**"APP_ENCRYPTION_KEY is not set" when saving a member with PAN:** regenerate and set the key as in Step 3.4, then restart `pnpm dev`.

**PDF download is blank or errors:** the React-PDF renderer runs on the Node runtime; check that your deployment isn't forcing edge runtime on `/api/admin/mailing-list-pdf/route.ts`.

**Import script fails on a row:** check the error — usually a duplicate name or malformed value. Fix the CSV and rerun (the importer only inserts; it doesn't dedupe, so you may want to delete members from the last run first).

---

## Next phases

See `ARCHITECTURE_v2.md` for the full plan. Roughly:

- **Phase 2** — Razorpay + `/m/[token]` status page + book catalogue + guest checkout
- **Phase 3** — Address change approvals, SMS/email reminders, 80G receipts
- **Phase 4** — Whatever the admin asks for after real usage
