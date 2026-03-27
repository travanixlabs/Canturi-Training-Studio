-- Canturi Training Studio — Supabase Schema
-- Run this in the Supabase SQL editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────
-- BOUTIQUES
-- ─────────────────────────────────────────
create table public.boutiques (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  city text not null,
  created_at timestamptz default now()
);

alter table public.boutiques enable row level security;
create policy "Boutiques are viewable by authenticated users" on public.boutiques
  for select using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────
-- USERS (mirrors auth.users with role data)
-- ─────────────────────────────────────────
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  role text not null check (role in ('trainee', 'manager', 'head_office')),
  boutique_id uuid references public.boutiques(id),
  avatar_initials text not null default '',
  created_at timestamptz default now()
);

alter table public.users enable row level security;
create policy "Users can view own profile" on public.users
  for select using (auth.uid() = id);
create policy "Users can view profiles in same boutique" on public.users
  for select using (
    boutique_id in (
      select boutique_id from public.users where id = auth.uid()
    )
  );
create policy "Head office can view all users" on public.users
  for select using (
    exists (select 1 from public.users where id = auth.uid() and role = 'head_office')
  );

-- ─────────────────────────────────────────
-- COURSES
-- ─────────────────────────────────────────
create table public.courses (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  icon text not null default '✦',
  colour_hex text not null default '#C9A96E',
  sort_order integer not null default 0
);

alter table public.courses enable row level security;
create policy "Courses are viewable by authenticated users" on public.courses
  for select using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────
-- CATEGORIES
-- ─────────────────────────────────────────
create table public.categories (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text not null default '',
  course_id uuid not null references public.courses(id),
  tags text[] default '{}',
  time_needed text default '15 min',
  trainer_type text not null default 'Self' check (trainer_type in ('Self', 'Manager', 'Self/Manager')),
  resource_link text,
  boutique_id uuid references public.boutiques(id), -- null = universal
  -- Sequencing & progression
  prerequisites uuid[] default '{}',             -- menu_item ids that should be done first
  priority_level text not null default 'week_1'
    check (priority_level in ('week_1', 'week_2_4', 'advanced')),
  is_recurring boolean not null default false,   -- true = revisit regularly (e.g. salon standards)
  created_at timestamptz default now()
);

alter table public.categories enable row level security;
create policy "Categories viewable by authenticated users" on public.categories
  for select using (auth.role() = 'authenticated');
create policy "Managers can insert categories" on public.categories
  for insert with check (
    exists (select 1 from public.users where id = auth.uid() and role in ('manager', 'head_office'))
  );
create policy "Managers can update categories" on public.categories
  for update using (
    exists (select 1 from public.users where id = auth.uid() and role in ('manager', 'head_office'))
  );

-- ─────────────────────────────────────────
-- FUNCTION: auto-create user profile on signup
-- ─────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, name, role, avatar_initials)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'trainee'),
    coalesce(new.raw_user_meta_data->>'avatar_initials', upper(left(coalesce(new.raw_user_meta_data->>'name', new.email), 2)))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
