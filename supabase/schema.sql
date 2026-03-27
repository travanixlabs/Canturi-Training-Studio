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
-- PLATES (daily assignments)
-- ─────────────────────────────────────────
create table public.plates (
  id uuid primary key default uuid_generate_v4(),
  trainee_id uuid not null references public.users(id),
  category_id uuid not null references public.categories(id),
  assigned_by uuid not null references public.users(id),
  date_assigned date not null default current_date,
  boutique_id uuid references public.boutiques(id),
  created_at timestamptz default now(),
  unique(trainee_id, category_id, date_assigned)
);

alter table public.plates enable row level security;
create policy "Trainees can view own plate" on public.plates
  for select using (trainee_id = auth.uid());
create policy "Managers can view plates in their boutique" on public.plates
  for select using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.role = 'manager'
        and u.boutique_id = plates.boutique_id
    )
  );
create policy "Head office can view all plates" on public.plates
  for select using (
    exists (select 1 from public.users where id = auth.uid() and role = 'head_office')
  );
create policy "Managers can insert plates" on public.plates
  for insert with check (
    exists (select 1 from public.users where id = auth.uid() and role = 'manager')
  );
create policy "Managers can delete plates" on public.plates
  for delete using (
    exists (select 1 from public.users where id = auth.uid() and role = 'manager')
  );

-- ─────────────────────────────────────────
-- COMPLETIONS
-- ─────────────────────────────────────────
create table public.completions (
  id uuid primary key default uuid_generate_v4(),
  plate_id uuid references public.plates(id),
  category_id uuid not null references public.categories(id),
  trainee_id uuid not null references public.users(id),
  trainer_id uuid references public.users(id),
  -- Trainee fields
  trainee_notes text,                            -- general notes / what was learned
  observed_notes text,                           -- shadowing: "What did you observe?"
  followup_questions text,                       -- shadowing: "What would you do differently or ask more about?"
  trainee_rating integer check (trainee_rating between 1 and 5), -- "How confident do you feel here?"
  -- Trainer fields (hidden from trainee)
  trainer_notes text,
  trainer_rating integer check (trainer_rating between 1 and 5),
  -- Coaching note (visible to trainee — not a rating, a message)
  manager_note text,
  -- Metadata
  completed_date date not null default current_date,
  is_shadowing_moment boolean not null default false,
  created_at timestamptz default now(),
  unique(trainee_id, category_id) -- one completion record per trainee per item
);

alter table public.completions enable row level security;
create policy "Trainees can view own completions" on public.completions
  for select using (trainee_id = auth.uid());
create policy "Managers can view completions in boutique" on public.completions
  for select using (
    exists (
      select 1 from public.users u
      join public.users t on t.id = completions.trainee_id
      where u.id = auth.uid() and u.role = 'manager' and u.boutique_id = t.boutique_id
    )
  );
create policy "Head office can view all completions" on public.completions
  for select using (
    exists (select 1 from public.users where id = auth.uid() and role = 'head_office')
  );
create policy "Trainees can insert own completions" on public.completions
  for insert with check (trainee_id = auth.uid());
create policy "Trainees can update own completions" on public.completions
  for update using (trainee_id = auth.uid());
create policy "Managers can update completions (trainer fields)" on public.completions
  for update using (
    exists (
      select 1 from public.users u
      join public.users t on t.id = completions.trainee_id
      where u.id = auth.uid() and u.role = 'manager' and u.boutique_id = t.boutique_id
    )
  );

-- ─────────────────────────────────────────
-- WEEKLY REFLECTIONS
-- ─────────────────────────────────────────
create table public.weekly_reflections (
  id uuid primary key default uuid_generate_v4(),
  trainee_id uuid not null references public.users(id),
  week_start date not null,                      -- Monday of the reflection week
  went_well text,                                -- "What went well this week?"
  still_to_explore text,                         -- "What do you want to revisit or dig deeper into?"
  confidence_areas text,                         -- "Where do you feel most / least confident right now?"
  sent_to_manager boolean not null default false,
  created_at timestamptz default now(),
  unique(trainee_id, week_start)
);

alter table public.weekly_reflections enable row level security;
create policy "Trainees can manage own reflections" on public.weekly_reflections
  for all using (trainee_id = auth.uid());
create policy "Managers can view reflections in boutique" on public.weekly_reflections
  for select using (
    exists (
      select 1 from public.users u
      join public.users t on t.id = weekly_reflections.trainee_id
      where u.id = auth.uid() and u.role = 'manager' and u.boutique_id = t.boutique_id
    )
  );
create policy "Head office can view all reflections" on public.weekly_reflections
  for select using (
    exists (select 1 from public.users where id = auth.uid() and role = 'head_office')
  );

-- ─────────────────────────────────────────
-- FEEDBACK FLAGS
-- Single-tap "something's not working" from any user → straight to Tre
-- ─────────────────────────────────────────
create table public.feedback_flags (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id),
  context text,                                  -- optional: what were they doing when it broke?
  created_at timestamptz default now()
);

alter table public.feedback_flags enable row level security;
create policy "Users can insert own feedback" on public.feedback_flags
  for insert with check (user_id = auth.uid());
create policy "Head office can view all feedback" on public.feedback_flags
  for select using (
    exists (select 1 from public.users where id = auth.uid() and role = 'head_office')
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
