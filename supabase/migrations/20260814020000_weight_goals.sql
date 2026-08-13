create table if not exists public.weight_goals (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  target_weight numeric(5,2),
  phase text check (phase in ('volumen','definicion','mantenimiento')),
  created_at timestamptz not null default now()
);

alter table public.weight_goals enable row level security;

create policy "select own goals"
  on public.weight_goals for select
  using (auth.uid() = user_id);

create policy "insert own goals"
  on public.weight_goals for insert
  with check (auth.uid() = user_id);
