# EDUCENTER PRO

Multi-tenant SaaS for private schools, tutoring centers, vocational/language centers and institutes (Morocco, FR/AR).

**Stack:** Next.js 15 (App Router, Server Actions) · Supabase (Postgres, Auth, Storage, RLS) · Tailwind CSS · deploys on Vercel.

## What's implemented (MVP)

| Area | Status |
|---|---|
| Auth (email/password, confirmation, reset), invitation-based onboarding | ✅ |
| Super Admin: create institution (auto-provisioned defaults per type), trials, suspend/reactivate/archive, subscription period, manual-payment review with proof, global usage stats | ✅ |
| Tenant isolation enforced in Postgres (RLS) + server-side role checks | ✅ tested |
| Students: CRUD, search/filter/pagination, duplicate detection, archive/restore, documents checklist, full profile (enrollments, payments, attendance, grades) | ✅ |
| Enrollment & renewal (reuses student record, history kept), one primary class + many groups | ✅ |
| Academic years (one active), levels, classes, groups (optional group fee), subjects (coefficients; deactivate keeps history) | ✅ |
| Teachers: accounts via invitation, assignments to class/group + subject | ✅ |
| Timetable with teacher / class / group overlap blocked by DB exclusion constraints | ✅ |
| Attendance (present/absent/late, minutes), teacher-scoped, no duplicates, admin correction, history | ✅ |
| Assessments, grades, observations (teacher-scoped) | ✅ |
| Monthly dues generation, partial payments, discounts, balances, overdue status, duplicate-payment protection, void/correct with reason (no deletion) | ✅ tested |
| Invoices & receipts with automatic numbering, printable / save as PDF in FR or AR | ✅ |
| Teacher remuneration (% by teacher or by group/class, collected vs due basis, no double counting), payouts, teacher sees summary only | ✅ tested |
| Expenses (categories, filters, void), cash movements (auto from payments/expenses/payouts + manual), theoretical balance | ✅ |
| Reports + CSV export (opens in Excel, UTF-8 BOM, `;` separator) | ✅ |
| Audit log of sensitive tables, viewable by admins | ✅ |
| Time-limited, tenant-granted, read-only support access for platform operators | ✅ tested |
| French / Arabic UI with RTL, responsive layout | ✅ |

### Not yet implemented
- **Online card payment** (needs a gateway + merchant account, e.g. CMI) — UI placeholder only.
- **Email / WhatsApp notifications** (needs an email provider and WhatsApp Business provider). The `notifications` table exists; auth emails are sent by Supabase.
- **Native Excel (.xlsx) and server-generated PDF** — CSV export and browser print-to-PDF are used instead.
- **Per-tenant backup/restore tooling** — Supabase provides daily backups (retention depends on plan; 30 days needs PITR/Pro add-ons). Per-tenant export/restore is a to-do.

## Architecture decision: tenant isolation

The PRD asks for *one database per institution*. This implementation uses **one Postgres database with a `tenant_id` on every row and Row Level Security** enforced in the database, which is the model Supabase is built for (one database per Supabase project; a project per tenant means separate billing, keys, migrations and connection pools per school).

Isolation is still enforced at the database layer, not only in app code:
- every table has RLS enabled; helper functions live in a non-exposed `private` schema;
- the platform Super Admin **cannot** read tenant educational/financial data unless the institution grants time-limited support access (read-only, audited);
- suspended tenants lose access but keep all data.

Every tenant row carries `tenant_id`, so moving a tenant to its own database later is a filtered export. If dedicated databases are a hard requirement (contractual or regulatory), that's a separate provisioning layer and should be decided before pilot.

## Setup

1. **Apply the migrations** to your Supabase project (SQL editor or `supabase db push`), in order:
   - `supabase/migrations/20261104000001_core_schema.sql`
   - `supabase/migrations/20261104000002_security_and_logic.sql`
2. **Make yourself platform admin** (SQL editor):
   ```sql
   insert into public.platform_admin_invites(email) values ('you@example.com');
   ```
   Then sign up in the app with that email and confirm it.
3. **Supabase Auth settings** → URL configuration: set the Site URL to your deployed URL and add `https://<your-domain>/auth/callback` to the redirect URLs.
4. **Environment variables** (Vercel project settings or `.env.local`): see `.env.example`.
5. `npm install && npm run dev`

## Onboarding flow
1. Super Admin creates an institution (name, slug, type, admin email). Defaults (active academic year, levels, payment methods, expense categories, document checklist) are seeded according to the type.
2. The institution admin signs up with that email; on first sign-in the invitation turns into membership.
3. The admin adds teachers with an email and clicks **Send invitation**; teachers sign up the same way and see only their assigned classes and groups.

## Testing the database
`supabase/tests/rls_and_finance.sql` runs 49 checks on tenant isolation, teacher scoping, payment integrity, remuneration and support access. To run it on a throwaway Postgres 15+:
```bash
psql -d test -f supabase/tests/supabase_stub.sql
psql -d test -f supabase/migrations/20261104000001_core_schema.sql
psql -d test -f supabase/migrations/20261104000002_security_and_logic.sql
psql -d test -f supabase/tests/rls_and_finance.sql   # ends with "ALL TESTS PASSED"
```
