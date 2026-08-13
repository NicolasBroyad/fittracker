create table if not exists public.weight_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  weight numeric(5,2) not null,
  note text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.weight_entries enable row level security;

create policy "select own entries"
  on public.weight_entries for select
  using (auth.uid() = user_id);

create policy "insert own entries"
  on public.weight_entries for insert
  with check (auth.uid() = user_id);

create policy "update own entries"
  on public.weight_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "delete own entries"
  on public.weight_entries for delete
  using (auth.uid() = user_id);
