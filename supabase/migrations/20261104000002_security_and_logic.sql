-- EDUCENTER PRO — access helpers, business logic, audit, RLS

-- ───────────────────────── Tenant lifecycle ─────────────────────────
create or replace function public.tenant_effective_status(t public.tenants)
returns public.tenant_status language sql stable set search_path = '' as $$
  select case
    when t.status in ('archived','suspended','pending_setup') then t.status
    when t.status = 'trial_active' then
      case when t.trial_ends_at > now() then 'trial_active'::public.tenant_status
           else 'suspended'::public.tenant_status end
    else case
      when t.current_period_end is null then 'suspended'::public.tenant_status
      when now() <= t.current_period_end - interval '7 days' then 'subscription_active'::public.tenant_status
      when now() <= t.current_period_end then 'renewal_pending'::public.tenant_status
      when now() <= t.current_period_end + make_interval(days => t.grace_days) then 'grace_period'::public.tenant_status
      else 'suspended'::public.tenant_status end
  end
$$;

-- ───────────────────────── Access helpers (private, security definer) ─────────────────────────
create or replace function private.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()))
$$;

create or replace function private.has_role(tid uuid, roles public.member_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m join public.tenants t on t.id = m.tenant_id
    where m.tenant_id = tid and m.user_id = (select auth.uid()) and m.is_active
      and m.role = any(roles)
      and public.tenant_effective_status(t) in ('trial_active','subscription_active','renewal_pending','grace_period'))
$$;

create or replace function private.is_admin(tid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role(tid, array['admin']::public.member_role[])
$$;

create or replace function private.is_member(tid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role(tid, array['admin','teacher']::public.member_role[])
$$;

-- Any membership (even if tenant suspended) — used for tenant record, billing.
create or replace function private.belongs_to(tid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m where m.tenant_id = tid and m.user_id = (select auth.uid()) and m.is_active)
$$;

create or replace function private.belongs_as_admin(tid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m where m.tenant_id = tid and m.user_id = (select auth.uid()) and m.is_active and m.role = 'admin')
$$;

create or replace function private.has_support_access(tid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_platform_admin() and exists (
    select 1 from public.support_access_grants g
    where g.tenant_id = tid and g.revoked_at is null and g.expires_at > now())
$$;

create or replace function private.current_teacher_id(tid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select m.teacher_id from public.memberships m
  where m.tenant_id = tid and m.user_id = (select auth.uid()) and m.role = 'teacher' and m.is_active
  limit 1
$$;

create or replace function private.teacher_has_class(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.teacher_assignments a join public.memberships m
      on m.teacher_id = a.teacher_id and m.user_id = (select auth.uid()) and m.is_active and m.role = 'teacher'
    where a.class_id = cid and private.is_member(a.tenant_id))
$$;

create or replace function private.teacher_has_group(gid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.teacher_assignments a join public.memberships m
      on m.teacher_id = a.teacher_id and m.user_id = (select auth.uid()) and m.is_active and m.role = 'teacher'
    where a.group_id = gid and private.is_member(a.tenant_id))
$$;

create or replace function private.teacher_has_scope(cid uuid, gid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case when cid is not null then private.teacher_has_class(cid)
              when gid is not null then private.teacher_has_group(gid) else false end
$$;

create or replace function private.teacher_can_see_student(sid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.enrollments e
    where e.student_id = sid and e.status = 'active'
      and (private.teacher_has_class(e.class_id)
           or exists (select 1 from public.student_groups sg where sg.enrollment_id = e.id and private.teacher_has_group(sg.group_id))))
$$;

create or replace function private.student_in_scope(sid uuid, cid uuid, gid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.enrollments e
    where e.student_id = sid and e.status = 'active'
      and ((cid is not null and e.class_id = cid)
        or (gid is not null and exists (select 1 from public.student_groups sg where sg.enrollment_id = e.id and sg.group_id = gid))))
$$;

grant execute on all functions in schema private to authenticated;

-- ───────────────────────── Generic triggers ─────────────────────────
create or replace function private.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

create trigger tenants_touch before update on public.tenants for each row execute function private.touch_updated_at();
create trigger students_touch before update on public.students for each row execute function private.touch_updated_at();
create trigger attendance_touch before update on public.attendance_records for each row execute function private.touch_updated_at();
create trigger grades_touch before update on public.grades for each row execute function private.touch_updated_at();

create or replace function private.audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r jsonb := to_jsonb(coalesce(new, old));
  v_tenant uuid;
begin
  v_tenant := case when tg_table_name = 'tenants' then (r->>'id')::uuid else (r->>'tenant_id')::uuid end;
  insert into public.audit_log(tenant_id, actor_id, table_name, record_id, action, old_data, new_data)
  values (v_tenant, auth.uid(), tg_table_name, (r->>'id')::uuid, tg_op,
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['tenants','memberships','invitations','support_access_grants','subscription_payments',
    'students','enrollments','student_groups','academic_years','classes','groups','subjects','teachers',
    'teacher_assignments','timetable_entries','attendance_records','grades','installments','payments',
    'expenses','expense_categories','cash_movements','remuneration_rules','remuneration_statements',
    'remuneration_payments','payment_methods','document_requirements']
  loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.audit()', t || '_audit', t);
  end loop;
end $$;

-- Financial records can never be deleted.
create or replace function private.forbid_delete() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'Financial records cannot be deleted; void or correct them instead' using errcode = 'P0001'; end $$;
create trigger payments_no_delete before delete on public.payments for each row execute function private.forbid_delete();
create trigger expenses_no_delete before delete on public.expenses for each row execute function private.forbid_delete();
create trigger cash_no_delete before delete on public.cash_movements for each row execute function private.forbid_delete();
create trigger installments_no_delete before delete on public.installments for each row execute function private.forbid_delete();
create trigger rempay_no_delete before delete on public.remuneration_payments for each row execute function private.forbid_delete();

-- Tenants: only platform admins may change lifecycle / type fields.
create or replace function private.guard_tenant_update() returns trigger language plpgsql set search_path = '' as $$
begin
  if not private.is_platform_admin() and (
       new.status is distinct from old.status or new.type is distinct from old.type
    or new.trial_ends_at is distinct from old.trial_ends_at or new.current_period_end is distinct from old.current_period_end
    or new.grace_days is distinct from old.grace_days or new.slug is distinct from old.slug
    or new.billing_interval is distinct from old.billing_interval) then
    raise exception 'Only platform administrators can change subscription or lifecycle fields';
  end if;
  return new;
end $$;
create trigger tenants_guard before update on public.tenants for each row execute function private.guard_tenant_update();

-- ───────────────────────── Document numbering ─────────────────────────
create or replace function private.next_doc_number(tid uuid, doc text, prefix text) returns text
language plpgsql security definer set search_path = '' as $$
declare y int := extract(year from now())::int; n int;
begin
  insert into public.document_counters(tenant_id, doc_type, year, last_no) values (tid, doc, y, 1)
  on conflict (tenant_id, doc_type, year) do update set last_no = public.document_counters.last_no + 1
  returning last_no into n;
  return prefix || '-' || y || '-' || lpad(n::text, 6, '0');
end $$;

-- ───────────────────────── Payments ─────────────────────────
create or replace function private.before_payment_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare i public.installments; paid numeric;
begin
  select * into i from public.installments where id = new.installment_id for update;
  if i.id is null or i.tenant_id <> new.tenant_id then raise exception 'Invalid installment'; end if;
  select coalesce(sum(amount), 0) into paid from public.payments where installment_id = i.id and voided_at is null;
  if new.amount > (i.amount_due - i.discount - paid) then
    raise exception 'Payment exceeds outstanding balance (%.2f)', (i.amount_due - i.discount - paid) using errcode = 'P0002';
  end if;
  new.student_id := i.student_id;
  new.voided_at := null; new.voided_by := null; new.void_reason := null;
  new.created_by := auth.uid();
  new.receipt_no := private.next_doc_number(new.tenant_id, 'receipt', 'REC');
  return new;
end $$;
create trigger payments_before_insert before insert on public.payments for each row execute function private.before_payment_insert();

create or replace function private.guard_payment_update() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.voided_at is not null then raise exception 'Voided payments are immutable'; end if;
  if (to_jsonb(new) - array['voided_at','voided_by','void_reason']) <> (to_jsonb(old) - array['voided_at','voided_by','void_reason']) then
    raise exception 'Payments can only be voided; record a correcting payment instead';
  end if;
  if new.voided_at is not null and coalesce(length(trim(new.void_reason)), 0) < 3 then
    raise exception 'A correction reason is required';
  end if;
  new.voided_by := auth.uid();
  return new;
end $$;
create trigger payments_guard_update before update on public.payments for each row execute function private.guard_payment_update();

create or replace function private.payment_cash() returns trigger
language plpgsql security definer set search_path = '' as $$
declare cm uuid;
begin
  if tg_op = 'INSERT' then
    insert into public.cash_movements(tenant_id, direction, amount, method, occurred_on, description, payment_id, created_by)
    values (new.tenant_id, 'in', new.amount, new.method, new.paid_on, 'Paiement ' || new.receipt_no, new.id, auth.uid());
  elsif new.voided_at is not null and old.voided_at is null then
    select id into cm from public.cash_movements where payment_id = new.id and reverses_id is null limit 1;
    insert into public.cash_movements(tenant_id, direction, amount, method, occurred_on, description, payment_id, reverses_id, created_by)
    values (new.tenant_id, 'out', new.amount, new.method, current_date, 'Annulation ' || new.receipt_no || ': ' || new.void_reason, new.id, cm, auth.uid());
  end if;
  return new;
end $$;
create trigger payments_cash after insert or update on public.payments for each row execute function private.payment_cash();

create or replace function private.guard_expense_update() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.voided_at is not null then raise exception 'Voided expenses are immutable'; end if;
  if (to_jsonb(new) - array['voided_at','voided_by','void_reason']) <> (to_jsonb(old) - array['voided_at','voided_by','void_reason']) then
    raise exception 'Expenses can only be voided; record a new expense instead';
  end if;
  if new.voided_at is not null and coalesce(length(trim(new.void_reason)), 0) < 3 then
    raise exception 'A correction reason is required';
  end if;
  new.voided_by := auth.uid();
  return new;
end $$;
create trigger expenses_guard_update before update on public.expenses for each row execute function private.guard_expense_update();

create or replace function private.expense_cash() returns trigger
language plpgsql security definer set search_path = '' as $$
declare cm uuid;
begin
  if tg_op = 'INSERT' then
    insert into public.cash_movements(tenant_id, direction, amount, method, occurred_on, description, expense_id, created_by)
    values (new.tenant_id, 'out', new.amount, new.method, new.spent_on, 'Dépense: ' || new.beneficiary, new.id, auth.uid());
  elsif new.voided_at is not null and old.voided_at is null then
    select id into cm from public.cash_movements where expense_id = new.id and reverses_id is null limit 1;
    insert into public.cash_movements(tenant_id, direction, amount, method, occurred_on, description, expense_id, reverses_id, created_by)
    values (new.tenant_id, 'in', new.amount, new.method, current_date, 'Annulation dépense: ' || new.void_reason, new.id, cm, auth.uid());
  end if;
  return new;
end $$;
create trigger expenses_cash after insert or update on public.expenses for each row execute function private.expense_cash();

create or replace function private.rempay_cash() returns trigger
language plpgsql security definer set search_path = '' as $$
declare tname text;
begin
  select t.full_name into tname from public.remuneration_statements s join public.teachers t on t.id = s.teacher_id where s.id = new.statement_id;
  insert into public.cash_movements(tenant_id, direction, amount, method, occurred_on, description, created_by)
  values (new.tenant_id, 'out', new.amount, new.method, new.paid_on, 'Rémunération: ' || coalesce(tname, ''), auth.uid());
  return new;
end $$;
create trigger rempay_cash after insert on public.remuneration_payments for each row execute function private.rempay_cash();

-- Cash movements are append-only.
create or replace function private.forbid_update() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'This record is append-only'; end $$;
create trigger cash_no_update before update on public.cash_movements for each row execute function private.forbid_update();
create trigger rempay_no_update before update on public.remuneration_payments for each row execute function private.forbid_update();

-- ───────────────────────── Attendance integrity ─────────────────────────
create or replace function private.check_attendance() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not private.student_in_scope(new.student_id, new.class_id, new.group_id) then
    raise exception 'Student is not enrolled in this class/group';
  end if;
  new.recorded_by := auth.uid();
  return new;
end $$;
create trigger attendance_check before insert or update on public.attendance_records for each row execute function private.check_attendance();

-- ───────────────────────── Views ─────────────────────────
create or replace view public.installment_balances with (security_invoker = true) as
select i.*,
  coalesce(p.paid, 0)::numeric(12,2) as amount_paid,
  (i.amount_due - i.discount - coalesce(p.paid, 0))::numeric(12,2) as balance,
  case when i.amount_due - i.discount - coalesce(p.paid, 0) <= 0 then 'paid'
       when coalesce(p.paid, 0) > 0 then case when i.due_on < current_date then 'overdue_partial' else 'partial' end
       when i.due_on < current_date then 'overdue' else 'unpaid' end as payment_status
from public.installments i
left join lateral (select sum(amount) paid from public.payments where installment_id = i.id and voided_at is null) p on true;

-- ───────────────────────── RPCs ─────────────────────────
-- Platform: create an institution with defaults and an admin invitation.
create or replace function public.provision_tenant(
  p_name text, p_slug text, p_type public.institution_type, p_admin_email text,
  p_trial_days int default 7, p_locale text default 'fr')
returns uuid language plpgsql security definer set search_path = '' as $$
declare tid uuid; uid uuid; y int := extract(year from now())::int; m int := extract(month from now())::int; ys int;
begin
  if not private.is_platform_admin() then raise exception 'Forbidden'; end if;
  insert into public.tenants(name, slug, type, status, trial_ends_at, default_locale, modules)
  values (p_name, lower(p_slug), p_type, 'trial_active', now() + make_interval(days => p_trial_days), p_locale,
          jsonb_build_object('attendance', true, 'grades', true, 'timetable', true, 'payments', true,
                             'remuneration', true, 'expenses', true, 'documents', p_type <> 'tutoring_center'))
  returning id into tid;

  ys := case when m >= 8 then y else y - 1 end;
  insert into public.academic_years(tenant_id, name, starts_on, ends_on, is_active)
  values (tid, ys || '-' || (ys + 1), make_date(ys, 9, 1), make_date(ys + 1, 7, 31), true);

  insert into public.payment_methods(tenant_id, name) values (tid, 'Espèces'), (tid, 'Virement'), (tid, 'Chèque'), (tid, 'Carte');
  insert into public.expense_categories(tenant_id, name)
  values (tid, 'Loyer'), (tid, 'Salaires'), (tid, 'Électricité & eau'), (tid, 'Internet & téléphone'), (tid, 'Fournitures'), (tid, 'Marketing'), (tid, 'Autre');

  if p_type = 'private_school' then
    insert into public.levels(tenant_id, name, sort_order) values
      (tid,'Préscolaire',0),(tid,'1AP',1),(tid,'2AP',2),(tid,'3AP',3),(tid,'4AP',4),(tid,'5AP',5),(tid,'6AP',6),
      (tid,'1AC',7),(tid,'2AC',8),(tid,'3AC',9),(tid,'TC',10),(tid,'1BAC',11),(tid,'2BAC',12);
    insert into public.document_requirements(tenant_id, name) values
      (tid,'Acte de naissance'),(tid,'Certificat de scolarité'),(tid,'Photos d''identité'),(tid,'Certificat médical');
  elsif p_type = 'tutoring_center' then
    insert into public.levels(tenant_id, name, sort_order) values
      (tid,'Primaire',1),(tid,'Collège',2),(tid,'Tronc commun',3),(tid,'1ère Bac',4),(tid,'2ème Bac',5);
  elsif p_type = 'language_center' then
    insert into public.levels(tenant_id, name, sort_order) values
      (tid,'A1',1),(tid,'A2',2),(tid,'B1',3),(tid,'B2',4),(tid,'C1',5),(tid,'C2',6);
    insert into public.document_requirements(tenant_id, name) values (tid,'Copie CIN'),(tid,'Photo d''identité');
  else
    insert into public.levels(tenant_id, name, sort_order) values (tid,'1ère année',1),(tid,'2ème année',2);
    insert into public.document_requirements(tenant_id, name) values
      (tid,'Copie CIN'),(tid,'Copie du diplôme'),(tid,'Photos d''identité');
  end if;

  select id into uid from auth.users where lower(email) = lower(p_admin_email) and email_confirmed_at is not null;
  if uid is not null then
    insert into public.memberships(tenant_id, user_id, role) values (tid, uid, 'admin');
    insert into public.invitations(tenant_id, email, role, created_by, accepted_at) values (tid, lower(p_admin_email), 'admin', auth.uid(), now());
  else
    insert into public.invitations(tenant_id, email, role, created_by) values (tid, lower(p_admin_email), 'admin', auth.uid());
  end if;
  return tid;
end $$;

-- Called after sign-in: turns pending invitations for the confirmed email into memberships.
create or replace function public.claim_invitations() returns int
language plpgsql security definer set search_path = '' as $$
declare v_email text; n int := 0; inv record;
begin
  select lower(email) into v_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if v_email is null then return 0; end if;

  if exists (select 1 from public.platform_admin_invites where email = v_email) then
    insert into public.platform_admins(user_id) values (auth.uid()) on conflict do nothing;
  end if;

  for inv in select * from public.invitations where email = v_email and accepted_at is null for update loop
    insert into public.memberships(tenant_id, user_id, role, teacher_id)
    values (inv.tenant_id, auth.uid(), inv.role, inv.teacher_id)
    on conflict (tenant_id, user_id) do update set role = excluded.role, teacher_id = excluded.teacher_id, is_active = true;
    update public.invitations set accepted_at = now() where id = inv.id;
    n := n + 1;
  end loop;
  return n;
end $$;

-- Admin: invite a teacher (creates invitation linked to teacher record).
create or replace function public.invite_teacher(p_teacher_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare t public.teachers; uid uuid;
begin
  select * into t from public.teachers where id = p_teacher_id;
  if t.id is null or not private.is_admin(t.tenant_id) then raise exception 'Forbidden'; end if;
  if t.email is null then raise exception 'Teacher has no email'; end if;
  select id into uid from auth.users where lower(email) = t.email and email_confirmed_at is not null;
  if uid is not null then
    insert into public.memberships(tenant_id, user_id, role, teacher_id) values (t.tenant_id, uid, 'teacher', t.id)
    on conflict (tenant_id, user_id) do nothing;
  else
    insert into public.invitations(tenant_id, email, role, teacher_id, created_by)
    values (t.tenant_id, t.email, 'teacher', t.id, auth.uid())
    on conflict (tenant_id, email) where accepted_at is null do update set teacher_id = excluded.teacher_id;
  end if;
end $$;

-- Admin: generate monthly dues for all active enrollments of the active academic year.
create or replace function public.generate_installments(p_tenant uuid, p_period date) returns int
language plpgsql security invoker set search_path = '' as $$
declare e record; iid uuid; total numeric; n int := 0; per date := date_trunc('month', p_period)::date;
begin
  if not private.is_admin(p_tenant) then raise exception 'Forbidden'; end if;
  for e in
    select en.*, c.name as class_name from public.enrollments en
    join public.academic_years ay on ay.id = en.academic_year_id and ay.is_active
    left join public.classes c on c.id = en.class_id
    where en.tenant_id = p_tenant and en.status = 'active'
      and en.enrolled_on < (per + interval '1 month')
      and not exists (select 1 from public.installments i where i.enrollment_id = en.id and i.period = per)
  loop
    select e.monthly_fee + coalesce(sum(g.monthly_fee), 0) into total
    from public.student_groups sg join public.groups g on g.id = sg.group_id
    where sg.enrollment_id = e.id;
    if total <= 0 then continue; end if;

    insert into public.installments(tenant_id, enrollment_id, student_id, period, amount_due, discount, due_on, invoice_no)
    values (p_tenant, e.id, e.student_id, per, total, least(e.monthly_discount, total), per + 9,
            private.next_doc_number(p_tenant, 'invoice', 'FAC'))
    returning id into iid;

    if e.monthly_fee > 0 then
      insert into public.installment_lines(tenant_id, installment_id, class_id, label, amount)
      values (p_tenant, iid, e.class_id, coalesce(e.class_name, 'Frais mensuels'), e.monthly_fee);
    end if;
    insert into public.installment_lines(tenant_id, installment_id, group_id, label, amount)
    select p_tenant, iid, g.id, g.name, g.monthly_fee
    from public.student_groups sg join public.groups g on g.id = sg.group_id
    where sg.enrollment_id = e.id and coalesce(g.monthly_fee, 0) > 0;
    n := n + 1;
  end loop;
  return n;
end $$;

-- Admin: re-enroll an existing student into a (new) academic year, reusing the student record.
create or replace function public.reenroll_student(
  p_student uuid, p_year uuid, p_class uuid, p_fee numeric, p_discount numeric, p_groups uuid[])
returns uuid language plpgsql security invoker set search_path = '' as $$
declare s public.students; eid uuid; g uuid;
begin
  select * into s from public.students where id = p_student;
  if s.id is null or not private.is_admin(s.tenant_id) then raise exception 'Forbidden'; end if;
  update public.enrollments set status = 'completed'
   where student_id = p_student and academic_year_id <> p_year and status = 'active';
  insert into public.enrollments(tenant_id, student_id, academic_year_id, class_id, monthly_fee, monthly_discount)
  values (s.tenant_id, p_student, p_year, p_class, coalesce(p_fee, 0), coalesce(p_discount, 0))
  on conflict (student_id, academic_year_id) do update
    set class_id = excluded.class_id, monthly_fee = excluded.monthly_fee,
        monthly_discount = excluded.monthly_discount, status = 'active'
  returning id into eid;
  delete from public.student_groups where enrollment_id = eid and not (group_id = any(coalesce(p_groups, '{}')));
  foreach g in array coalesce(p_groups, '{}') loop
    insert into public.student_groups(tenant_id, enrollment_id, group_id) values (s.tenant_id, eid, g)
    on conflict do nothing;
  end loop;
  update public.students set archived_at = null where id = p_student;
  return eid;
end $$;

-- Admin: compute teacher remuneration for a month without double counting revenue.
-- Each MAD of an installment is attributed to exactly one bucket (class or group); a teacher
-- assigned several times to the same bucket (e.g. several subjects) is counted once.
create or replace function public.calculate_remuneration(p_tenant uuid, p_period date) returns int
language plpgsql security invoker set search_path = '' as $$
declare per date := date_trunc('month', p_period)::date; n int;
begin
  if not private.is_admin(p_tenant) then raise exception 'Forbidden'; end if;
  with lines as (
    select l.class_id, l.group_id, l.amount, i.amount_due, i.discount,
      coalesce((select sum(p.amount) from public.payments p where p.installment_id = i.id and p.voided_at is null), 0) as paid
    from public.installment_lines l join public.installments i on i.id = l.installment_id
    where i.tenant_id = p_tenant and i.period = per and i.amount_due > 0
  ), buckets as (
    select class_id, group_id,
      sum(amount * (amount_due - discount) / amount_due) as due_rev,
      sum(amount * paid / amount_due) as collected_rev
    from lines group by class_id, group_id
  ), pairs as (
    select distinct a.teacher_id, b.class_id, b.group_id, b.due_rev, b.collected_rev
    from buckets b join public.teacher_assignments a on a.tenant_id = p_tenant
      and ((b.group_id is not null and a.group_id = b.group_id) or (b.class_id is not null and a.class_id = b.class_id))
  ), priced as (
    select p.*, r.percentage, r.basis
    from pairs p
    join lateral (
      select rr.percentage, rr.basis from public.remuneration_rules rr
      where rr.teacher_id = p.teacher_id
        and (rr.group_id = p.group_id or rr.class_id = p.class_id or (rr.group_id is null and rr.class_id is null))
      order by (rr.group_id is null and rr.class_id is null) limit 1) r on true
  ), per_teacher as (
    select pr.teacher_id,
      round(sum(pr.percentage / 100 * case when pr.basis = 'due' then pr.due_rev else pr.collected_rev end), 2) as amount,
      jsonb_agg(jsonb_build_object(
        'class_id', pr.class_id, 'group_id', pr.group_id,
        'label', coalesce(c.name, g.name), 'basis', pr.basis, 'percentage', pr.percentage,
        'revenue', round(case when pr.basis = 'due' then pr.due_rev else pr.collected_rev end, 2),
        'amount', round(pr.percentage / 100 * case when pr.basis = 'due' then pr.due_rev else pr.collected_rev end, 2))) as details
    from priced pr
    left join public.classes c on c.id = pr.class_id
    left join public.groups g on g.id = pr.group_id
    group by pr.teacher_id
  )
  insert into public.remuneration_statements(tenant_id, teacher_id, period, calculated_amount, details, calculated_at)
  select p_tenant, teacher_id, per, amount, details, now() from per_teacher
  on conflict (teacher_id, period) do update
    set calculated_amount = excluded.calculated_amount, details = excluded.details, calculated_at = now();
  get diagnostics n = row_count;
  return n;
end $$;

-- Teacher: own remuneration summary only (no revenue details).
create or replace function public.my_remuneration(p_tenant uuid)
returns table(period date, calculated_amount numeric, paid_amount numeric, outstanding numeric)
language sql stable security definer set search_path = '' as $$
  select s.period, s.calculated_amount,
    coalesce((select sum(amount) from public.remuneration_payments rp where rp.statement_id = s.id), 0),
    s.calculated_amount - coalesce((select sum(amount) from public.remuneration_payments rp where rp.statement_id = s.id), 0)
  from public.remuneration_statements s
  where s.tenant_id = p_tenant and s.teacher_id = private.current_teacher_id(p_tenant) and private.is_member(p_tenant)
  order by s.period desc
$$;

-- Platform: approve / reject a manual subscription payment.
create or replace function public.review_subscription_payment(p_id uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare sp public.subscription_payments;
begin
  if not private.is_platform_admin() then raise exception 'Forbidden'; end if;
  select * into sp from public.subscription_payments where id = p_id for update;
  if sp.status <> 'pending' then raise exception 'Already reviewed'; end if;
  update public.subscription_payments
     set status = case when p_approve then 'approved'::public.sub_payment_status else 'rejected'::public.sub_payment_status end,
         reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_note
   where id = p_id;
  if p_approve then
    update public.tenants
       set status = 'subscription_active',
           billing_interval = case when sp.period_months = 12 then 'annual' else 'monthly' end,
           current_period_end = greatest(now(), coalesce(current_period_end, now())) + make_interval(months => sp.period_months)
     where id = sp.tenant_id;
  end if;
end $$;

-- Platform: global analytics without exposing tenant private data.
create or replace function public.platform_stats()
returns table(tenant_id uuid, students bigint, teachers bigint, members bigint, last_activity timestamptz)
language sql stable security definer set search_path = '' as $$
  select t.id,
    (select count(*) from public.students s where s.tenant_id = t.id and s.archived_at is null),
    (select count(*) from public.teachers x where x.tenant_id = t.id and x.is_active),
    (select count(*) from public.memberships m where m.tenant_id = t.id and m.is_active),
    (select max(created_at) from public.audit_log a where a.tenant_id = t.id)
  from public.tenants t where private.is_platform_admin()
$$;

revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated;

-- ───────────────────────── Row Level Security ─────────────────────────
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
revoke all on public.installment_balances from anon;

-- Platform tables
create policy tenants_select on public.tenants for select to authenticated
  using (private.is_platform_admin() or private.belongs_to(id));
create policy tenants_update on public.tenants for update to authenticated
  using (private.is_platform_admin() or private.is_admin(id)) with check (private.is_platform_admin() or private.is_admin(id));

create policy platform_admins_select on public.platform_admins for select to authenticated using (user_id = (select auth.uid()));

create policy memberships_select on public.memberships for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin(tenant_id));
create policy memberships_update on public.memberships for update to authenticated
  using (private.is_admin(tenant_id) and user_id <> (select auth.uid())) with check (private.is_admin(tenant_id));

create policy invitations_admin on public.invitations for all to authenticated
  using (private.is_admin(tenant_id) or private.is_platform_admin())
  with check (private.is_admin(tenant_id) and role = 'teacher');

create policy grants_select on public.support_access_grants for select to authenticated
  using (private.belongs_as_admin(tenant_id) or private.is_platform_admin());
create policy grants_insert on public.support_access_grants for insert to authenticated
  with check (private.belongs_as_admin(tenant_id) and granted_by = (select auth.uid()));
create policy grants_update on public.support_access_grants for update to authenticated
  using (private.belongs_as_admin(tenant_id)) with check (private.belongs_as_admin(tenant_id));

create policy subpay_select on public.subscription_payments for select to authenticated
  using (private.belongs_as_admin(tenant_id) or private.is_platform_admin());
create policy subpay_insert on public.subscription_payments for insert to authenticated
  with check (private.belongs_as_admin(tenant_id) and status = 'pending' and reviewed_by is null);

create policy audit_select on public.audit_log for select to authenticated
  using (private.is_admin(tenant_id)
         or (private.is_platform_admin() and table_name in ('tenants','subscription_payments','support_access_grants')));

create policy notifications_own on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_read on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_insert on public.notifications for insert to authenticated
  with check (private.is_admin(tenant_id) and exists (select 1 from public.memberships m where m.tenant_id = notifications.tenant_id and m.user_id = notifications.user_id));

-- Tenant tables: admin full access, members read, support read
do $$
declare t text;
begin
  foreach t in array array['academic_years','levels','subjects','payment_methods'] loop
    execute format('create policy %I on public.%I for select to authenticated using (private.is_member(tenant_id) or private.has_support_access(tenant_id))', t || '_read', t);
    execute format('create policy %I on public.%I for all to authenticated using (private.is_admin(tenant_id)) with check (private.is_admin(tenant_id))', t || '_admin', t);
  end loop;
  -- admin-only tables
  foreach t in array array['enrollments','student_groups','document_requirements','student_documents','installments',
      'installment_lines','payments','expense_categories','expenses','cash_movements','remuneration_rules',
      'remuneration_statements','remuneration_payments','document_counters','teacher_assignments','teachers'] loop
    execute format('create policy %I on public.%I for select to authenticated using (private.is_admin(tenant_id) or private.has_support_access(tenant_id))', t || '_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.is_admin(tenant_id))', t || '_ins', t);
    execute format('create policy %I on public.%I for update to authenticated using (private.is_admin(tenant_id)) with check (private.is_admin(tenant_id))', t || '_upd', t);
  end loop;
  foreach t in array array['enrollments','student_groups','document_requirements','student_documents','installment_lines',
      'expense_categories','remuneration_rules','teacher_assignments','teachers'] loop
    execute format('create policy %I on public.%I for delete to authenticated using (private.is_admin(tenant_id))', t || '_del', t);
  end loop;
end $$;

-- Teachers see their own teacher record, their assignments, and enrollments of their students.
create policy teachers_self on public.teachers for select to authenticated
  using (id = private.current_teacher_id(tenant_id));
create policy assignments_self on public.teacher_assignments for select to authenticated
  using (teacher_id = private.current_teacher_id(tenant_id));
create policy enrollments_teacher on public.enrollments for select to authenticated
  using (private.teacher_can_see_student(student_id));
create policy student_groups_teacher on public.student_groups for select to authenticated
  using (private.teacher_has_group(group_id));

-- Classes / groups: admins all; teachers assigned only.
create policy classes_read on public.classes for select to authenticated
  using (private.is_admin(tenant_id) or private.teacher_has_class(id) or private.has_support_access(tenant_id));
create policy classes_admin on public.classes for all to authenticated
  using (private.is_admin(tenant_id)) with check (private.is_admin(tenant_id));
create policy groups_read on public.groups for select to authenticated
  using (private.is_admin(tenant_id) or private.teacher_has_group(id) or private.has_support_access(tenant_id));
create policy groups_admin on public.groups for all to authenticated
  using (private.is_admin(tenant_id)) with check (private.is_admin(tenant_id));

-- Students
create policy students_read on public.students for select to authenticated
  using (private.is_admin(tenant_id) or private.teacher_can_see_student(id) or private.has_support_access(tenant_id));
create policy students_ins on public.students for insert to authenticated with check (private.is_admin(tenant_id));
create policy students_upd on public.students for update to authenticated
  using (private.is_admin(tenant_id)) with check (private.is_admin(tenant_id));

-- Timetable: admins all; teachers own entries.
create policy timetable_read on public.timetable_entries for select to authenticated
  using (private.is_admin(tenant_id) or teacher_id = private.current_teacher_id(tenant_id) or private.has_support_access(tenant_id));
create policy timetable_admin on public.timetable_entries for all to authenticated
  using (private.is_admin(tenant_id)) with check (private.is_admin(tenant_id));

-- Attendance: admins all; teachers within assigned scope.
create policy attendance_read on public.attendance_records for select to authenticated
  using (private.is_admin(tenant_id) or private.teacher_has_scope(class_id, group_id) or private.has_support_access(tenant_id));
create policy attendance_ins on public.attendance_records for insert to authenticated
  with check (private.is_admin(tenant_id) or (private.is_member(tenant_id) and private.teacher_has_scope(class_id, group_id)));
create policy attendance_upd on public.attendance_records for update to authenticated
  using (private.is_admin(tenant_id) or private.teacher_has_scope(class_id, group_id))
  with check (private.is_admin(tenant_id) or private.teacher_has_scope(class_id, group_id));

-- Assessments / grades / observations
create policy assessments_read on public.assessments for select to authenticated
  using (private.is_admin(tenant_id) or private.teacher_has_scope(class_id, group_id) or private.has_support_access(tenant_id));
create policy assessments_write on public.assessments for all to authenticated
  using (private.is_admin(tenant_id) or private.teacher_has_scope(class_id, group_id))
  with check (private.is_admin(tenant_id) or (private.is_member(tenant_id) and private.teacher_has_scope(class_id, group_id)));

create policy grades_read on public.grades for select to authenticated
  using (private.is_admin(tenant_id) or exists (select 1 from public.assessments a where a.id = assessment_id and private.teacher_has_scope(a.class_id, a.group_id)));
create policy grades_write on public.grades for all to authenticated
  using (private.is_admin(tenant_id) or exists (select 1 from public.assessments a where a.id = assessment_id and private.teacher_has_scope(a.class_id, a.group_id)))
  with check (exists (select 1 from public.assessments a where a.id = assessment_id and a.tenant_id = grades.tenant_id
                       and (private.is_admin(a.tenant_id) or private.teacher_has_scope(a.class_id, a.group_id))
                       and private.student_in_scope(grades.student_id, a.class_id, a.group_id)));

create policy observations_read on public.observations for select to authenticated
  using (private.is_admin(tenant_id) or private.teacher_has_scope(class_id, group_id));
create policy observations_write on public.observations for insert to authenticated
  with check (private.is_admin(tenant_id) or (private.teacher_has_scope(class_id, group_id) and private.student_in_scope(student_id, class_id, group_id)));

-- ───────────────────────── Storage: subscription payment proofs ─────────────────────────
insert into storage.buckets (id, name, public) values ('subscription-proofs', 'subscription-proofs', false)
on conflict (id) do nothing;

create policy proofs_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'subscription-proofs' and private.belongs_as_admin(((storage.foldername(name))[1])::uuid));
create policy proofs_read on storage.objects for select to authenticated
  using (bucket_id = 'subscription-proofs'
         and (private.is_platform_admin() or private.belongs_as_admin(((storage.foldername(name))[1])::uuid)));

-- Installments: amounts are fixed once generated; a discount can only change before any payment.
create or replace function private.guard_installment_update() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.amount_due <> old.amount_due or new.period <> old.period or new.enrollment_id <> old.enrollment_id
     or new.student_id <> old.student_id or new.invoice_no is distinct from old.invoice_no then
    raise exception 'Installment amounts are immutable';
  end if;
  if new.discount <> old.discount and exists (select 1 from public.payments p where p.installment_id = old.id and p.voided_at is null) then
    raise exception 'Discount cannot change after a payment has been recorded; void the payment first';
  end if;
  return new;
end $$;
create trigger installments_guard before update on public.installments for each row execute function private.guard_installment_update();

-- Grades cannot exceed the assessment scale.
create or replace function private.check_grade() returns trigger language plpgsql security definer set search_path = '' as $$
declare mx numeric;
begin
  select max_score into mx from public.assessments where id = new.assessment_id;
  if new.score is not null and new.score > mx then raise exception 'Score exceeds maximum (%)', mx; end if;
  return new;
end $$;
create trigger grades_check before insert or update on public.grades for each row execute function private.check_grade();
