-- End-to-end checks for tenant isolation, role permissions and financial integrity.
-- Run against a disposable database after the migrations (see README "Testing the database").
\set ON_ERROR_STOP 1
set client_min_messages = warning;

-- Users
insert into auth.users(id, email, email_confirmed_at) values
 ('00000000-0000-0000-0000-0000000000a1','root@platform.test', now()),
 ('00000000-0000-0000-0000-0000000000b1','admin1@school.test', now()),
 ('00000000-0000-0000-0000-0000000000b2','admin2@center.test', now()),
 ('00000000-0000-0000-0000-0000000000c1','teacher1@school.test', now()),
 ('00000000-0000-0000-0000-0000000000c2','teacher2@school.test', now());
insert into public.platform_admin_invites(email) values ('root@platform.test');

create or replace function pg_temp.as_user(u text) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', false);
  perform set_config('request.jwt.claim.sub', u, false);
end $$;
create or replace function pg_temp.check(cond boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'FAIL: %', label; end if;
  raise notice 'ok - %', label;
end $$;
set client_min_messages = notice;

-- Platform admin provisions two tenants
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select public.claim_invitations();
select pg_temp.check((select count(*) from public.platform_admins) = 1, 'platform admin claimed');
select public.provision_tenant('Ecole Alpha', 'alpha', 'private_school', 'admin1@school.test') \gset
select public.provision_tenant('Centre Beta', 'beta', 'tutoring_center', 'admin2@center.test') \gset
select pg_temp.check((select count(*) from public.tenants) = 2, 'two tenants created');
select pg_temp.check((select count(*) from public.academic_years) = 0, 'platform admin cannot read tenant data');

-- Tenant admins
reset role;
select id as t1 from public.tenants where slug = 'alpha' \gset
select id as t2 from public.tenants where slug = 'beta' \gset
-- admin users already existed & were confirmed: provision_tenant linked memberships directly
select pg_temp.check((select count(*) from public.memberships) = 2, 'memberships created at provisioning');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select pg_temp.check((select count(*) from public.tenants) = 1, 'admin2 sees only own tenant');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.check((select count(*) from public.tenants) = 1, 'admin1 sees only own tenant');
select pg_temp.check((select count(*) from public.levels where tenant_id = :'t2') = 0, 'admin1 cannot read tenant2 levels');
select id as y1 from public.academic_years where tenant_id = :'t1' and is_active \gset

-- Cross-tenant write is rejected
do $$ begin
  insert into public.subjects(tenant_id, name) values ((select id from public.tenants where slug='beta'), 'Hack');
  raise exception 'FAIL: cross tenant insert allowed';
exception when insufficient_privilege then raise notice 'ok - cross-tenant insert rejected';
end $$;

-- Structure
insert into public.subjects(tenant_id, name) values (:'t1','Maths'),(:'t1','Physique');
select id as maths from public.subjects where name='Maths' \gset
select id as phys from public.subjects where name='Physique' \gset
insert into public.classes(tenant_id, academic_year_id, name) values (:'t1', :'y1', '1BAC-A'), (:'t1', :'y1', '1BAC-B');
select id as ca from public.classes where name='1BAC-A' \gset
select id as cb from public.classes where name='1BAC-B' \gset
insert into public.groups(tenant_id, academic_year_id, name, monthly_fee) values (:'t1', :'y1', 'Soutien Maths', 100);
select id as g1 from public.groups where name='Soutien Maths' \gset
select set_config('test.g1', :'g1', false) \gset

-- Teachers
insert into public.teachers(tenant_id, full_name, email) values (:'t1','Prof Un','teacher1@school.test'),(:'t1','Prof Deux','teacher2@school.test');
select id as tc1 from public.teachers where full_name='Prof Un' \gset
select id as tc2 from public.teachers where full_name='Prof Deux' \gset
select public.invite_teacher(:'tc1');
select public.invite_teacher(:'tc2');
insert into public.teacher_assignments(tenant_id, teacher_id, class_id, subject_id) values (:'t1', :'tc1', :'ca', :'maths'), (:'t1', :'tc1', :'ca', :'phys');
insert into public.teacher_assignments(tenant_id, teacher_id, group_id, subject_id) values (:'t1', :'tc2', :'g1', :'maths');

-- Students & enrollment
insert into public.students(tenant_id, first_name, last_name, birth_date) values (:'t1','Sara','Alami','2010-01-01'),(:'t1','Omar','Bennani','2010-02-02'),(:'t1','Lina','Chraibi','2010-03-03');
select id as s1 from public.students where first_name='Sara' \gset
select id as s2 from public.students where first_name='Omar' \gset
select id as s3 from public.students where first_name='Lina' \gset
do $$ begin
  insert into public.students(tenant_id, first_name, last_name, birth_date) values ((select id from public.tenants where slug='alpha'),' sara','ALAMI','2010-01-01');
  raise exception 'FAIL: duplicate student allowed';
exception when unique_violation then raise notice 'ok - duplicate student rejected';
end $$;
select public.reenroll_student(:'s1', :'y1', :'ca', 250, 0, array[:'g1']::uuid[]);
select public.reenroll_student(:'s2', :'y1', :'ca', 250, 50, '{}');
select public.reenroll_student(:'s3', :'y1', :'cb', 250, 0, array[:'g1']::uuid[]);
select public.reenroll_student(:'s1', :'y1', :'ca', 250, 0, array[:'g1']::uuid[]);
select pg_temp.check((select count(*) from public.students) = 3, 're-enrollment does not duplicate students');
select pg_temp.check((select count(*) from public.student_groups where enrollment_id in (select id from public.enrollments where student_id = :'s1')) = 1, 'no duplicate group assignment');

-- Timetable conflicts
insert into public.timetable_entries(tenant_id, academic_year_id, class_id, subject_id, teacher_id, weekday, starts_at, ends_at) values (:'t1', :'y1', :'ca', :'maths', :'tc1', 1, '08:00', '10:00');
do $$ begin
  insert into public.timetable_entries(tenant_id, academic_year_id, class_id, subject_id, teacher_id, weekday, starts_at, ends_at)
  select tenant_id, academic_year_id, (select id from public.classes where name='1BAC-B'), subject_id, teacher_id, 1, '09:00', '11:00' from public.timetable_entries limit 1;
  raise exception 'FAIL: teacher overlap allowed';
exception when exclusion_violation then raise notice 'ok - teacher overlap rejected';
end $$;
do $$ begin
  insert into public.timetable_entries(tenant_id, academic_year_id, class_id, subject_id, teacher_id, weekday, starts_at, ends_at)
  select tenant_id, academic_year_id, class_id, subject_id, (select id from public.teachers where full_name='Prof Deux'), 1, '09:30', '10:30' from public.timetable_entries limit 1;
  raise exception 'FAIL: class overlap allowed';
exception when exclusion_violation then raise notice 'ok - class overlap rejected';
end $$;
insert into public.timetable_entries(tenant_id, academic_year_id, class_id, subject_id, teacher_id, weekday, starts_at, ends_at) values (:'t1', :'y1', :'ca', :'phys', :'tc1', 1, '10:00', '11:00');
select pg_temp.check(true, 'adjacent slots allowed');

-- Teacher 1 claims account and is scoped
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select public.claim_invitations();
select pg_temp.check((select count(*) from public.students) = 2, 'teacher1 sees only students of assigned class');
select pg_temp.check((select count(*) from public.classes) = 1, 'teacher1 sees only assigned class');
select pg_temp.check((select count(*) from public.timetable_entries) = 2, 'teacher1 sees own timetable');
select pg_temp.check((select count(*) from public.payments) = 0 and (select count(*) from public.installments) = 0, 'teacher has no finance access');
insert into public.attendance_records(tenant_id, session_date, class_id, student_id, status) values (:'t1', current_date, :'ca', :'s1', 'present'), (:'t1', current_date, :'ca', :'s2', 'late');
select pg_temp.check((select count(*) from public.attendance_records) = 2, 'teacher1 records attendance');
do $$ begin
  insert into public.attendance_records(tenant_id, session_date, class_id, student_id, status)
  values ((select tenant_id from public.classes limit 1), current_date, (select class_id from public.attendance_records limit 1), (select student_id from public.attendance_records order by status limit 1), 'absent');
  raise exception 'FAIL: duplicate attendance allowed';
exception when unique_violation then raise notice 'ok - duplicate attendance rejected';
end $$;
do $$ begin
  insert into public.attendance_records(tenant_id, session_date, group_id, student_id, status)
  values ((select tenant_id from public.classes limit 1), current_date, current_setting('test.g1')::uuid, (select student_id from public.attendance_records limit 1), 'absent');
  raise exception 'FAIL: unassigned group attendance allowed';
exception when insufficient_privilege then raise notice 'ok - attendance for unassigned group rejected';
end $$;
select pg_temp.check((select count(*) from public.my_remuneration(:'t1')) = 0, 'teacher remuneration summary callable');

-- Finance (admin1)
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select public.generate_installments(:'t1', date_trunc('month', current_date)::date) as n \gset
select pg_temp.check(:n = 3, 'installments generated for 3 enrollments');
select pg_temp.check(public.generate_installments(:'t1', date_trunc('month', current_date)::date) = 0, 'generation is idempotent');
select id as i1 from public.installments where student_id = :'s1' \gset
select id as i2 from public.installments where student_id = :'s2' \gset
select pg_temp.check((select amount_due from public.installments where id = :'i1') = 350, 'class fee + group fee');
select pg_temp.check((select discount from public.installments where id = :'i2') = 50, 'discount applied');

insert into public.payments(tenant_id, installment_id, student_id, amount, method, idempotency_key) values (:'t1', :'i1', :'s1', 150, 'Espèces', '11111111-1111-1111-1111-111111111111');
select pg_temp.check((select balance from public.installment_balances where id = :'i1') = 200, 'partial payment: balance 200');
select pg_temp.check((select payment_status from public.installment_balances where id = :'i1') in ('partial','overdue_partial'), 'partial status');
do $$ begin
  insert into public.payments(tenant_id, installment_id, student_id, amount, method, idempotency_key)
  select tenant_id, installment_id, student_id, 10, method, '11111111-1111-1111-1111-111111111111' from public.payments limit 1;
  raise exception 'FAIL: duplicate payment allowed';
exception when unique_violation then raise notice 'ok - duplicate payment (same key) rejected';
end $$;
do $$ begin
  insert into public.payments(tenant_id, installment_id, student_id, amount, method, idempotency_key)
  select tenant_id, installment_id, student_id, 250, method, gen_random_uuid() from public.payments limit 1;
  raise exception 'FAIL: overpayment allowed';
exception when sqlstate 'P0002' then raise notice 'ok - overpayment rejected';
end $$;
insert into public.payments(tenant_id, installment_id, student_id, amount, method, idempotency_key) values (:'t1', :'i1', :'s1', 200, 'Espèces', gen_random_uuid());
select pg_temp.check((select payment_status from public.installment_balances where id = :'i1') = 'paid', 'installment paid when balance reaches zero');
select pg_temp.check((select receipt_no from public.payments where amount = 200) like 'REC-%-000002', 'automatic receipt numbering');

-- Corrections
delete from public.payments;
select pg_temp.check((select count(*) from public.payments) = 2, 'payments cannot be deleted (RLS)');
reset role;
do $$ begin
  delete from public.payments;
  raise exception 'FAIL: delete allowed';
exception when others then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'ok - payments cannot be deleted even by the database owner (trigger)';
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
do $$ begin
  update public.payments set amount = 1 where amount = 200;
  raise exception 'FAIL: amount edit allowed';
exception when others then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'ok - payment amount immutable';
end $$;
update public.payments set voided_at = now(), void_reason = 'Erreur de saisie' where amount = 200;
select pg_temp.check((select balance from public.installment_balances where id = :'i1') = 200, 'void restores balance');
select pg_temp.check((select count(*) from public.cash_movements) = 3, 'cash: 2 inflows + 1 reversal');
select pg_temp.check((select sum(case when direction='in' then amount else -amount end) from public.cash_movements) = 150, 'cash theoretical balance');
select pg_temp.check((select count(*) from public.audit_log where table_name='payments' and action='UPDATE') = 1, 'correction audited');

insert into public.payments(tenant_id, installment_id, student_id, amount, method, idempotency_key) values (:'t1', :'i2', :'s2', 200, 'Virement', gen_random_uuid());

-- Remuneration: tc1 has two subjects on class A (must count once); tc2 on group g1
insert into public.remuneration_rules(tenant_id, teacher_id, percentage, basis) values (:'t1', :'tc1', 40, 'collected');
insert into public.remuneration_rules(tenant_id, teacher_id, group_id, percentage, basis) values (:'t1', :'tc2', :'g1', 50, 'due');
select public.calculate_remuneration(:'t1', current_date);
-- class A collected: s1 paid 150 of 350 -> class share 250/350*150 = 107.14 ; s2 paid 200 of 250 (class line 250) -> 200 ; total 307.14 -> 40% = 122.86
select pg_temp.check((select calculated_amount from public.remuneration_statements where teacher_id = :'tc1') = 122.86, 'tc1 remuneration (no double count across subjects)');
-- group g1 due: s1 line 100 (no discount) + s3 line 100 -> 200 -> 50% = 100
select pg_temp.check((select calculated_amount from public.remuneration_statements where teacher_id = :'tc2') = 100, 'tc2 remuneration on due basis');

-- Expense
insert into public.expenses(tenant_id, category_id, amount, beneficiary, method) select :'t1', id, 500, 'Bailleur', 'Virement' from public.expense_categories where tenant_id = :'t1' and name = 'Loyer';
select pg_temp.check((select count(*) from public.cash_movements where direction='out' and expense_id is not null) = 1, 'expense creates cash outflow');

-- Tenant admin cannot extend own subscription
do $$ begin
  update public.tenants set current_period_end = now() + interval '10 years' where slug = 'alpha';
  raise exception 'FAIL: admin changed subscription';
exception when others then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'ok - admin cannot change lifecycle fields';
end $$;

-- Support access: platform sees data only with a grant
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.check((select count(*) from public.students) = 0, 'platform admin blind without grant');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
insert into public.support_access_grants(tenant_id, granted_by, reason, expires_at) values (:'t1', '00000000-0000-0000-0000-0000000000b1', 'Problème import', now() + interval '1 day');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.check((select count(*) from public.students) = 3, 'platform admin reads with grant');
do $$ begin
  update public.students set first_name = 'X';
  if exists (select 1 from public.students where first_name = 'X') then raise exception 'FAIL: support write allowed'; end if;
  raise notice 'ok - support access is read-only';
end $$;

-- Suspension blocks tenant access but keeps data
update public.tenants set status = 'suspended' where slug = 'alpha';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.check((select count(*) from public.students) = 0, 'suspended tenant: data inaccessible');
select pg_temp.check((select count(*) from public.tenants) = 1, 'suspended tenant: billing still reachable');
reset role;
select pg_temp.check((select count(*) from public.students) = 3, 'suspended tenant: data preserved');

\echo ALL TESTS PASSED
