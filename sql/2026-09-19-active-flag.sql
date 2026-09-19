-- Adds the Active/Inactive switch for logins. Run once in the Supabase SQL
-- Editor on an existing project. (New projects get this from
-- timeclock-schema.sql automatically.)
alter table public.profiles add column if not exists active boolean not null default true;
