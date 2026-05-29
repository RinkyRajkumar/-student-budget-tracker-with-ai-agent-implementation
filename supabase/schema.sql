-- Spendly Supabase schema
-- Run this file in the Supabase SQL editor before setting VITE_DATA_BACKEND=supabase.

create table if not exists public.spendly_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.create_spendly_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.spendly_profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_spendly_profile on auth.users;
create trigger on_auth_user_created_create_spendly_profile
  after insert on auth.users
  for each row execute function public.create_spendly_profile_for_new_user();

revoke execute on function public.create_spendly_profile_for_new_user() from public;
revoke execute on function public.create_spendly_profile_for_new_user() from anon, authenticated;

create table if not exists public.spendly_onboarding (
  user_id uuid primary key references auth.users(id) on delete cascade,
  monthly_income numeric(12,2) not null default 0,
  monthly_budget numeric(12,2) not null default 0,
  goal_name text not null default '',
  goal_target_amount numeric(12,2) not null default 0,
  target_date date,
  categories jsonb not null default '[]'::jsonb,
  subscriptions jsonb not null default '[]'::jsonb,
  complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.spendly_budget_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  monthly_limit numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.spendly_savings_goals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  target_amount numeric(12,2) not null default 0,
  current_amount numeric(12,2) not null default 0,
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.spendly_categories (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id integer not null,
  name text not null,
  color text not null default '#8b5cf6',
  icon text not null default '',
  is_custom boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.spendly_expenses (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id integer not null,
  category_name text not null,
  category_color text not null default '#8b5cf6',
  amount numeric(12,2) not null check (amount >= 0),
  spent_on date not null,
  note text not null default '',
  payment_method text not null default 'other',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.spendly_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null default 'Other',
  start_date date not null,
  end_date date not null,
  budget_amount numeric(12,2) not null default 0 check (budget_amount >= 0),
  notes text not null default '',
  category text not null default 'Food',
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

alter table public.spendly_events
  add column if not exists category text not null default 'Food',
  add column if not exists completed boolean not null default false;

alter table public.spendly_expenses
  add column if not exists event_id uuid references public.spendly_events(id) on delete set null,
  add column if not exists event_name text;

create table if not exists public.spendly_subscriptions (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric(12,2) not null check (amount >= 0),
  category_id integer not null,
  category_name text not null,
  category_color text not null default '#8b5cf6',
  billing_day integer not null default 1 check (billing_day between 1 and 28),
  interval_months integer not null default 1 check (interval_months > 0),
  payment_method text not null default 'other',
  notes text not null default '',
  active boolean not null default true,
  last_charged_month text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists spendly_expenses_user_spent_on_idx on public.spendly_expenses(user_id, spent_on desc);
create index if not exists spendly_events_user_dates_idx on public.spendly_events(user_id, start_date, end_date);
create index if not exists spendly_subscriptions_user_billing_idx on public.spendly_subscriptions(user_id, billing_day);
create unique index if not exists spendly_categories_user_name_idx on public.spendly_categories(user_id, lower(name));

grant select, insert, update, delete on public.spendly_profiles to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.spendly_onboarding to authenticated;
grant select, insert, update, delete on public.spendly_budget_settings to authenticated;
grant select, insert, update, delete on public.spendly_savings_goals to authenticated;
grant select, insert, update, delete on public.spendly_categories to authenticated;
grant select, insert, update, delete on public.spendly_expenses to authenticated;
grant select, insert, update, delete on public.spendly_events to authenticated;
grant select, insert, update, delete on public.spendly_subscriptions to authenticated;
grant usage, select on all sequences in schema public to authenticated;

alter table public.spendly_profiles enable row level security;
alter table public.profiles enable row level security;
alter table public.spendly_onboarding enable row level security;
alter table public.spendly_budget_settings enable row level security;
alter table public.spendly_savings_goals enable row level security;
alter table public.spendly_categories enable row level security;
alter table public.spendly_expenses enable row level security;
alter table public.spendly_events enable row level security;
alter table public.spendly_subscriptions enable row level security;

drop policy if exists "profiles are owned by user" on public.spendly_profiles;
create policy "profiles are owned by user" on public.spendly_profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "profiles table rows are owned by user" on public.profiles;
create policy "profiles table rows are owned by user" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "onboarding is owned by user" on public.spendly_onboarding;
create policy "onboarding is owned by user" on public.spendly_onboarding
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "budget settings are owned by user" on public.spendly_budget_settings;
create policy "budget settings are owned by user" on public.spendly_budget_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "savings goals are owned by user" on public.spendly_savings_goals;
create policy "savings goals are owned by user" on public.spendly_savings_goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "categories are owned by user" on public.spendly_categories;
create policy "categories are owned by user" on public.spendly_categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "expenses are owned by user" on public.spendly_expenses;
create policy "expenses are owned by user" on public.spendly_expenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "events are owned by user" on public.spendly_events;
create policy "events are owned by user" on public.spendly_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "subscriptions are owned by user" on public.spendly_subscriptions;
create policy "subscriptions are owned by user" on public.spendly_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
