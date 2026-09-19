-- ==========================================================================
-- Skyview Construction — Time Clock database setup (idempotent)
-- ==========================================================================
-- Run this entire file in the Supabase SQL Editor (Database → SQL Editor →
-- New query → paste → Run). Safe to re-run: it uses `if not exists`,
-- `create or replace`, and `drop policy if exists` so it won't error out.
--
-- AFTER running this:
--   1. Create your first admin user in Authentication → Users → Add user
--      (turn on "Auto Confirm User"), then run:
--        update public.profiles set role = 'admin', full_name = 'Your Name'
--        where email = 'you@example.com';
--   2. Sign in to the app with that user. Add employees from Admin → Employees
--      and set up your job sites (geofences) on the Time clock board.
-- ==========================================================================


-- ==========================================================================
-- 1. profiles — one row per login, keyed by the Supabase auth user
-- ==========================================================================

create table if not exists public.profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  email                text not null,
  full_name            text,
  role                 text not null default 'employee'
                         check (role in ('admin', 'master_admin', 'employee')),
  must_change_password boolean not null default true,
  created_at           timestamptz not null default now()
);
-- Keep the role constraint/default correct on an existing table too.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'master_admin', 'employee'));
alter table public.profiles alter column role set default 'employee';
alter table public.profiles add column if not exists must_change_password boolean not null default true;
-- Inactive people keep their history but can't sign in or clock in, and are
-- hidden from the Time clock board. Flip back to true to reactivate.
alter table public.profiles add column if not exists active boolean not null default true;

-- Auto-create a profile row whenever someone is added in Supabase Auth.
-- New logins are always plain employees; an admin promotes them if needed.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, email, full_name, role, must_change_password)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    'employee',
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ==========================================================================
-- 2. Helper function: is_admin()
-- ==========================================================================
-- Returns true if the current authenticated user has admin OR master_admin
-- role. Used in nearly every RLS policy that gates admin-only writes.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin', 'master_admin')
  );
$$;

-- ---- profiles RLS ----
alter table public.profiles enable row level security;
grant select, insert, update, delete on public.profiles to authenticated;
drop policy if exists "auth_users_read_profiles"  on public.profiles;
drop policy if exists "users_update_own_profile"  on public.profiles;
drop policy if exists "admins_update_any_profile" on public.profiles;
create policy "auth_users_read_profiles"  on public.profiles
  for select to authenticated using (true);
create policy "users_update_own_profile"  on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "admins_update_any_profile" on public.profiles
  for update to authenticated using (public.is_admin());


-- ==========================================================================
-- 3. hours — manual timesheet rows
-- ==========================================================================

create table if not exists public.hours (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.profiles(id) on delete cascade,
  employee_name text not null,
  date date not null,
  hours numeric(5, 2) not null check (hours >= 0 and hours <= 24),
  notes text,
  created_at timestamptz default now()
);

create index if not exists hours_date_idx on public.hours(date desc);
create index if not exists hours_employee_idx on public.hours(employee_id);
alter table public.hours enable row level security;
grant select, insert, update, delete on public.hours to authenticated;

-- Time clock: one row per clock-in; clock_out_at is null while the employee is
-- still clocked in. Admins (the Time clock board) can clock anyone in/out;
-- employees can clock themselves. Completed sessions roll up into the Hours view.
create table if not exists public.time_clock (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references public.profiles(id) on delete cascade,
  clock_in_at  timestamptz not null default now(),
  clock_out_at timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists time_clock_employee_idx on public.time_clock(employee_id, clock_in_at desc);
create index if not exists time_clock_open_idx on public.time_clock(employee_id) where clock_out_at is null;
-- Device timezone (IANA, e.g. "America/Chicago") reported at each punch, so a
-- cross-zone shift is visible on the board. Durations are unaffected (they use
-- the absolute instants). Re-runnable.
alter table public.time_clock add column if not exists clock_in_tz  text;
alter table public.time_clock add column if not exists clock_out_tz text;
alter table public.time_clock enable row level security;
grant select, insert, update on public.time_clock to authenticated;
drop policy if exists "time_clock admin all" on public.time_clock;
create policy "time_clock admin all" on public.time_clock for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "time_clock own" on public.time_clock;
create policy "time_clock own" on public.time_clock for all to authenticated
  using (employee_id = auth.uid()) with check (employee_id = auth.uid());
grant delete on public.time_clock to authenticated;  -- admins can remove a bogus session

-- Time-clock adjustment requests: an employee who forgot to clock in/out asks
-- for a correction; only an admin can approve it (which then edits/creates the
-- session). Employees see/create their own; admins see and act on all.
create table if not exists public.time_clock_requests (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references public.profiles(id) on delete cascade,
  target_date   date not null,
  requested_in  timestamptz,
  requested_out timestamptz,
  reason        text,
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note    text,
  reviewed_by   uuid references public.profiles(id) on delete set null,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists tcr_status_idx on public.time_clock_requests(status, created_at desc);
create index if not exists tcr_employee_idx on public.time_clock_requests(employee_id, created_at desc);
alter table public.time_clock_requests enable row level security;
grant select, insert, update on public.time_clock_requests to authenticated;
drop policy if exists "tcr admin all" on public.time_clock_requests;
create policy "tcr admin all" on public.time_clock_requests for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "tcr own read" on public.time_clock_requests;
create policy "tcr own read" on public.time_clock_requests for select to authenticated
  using (employee_id = auth.uid());
drop policy if exists "tcr own insert" on public.time_clock_requests;
create policy "tcr own insert" on public.time_clock_requests for insert to authenticated
  with check (employee_id = auth.uid() and status = 'pending');

-- Geofenced time clock -------------------------------------------------------
-- Named job sites. A self clock-in is only allowed within a site's radius,
-- UNLESS the employee is flagged remote. Each clock-in/out records its
-- coordinates + which site it matched.
alter table public.profiles add column if not exists remote_clock boolean not null default false;

create table if not exists public.work_sites (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  lat        double precision not null,
  lng        double precision not null,
  radius_m   integer not null default 150,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.work_sites enable row level security;
grant select, insert, update, delete on public.work_sites to authenticated;
drop policy if exists "work_sites read" on public.work_sites;
create policy "work_sites read" on public.work_sites for select to authenticated using (true);
drop policy if exists "work_sites admin write" on public.work_sites;
create policy "work_sites admin write" on public.work_sites for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table public.time_clock
  add column if not exists clock_in_lat       double precision,
  add column if not exists clock_in_lng       double precision,
  add column if not exists clock_in_site_id   uuid references public.work_sites(id) on delete set null,
  add column if not exists clock_out_lat      double precision,
  add column if not exists clock_out_lng      double precision,
  add column if not exists clock_out_site_id  uuid references public.work_sites(id) on delete set null;

-- Location breadcrumbs while on the clock ------------------------------------
-- One GPS sample sent by the employee's app WHILE they're clocked in and have
-- the app open in the foreground. Mobile browsers can't report a locked or
-- backgrounded phone, so this is a foreground-only trail: it powers the live
-- "where are they now" link and the after-the-fact route on the Time Clock
-- board, but it has gaps whenever the app isn't open.
create table if not exists public.time_clock_pings (
  id          bigint generated always as identity primary key,
  session_id  uuid not null references public.time_clock(id) on delete cascade,
  employee_id uuid not null references public.profiles(id) on delete cascade,
  lat         double precision not null,
  lng         double precision not null,
  accuracy_m  double precision,
  recorded_at timestamptz not null default now()
);
create index if not exists tcp_session_idx on public.time_clock_pings(session_id, recorded_at);
create index if not exists tcp_employee_recent_idx on public.time_clock_pings(employee_id, recorded_at desc);
alter table public.time_clock_pings enable row level security;
grant select, insert on public.time_clock_pings to authenticated;
drop policy if exists "tcp admin all" on public.time_clock_pings;
create policy "tcp admin all" on public.time_clock_pings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "tcp own insert" on public.time_clock_pings;
create policy "tcp own insert" on public.time_clock_pings for insert to authenticated
  with check (employee_id = auth.uid());
drop policy if exists "tcp own read" on public.time_clock_pings;
create policy "tcp own read" on public.time_clock_pings for select to authenticated
  using (employee_id = auth.uid());


-- ==========================================================================
-- 4. hours RLS policies
-- ==========================================================================
drop policy if exists "Admins view all hours"        on public.hours;
drop policy if exists "Employees view own hours"     on public.hours;
drop policy if exists "Anyone signed in can insert hours" on public.hours;
drop policy if exists "Admins update any hours"      on public.hours;
drop policy if exists "Employees update own hours"   on public.hours;
drop policy if exists "Admins delete hours"          on public.hours;
drop policy if exists "Employees delete own hours"   on public.hours;

create policy "Admins view all hours"   on public.hours
  for select using (public.is_admin());
create policy "Employees view own hours"  on public.hours
  for select using (employee_id = auth.uid());
create policy "Anyone signed in can insert hours" on public.hours
  for insert with check (auth.uid() is not null);
create policy "Admins update any hours" on public.hours
  for update using (public.is_admin());
create policy "Employees update own hours" on public.hours
  for update using (employee_id = auth.uid());
create policy "Admins delete hours"     on public.hours
  for delete using (public.is_admin());
create policy "Employees delete own hours" on public.hours
  for delete using (employee_id = auth.uid());
