-- ═══════════════════════════════════════════════
--  نانا — Supabase Schema
--  اگر قبلاً اجرا کردید، این فایل را دوباره اجرا کنید
-- ═══════════════════════════════════════════════

-- ─── Drop existing policies (if any) ───
drop policy if exists "allow all" on public.users;
drop policy if exists "allow all" on public.exercises;
drop policy if exists "allow all" on public.nutrition;
drop policy if exists "allow all" on public.classes;
drop policy if exists "allow all" on public.exercise_logs;
drop policy if exists "allow all" on public.nutrition_logs;

-- ─── Create tables (if not exist) ───

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  email text unique,
  phone text,
  password text not null,
  role text not null default 'user',
  saved_items jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text,
  image text,
  video text,
  created_at timestamptz default now()
);

create table if not exists public.nutrition (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text,
  content text,
  image text,
  video text,
  created_at timestamptz default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  creator_id uuid,
  creator_name text,
  is_live boolean default true,
  messages jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.exercise_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  username text,
  exercise_id text,
  exercise_title text,
  sets text,
  reps text,
  duration text,
  note text,
  date timestamptz default now()
);

create table if not exists public.nutrition_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  username text,
  plan_id text,
  plan_title text,
  meal_name text,
  foods text,
  calories text,
  meal_type text default 'other',
  note text,
  date timestamptz default now()
);

-- ─── Enable RLS ───
alter table public.users enable row level security;
alter table public.exercises enable row level security;
alter table public.nutrition enable row level security;
alter table public.classes enable row level security;
alter table public.exercise_logs enable row level security;
alter table public.nutrition_logs enable row level security;

-- ─── Create policies ───
create policy "allow all" on public.users for all using (true) with check (true);
create policy "allow all" on public.exercises for all using (true) with check (true);
create policy "allow all" on public.nutrition for all using (true) with check (true);
create policy "allow all" on public.classes for all using (true) with check (true);
create policy "allow all" on public.exercise_logs for all using (true) with check (true);
create policy "allow all" on public.nutrition_logs for all using (true) with check (true);

-- ─── Done ───
select 'نانا — دیتابیس آماده است ✅' as status;

-- ─── Chat Tables ───

-- Drop policies if exist
drop policy if exists "allow all" on public.public_chat;
drop policy if exists "allow all" on public.private_chat;

-- Public chat messages
create table if not exists public.public_chat (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  username text,
  role text,
  message text not null,
  created_at timestamptz default now()
);

-- Private chat messages
create table if not exists public.private_chat (
  id uuid primary key default gen_random_uuid(),
  from_id uuid,
  from_name text,
  to_id uuid,
  to_name text,
  role text,
  message text not null,
  created_at timestamptz default now()
);

alter table public.public_chat enable row level security;
alter table public.private_chat enable row level security;
create policy "allow all" on public.public_chat for all using (true) with check (true);
create policy "allow all" on public.private_chat for all using (true) with check (true);
