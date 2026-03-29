create table if not exists public.user_data (
  id uuid primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

create policy if not exists "Users can read own data"
on public.user_data
for select
using (auth.uid() = id);

create policy if not exists "Users can insert own data"
on public.user_data
for insert
with check (auth.uid() = id);

create policy if not exists "Users can update own data"
on public.user_data
for update
using (auth.uid() = id)
with check (auth.uid() = id);
