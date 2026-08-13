create table if not exists public.weight_entries_log (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entry_date date not null,
  action text not null check (action in ('created','updated','deleted')),
  previous_weight numeric(5,2),
  previous_note text,
  new_weight numeric(5,2),
  new_note text,
  changed_at timestamptz not null default now()
);

alter table public.weight_entries_log enable row level security;

create policy "select own log"
  on public.weight_entries_log for select
  using (auth.uid() = user_id);

create policy "insert own log"
  on public.weight_entries_log for insert
  with check (auth.uid() = user_id);
