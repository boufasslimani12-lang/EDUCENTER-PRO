-- EDUCENTER PRO — core schema
-- Tenancy model: every tenant-owned row carries tenant_id; isolation is enforced by
-- Postgres Row Level Security using helper functions in the non-exposed `private` schema.

create extension if not exists btree_gist with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- ───────────────────────── Enums ─────────────────────────
create type public.institution_type as enum
  ('private_school','tutoring_center','vocational_center','language_center','professional_institute');
create type public.tenant_status as enum
  ('pending_setup','trial_active','subscription_active','renewal_pending','grace_period','suspended','archived');
create type public.member_role as enum ('admin','teacher');
create type public.attendance_status as enum ('present','absent','late');
create type public.cash_direction as enum ('in','out');
create type public.remuneration_basis as enum ('collected','due');
create type public.sub_payment_method as enum ('bank_transfer','card');
create type public.sub_payment_status as enum ('pending','approved','rejected');
create type public.enrollment_status as enum ('active','withdrawn','completed');

-- ───────────────────────── Platform (central) ─────────────────────────
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  type public.institution_type not null,
  status public.tenant_status not null default 'pending_setup',
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  billing_interval text not null default 'monthly' check (billing_interval in ('monthly','annual')),
  grace_days int not null default 7 check (grace_days between 0 and 60),
  email text, phone text, address text, city text, logo_url text,
  default_locale text not null default 'fr' check (default_locale in ('fr','ar')),
  currency text not null default 'MAD',
  default_monthly_fee numeric(12,2) not null default 0 check (default_monthly_fee >= 0),
  modules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Emails that become platform admins once they sign in with a confirmed address.
create table public.platform_admin_invites (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null,
  teacher_id uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);
create index on public.memberships(user_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null check (email = lower(email)),
  role public.member_role not null,
  teacher_id uuid,
  created_by uuid references auth.users(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index invitations_pending_uq on public.invitations(tenant_id, email) where accepted_at is null;
create index on public.invitations(email) where accepted_at is null;

-- Explicit, time-limited, tenant-granted support access for platform operators.
create table public.support_access_grants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  granted_by uuid not null references auth.users(id),
  reason text not null check (length(reason) >= 5),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at <= created_at + interval '7 days')
);

create table public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  period_months int not null check (period_months in (1,12)),
  method public.sub_payment_method not null,
  reference text,
  proof_path text,
  status public.sub_payment_status not null default 'pending',
  gateway_reference text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.subscription_payments(tenant_id, created_at desc);

create table public.audit_log (
  id bigint generated always as identity primary key,
  tenant_id uuid,
  actor_id uuid,
  table_name text not null,
  record_id uuid,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index on public.audit_log(tenant_id, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications(user_id, created_at desc);

-- ───────────────────────── Tenant: academic structure ─────────────────────────
create table public.academic_years (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  starts_on date not null,
  ends_on date not null,
  is_active boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_on > starts_on),
  unique (tenant_id, name)
);
create unique index academic_years_one_active on public.academic_years(tenant_id) where is_active;

create table public.levels (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  coefficient numeric(5,2) check (coefficient is null or coefficient > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id),
  level_id uuid references public.levels(id),
  name text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, academic_year_id, name)
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id),
  subject_id uuid references public.subjects(id),
  level_id uuid references public.levels(id),
  name text not null,
  monthly_fee numeric(12,2) check (monthly_fee is null or monthly_fee >= 0),
  created_at timestamptz not null default now(),
  unique (tenant_id, academic_year_id, name)
);

create table public.teachers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  full_name text not null,
  email text check (email is null or email = lower(email)),
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index teachers_email_uq on public.teachers(tenant_id, email) where email is not null;
alter table public.memberships add constraint memberships_teacher_fk foreign key (teacher_id) references public.teachers(id) on delete set null;
alter table public.invitations add constraint invitations_teacher_fk foreign key (teacher_id) references public.teachers(id) on delete cascade;

create table public.teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  subject_id uuid references public.subjects(id),
  created_at timestamptz not null default now(),
  check (num_nonnulls(class_id, group_id) = 1)
);
create unique index teacher_assignments_uq on public.teacher_assignments
  (teacher_id, coalesce(class_id, group_id), coalesce(subject_id, '00000000-0000-0000-0000-000000000000'));
create index on public.teacher_assignments(tenant_id, teacher_id);

-- ───────────────────────── Students & enrollment ─────────────────────────
create table public.students (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text,
  first_name text not null check (length(trim(first_name)) > 0),
  last_name text not null check (length(trim(last_name)) > 0),
  birth_date date,
  gender text check (gender in ('m','f')),
  phone text, email text, address text,
  guardian_name text, guardian_phone text, guardian_relation text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index students_code_uq on public.students(tenant_id, code) where code is not null;
-- Duplicate detection: same normalized name + birth date in one institution.
create unique index students_identity_uq on public.students
  (tenant_id, lower(trim(first_name)), lower(trim(last_name)), birth_date) where birth_date is not null;
create index students_search_idx on public.students(tenant_id, lower(last_name), lower(first_name));

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.students(id),
  academic_year_id uuid not null references public.academic_years(id),
  class_id uuid references public.classes(id),
  monthly_fee numeric(12,2) not null default 0 check (monthly_fee >= 0),
  monthly_discount numeric(12,2) not null default 0 check (monthly_discount >= 0),
  status public.enrollment_status not null default 'active',
  enrolled_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (student_id, academic_year_id)
);
create index on public.enrollments(tenant_id, academic_year_id, class_id);

create table public.student_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  group_id uuid not null references public.groups(id),
  created_at timestamptz not null default now(),
  unique (enrollment_id, group_id)
);
create index on public.student_groups(group_id);

create table public.document_requirements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  unique (tenant_id, name)
);

create table public.student_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  requirement_id uuid not null references public.document_requirements(id) on delete cascade,
  received boolean not null default false,
  received_on date,
  unique (student_id, requirement_id)
);

-- ───────────────────────── Timetable ─────────────────────────
create table public.timetable_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id),
  class_id uuid references public.classes(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  subject_id uuid not null references public.subjects(id),
  teacher_id uuid not null references public.teachers(id),
  weekday smallint not null check (weekday between 1 and 7),
  starts_at time not null,
  ends_at time not null,
  slot tsrange generated always as (tsrange('2000-01-01'::date + starts_at, '2000-01-01'::date + ends_at, '[)')) stored,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (num_nonnulls(class_id, group_id) = 1),
  constraint timetable_teacher_overlap exclude using gist (teacher_id with =, weekday with =, slot with &&),
  constraint timetable_class_overlap exclude using gist (class_id with =, weekday with =, slot with &&) where (class_id is not null),
  constraint timetable_group_overlap exclude using gist (group_id with =, weekday with =, slot with &&) where (group_id is not null)
);

-- ───────────────────────── Attendance & grades ─────────────────────────
create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  session_date date not null,
  class_id uuid references public.classes(id),
  group_id uuid references public.groups(id),
  timetable_entry_id uuid references public.timetable_entries(id) on delete set null,
  student_id uuid not null references public.students(id),
  status public.attendance_status not null,
  minutes_late int check (minutes_late is null or minutes_late >= 0),
  note text,
  recorded_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(class_id, group_id) = 1)
);
create unique index attendance_unique_session on public.attendance_records
  (student_id, session_date, coalesce(class_id, group_id), coalesce(timetable_entry_id, '00000000-0000-0000-0000-000000000000'));
create index on public.attendance_records(tenant_id, session_date);

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id),
  subject_id uuid not null references public.subjects(id),
  class_id uuid references public.classes(id),
  group_id uuid references public.groups(id),
  title text not null,
  held_on date not null default current_date,
  max_score numeric(6,2) not null default 20 check (max_score > 0),
  coefficient numeric(5,2) not null default 1 check (coefficient > 0),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (num_nonnulls(class_id, group_id) = 1)
);

create table public.grades (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  student_id uuid not null references public.students(id),
  score numeric(6,2) check (score is null or score >= 0),
  observation text,
  updated_at timestamptz not null default now(),
  unique (assessment_id, student_id)
);

create table public.observations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.students(id),
  class_id uuid references public.classes(id),
  group_id uuid references public.groups(id),
  author_id uuid default auth.uid(),
  body text not null,
  created_at timestamptz not null default now()
);

-- ───────────────────────── Finance ─────────────────────────
create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  unique (tenant_id, name)
);

create table public.document_counters (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  doc_type text not null,
  year int not null,
  last_no int not null default 0,
  primary key (tenant_id, doc_type, year)
);

-- Monthly dues (one per enrollment per month) = invoice.
create table public.installments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id),
  student_id uuid not null references public.students(id),
  period date not null check (extract(day from period) = 1),
  amount_due numeric(12,2) not null check (amount_due >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  invoice_no text,
  due_on date not null,
  created_at timestamptz not null default now(),
  check (discount <= amount_due),
  unique (enrollment_id, period)
);
create index on public.installments(tenant_id, period);
create index on public.installments(student_id);

-- Revenue attribution of an installment to class / group (basis for teacher remuneration).
create table public.installment_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  installment_id uuid not null references public.installments(id) on delete cascade,
  class_id uuid references public.classes(id),
  group_id uuid references public.groups(id),
  label text not null,
  amount numeric(12,2) not null check (amount >= 0)
);
create index on public.installment_lines(installment_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  installment_id uuid not null references public.installments(id),
  student_id uuid not null references public.students(id),
  amount numeric(12,2) not null check (amount > 0),
  method text not null,
  paid_on date not null default current_date,
  reference text,
  receipt_no text,
  idempotency_key uuid not null unique,
  corrects_payment_id uuid references public.payments(id),
  voided_at timestamptz,
  voided_by uuid,
  void_reason text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.payments(tenant_id, paid_on);
create index on public.payments(installment_id);

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  unique (tenant_id, name)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  category_id uuid not null references public.expense_categories(id),
  amount numeric(12,2) not null check (amount > 0),
  spent_on date not null default current_date,
  beneficiary text not null,
  method text not null,
  reference text,
  description text,
  voided_at timestamptz,
  voided_by uuid,
  void_reason text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.expenses(tenant_id, spent_on);

create table public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  direction public.cash_direction not null,
  amount numeric(12,2) not null check (amount > 0),
  method text not null,
  occurred_on date not null default current_date,
  description text not null,
  payment_id uuid references public.payments(id),
  expense_id uuid references public.expenses(id),
  reverses_id uuid references public.cash_movements(id),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.cash_movements(tenant_id, occurred_on);

create table public.remuneration_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  percentage numeric(5,2) not null check (percentage between 0 and 100),
  basis public.remuneration_basis not null default 'collected',
  created_at timestamptz not null default now(),
  check (num_nonnulls(class_id, group_id) <= 1)
);
create unique index remuneration_rules_uq on public.remuneration_rules
  (teacher_id, coalesce(class_id, group_id, '00000000-0000-0000-0000-000000000000'));

create table public.remuneration_statements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id),
  period date not null check (extract(day from period) = 1),
  calculated_amount numeric(12,2) not null default 0,
  details jsonb not null default '[]'::jsonb,
  calculated_at timestamptz not null default now(),
  unique (teacher_id, period)
);

create table public.remuneration_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  statement_id uuid not null references public.remuneration_statements(id),
  amount numeric(12,2) not null check (amount > 0),
  method text not null,
  paid_on date not null default current_date,
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
