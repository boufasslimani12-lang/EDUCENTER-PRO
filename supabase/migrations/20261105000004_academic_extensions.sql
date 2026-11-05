-- EDUCENTER PRO — additive academic extensions (approved: excused attendance, room, capacity, teacher/subject details)
-- Additive only: new nullable columns, one enum value and capacity triggers. No RLS policy is changed;
-- the new columns inherit the existing row-level policies of their tables.

-- 1. Excused absences.
alter type public.attendance_status add value if not exists 'excused';

-- 2. Optional room / location on timetable sessions.
alter table public.timetable_entries add column if not exists room text check (room is null or length(room) <= 60);

-- 3. Optional capacity on classes and groups (null = unlimited).
alter table public.classes add column if not exists capacity int check (capacity is null or capacity > 0);
alter table public.groups  add column if not exists capacity int check (capacity is null or capacity > 0);

-- 4. Teacher professional details and subject description.
alter table public.teachers add column if not exists specialization text check (specialization is null or length(specialization) <= 120);
alter table public.teachers add column if not exists hire_date date;
alter table public.teachers add column if not exists notes text;
alter table public.subjects add column if not exists description text check (description is null or length(description) <= 500);

-- Capacity enforcement (security definer so the count sees every enrollment of the class/group,
-- not only those visible to the caller; it only ever reads counts).
create or replace function private.check_class_capacity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare cap int; n int;
begin
  if new.class_id is null or new.status <> 'active' then return new; end if;
  if tg_op = 'UPDATE' and new.class_id is not distinct from old.class_id and old.status = 'active' then return new; end if;
  select capacity into cap from public.classes where id = new.class_id;
  if cap is null then return new; end if;
  select count(*) into n from public.enrollments
   where class_id = new.class_id and status = 'active' and id <> new.id;
  if n >= cap then
    raise exception 'Class capacity reached (%)', cap using errcode = 'P0003';
  end if;
  return new;
end $$;
create trigger enrollments_class_capacity before insert or update on public.enrollments
  for each row execute function private.check_class_capacity();

create or replace function private.check_group_capacity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare cap int; n int;
begin
  select capacity into cap from public.groups where id = new.group_id;
  if cap is null then return new; end if;
  select count(*) into n from public.student_groups sg join public.enrollments e on e.id = sg.enrollment_id
   where sg.group_id = new.group_id and e.status = 'active' and sg.id <> new.id;
  if n >= cap then
    raise exception 'Group capacity reached (%)', cap using errcode = 'P0004';
  end if;
  return new;
end $$;
create trigger student_groups_capacity before insert on public.student_groups
  for each row execute function private.check_group_capacity();
