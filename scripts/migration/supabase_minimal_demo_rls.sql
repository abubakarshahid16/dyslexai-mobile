-- Minimal demo-safe RLS policies for classroom separation.
-- Run in Supabase SQL Editor after validating table names and column types.

begin;

-- Resolve app user id from JWT claims (custom claim expected).
create or replace function public.current_app_user_id()
returns bigint
language sql
stable
as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claims', true)::jsonb ->> 'user_id',
      current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'user_id'
    ),
    ''
  )::bigint
$$;

-- Enable RLS on core tables.
alter table if exists public.students enable row level security;
alter table if exists public.sessions enable row level security;
alter table if exists public.assignments enable row level security;
alter table if exists public.assignment_exercises enable row level security;
alter table if exists public.word_mastery enable row level security;

-- Requires students.auth_user_id -> users.id mapping.
alter table if exists public.students add column if not exists auth_user_id bigint;
create index if not exists idx_students_auth_user_id on public.students(auth_user_id);

drop policy if exists students_select_own on public.students;
create policy students_select_own on public.students
for select
using (auth_user_id = public.current_app_user_id());

drop policy if exists students_update_own on public.students;
create policy students_update_own on public.students
for update
using (auth_user_id = public.current_app_user_id())
with check (auth_user_id = public.current_app_user_id());

drop policy if exists sessions_select_own on public.sessions;
create policy sessions_select_own on public.sessions
for select
using (
  exists (
    select 1 from public.students s
    where s.id = sessions.student_id
      and s.auth_user_id = public.current_app_user_id()
  )
);

drop policy if exists assignments_select_own on public.assignments;
create policy assignments_select_own on public.assignments
for select
using (
  exists (
    select 1 from public.students s
    where s.id = assignments.student_id
      and s.auth_user_id = public.current_app_user_id()
  )
);

drop policy if exists assignments_teacher_manage on public.assignments;
create policy assignments_teacher_manage on public.assignments
for all
using (
  teacher_id = public.current_app_user_id()
)
with check (
  teacher_id = public.current_app_user_id()
);

drop policy if exists assignment_exercises_teacher_manage on public.assignment_exercises;
create policy assignment_exercises_teacher_manage on public.assignment_exercises
for all
using (
  exists (
    select 1 from public.assignments a
    where a.id = assignment_exercises.assignment_id
      and a.teacher_id = public.current_app_user_id()
  )
)
with check (
  exists (
    select 1 from public.assignments a
    where a.id = assignment_exercises.assignment_id
      and a.teacher_id = public.current_app_user_id()
  )
);

drop policy if exists word_mastery_select_own on public.word_mastery;
create policy word_mastery_select_own on public.word_mastery
for select
using (
  exists (
    select 1 from public.students s
    where s.id = word_mastery.student_id
      and s.auth_user_id = public.current_app_user_id()
  )
);

commit;
