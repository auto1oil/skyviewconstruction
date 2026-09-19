# Skyview Construction — Time Clock

A standalone employee time clock, ported from the Auto 1 Oil dispatch app.
Employees clock in and out from their phones at geofenced job sites; admins
see everyone's hours by pay week, fix mistakes, approve corrections, and
export payroll CSV.

**Stack:** Next.js 14 (App Router) · React · TypeScript · Tailwind CSS ·
Supabase (Postgres + Auth + row-level security) · Leaflet/OpenStreetMap maps.

## What it does

**Employees** (`/employee/hours`)
- Clock in / clock out with one tap. The phone's GPS is checked server-side:
  you must be inside an active job site's radius unless an admin flags you
  as *remote*.
- See this week's hours (Sunday–Saturday) with each punch listed.
- "Forgot to clock in or out?" → send an adjustment request an admin approves.
- Log manual hours for days without punches.
- While clocked in *and* the app is open, the phone sends a GPS breadcrumb
  every 90 seconds. Nothing is recorded off the clock.

**Admins** (`/admin/hours`)
- Time clock board: week picker, per-employee totals with regular/overtime
  split at 40 h, clock anyone in or out, live location link for people on
  the clock, per-session trail map.
- Edit, add, or delete any clock session; approve or reject adjustment
  requests; toggle *remote* per employee.
- Job sites & geofence manager: drop a pin on a map or use current location;
  set the radius in meters; activate/deactivate sites.
- Export the week to CSV for payroll.
- Employees page (`/admin/employees`): add logins (a temporary password is
  shown once), change roles, toggle remote, mark someone inactive (can't
  sign in or clock in, hidden from the board, history kept), or remove a
  login entirely.

**Business rules**
- Pay week runs Sunday → Saturday.
- Open-shift cap: 16 h on-site, 24 h remote. A longer open session is treated
  as a forgotten clock-out; the employee is blocked until an admin sets the
  real end time, so a bogus all-day total is never logged.
- All times display in one company timezone (default Mountain) no matter
  where the phone is. Cross-timezone shifts are flagged on the board.
- Employees can only see and change their own rows; admins see everything
  (enforced in the database by row-level security).

## Setup

### 1. Supabase project
1. Create a project at https://supabase.com.
2. Open **SQL Editor → New query**, paste the whole of
   [`sql/timeclock-schema.sql`](sql/timeclock-schema.sql), and run it.
   It is safe to re-run.
3. Go to **Authentication → Users → Add user**. Enter your email and a
   password and turn on **Auto Confirm User**.
4. Back in the SQL Editor, make yourself an admin:
   ```sql
   update public.profiles set role = 'admin', full_name = 'Your Name', must_change_password = false
   where email = 'you@example.com';
   ```

### 2. Environment variables
Copy `.env.local.example` to `.env.local` and fill in the values from
**Project Settings → API**:

| Variable | Where it's used |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | everywhere |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + cookie-session server client |
| `SUPABASE_SERVICE_ROLE_KEY` | server only: clock in/out, location ping, add employee |
| `NEXT_PUBLIC_TIME_ZONE` | optional, IANA zone; defaults to `America/Denver` |

### 3. Run it
```bash
npm install
npm run dev        # http://localhost:3000
```
Sign in with the admin you created, add your job sites on the Time clock
board, then add employees under **Employees**.

### 4. Deploy
Deploy to Vercel (or any Node host) and set the same four environment
variables in the project settings. Geolocation in the browser requires
HTTPS, which Vercel provides by default.

## Project layout

| Path | What it is |
|---|---|
| `sql/timeclock-schema.sql` | Idempotent schema: `profiles`, `hours`, `time_clock`, `time_clock_requests`, `work_sites`, `time_clock_pings`, RLS policies, `is_admin()` and the new-user trigger. |
| `app/admin/hours/page.tsx` | Admin time clock board. |
| `app/admin/employees/page.tsx` | Admin employee management. |
| `app/employee/hours/page.tsx` | Employee "My hours" with self clock and adjustment requests. |
| `app/api/time-clock/self/route.ts` | POST `{ action: 'in' \| 'out', lat, lng, tz }` — geofenced self clock. |
| `app/api/time-clock/ping/route.ts` | POST `{ lat, lng, accuracy }` — GPS breadcrumb while clocked in. |
| `app/api/admin/users/route.ts` | POST — admin creates a login and gets a temp password. |
| `app/login`, `app/account` | Sign in / forgot password; set or change password. |
| `components/SelfClock.tsx` | Clock in/out button with elapsed time. |
| `components/LocationReporter.tsx` | Mounted once in the root layout; pings while on the clock. |
| `components/TimeAdjustmentRequest.tsx` | Employee correction request form. |
| `components/WorkSitesManager.tsx`, `components/SitePinPicker.tsx` | Job site CRUD and the Leaflet pin picker. |
| `components/NavBar.tsx` | Header navigation by role. |
| `lib/timeclock-tz.ts` | Company-timezone helpers. |
| `lib/supabase-*.ts` | Browser, server-cookie, and service-role Supabase clients. |
| `middleware.ts` | Redirects signed-out users to `/login` and forces a password change on first sign-in. |

## Data model
- `profiles` — one row per login (`role`: `employee` / `admin` / `master_admin`, `remote_clock`, `must_change_password`). Created automatically by a trigger when an auth user is added.
- `time_clock` — one row per clock-in. `clock_out_at` is null while on the clock. Stores coordinates, matched site, and device timezone for each punch.
- `time_clock_requests` — adjustment requests (`pending` / `approved` / `rejected`).
- `time_clock_pings` — GPS breadcrumbs per session.
- `work_sites` — geofences (lat, lng, radius in meters, active).
- `hours` — manual hours rows.

## Notes
- Location reporting is foreground-only. Mobile browsers suspend JavaScript
  when the phone is locked, so the trail has gaps whenever the app is closed.
  This is a visibility aid, not tamper-proof tracking.
- Removing a user or resetting a forgotten password without email is done in
  the Supabase dashboard under **Authentication → Users**.
