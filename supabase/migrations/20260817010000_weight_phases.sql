-- Las fases (volumen/definición/mantenimiento) dejan de ser un valor puntual en el historial de
-- weight_goals y pasan a ser períodos con fecha de inicio y fin: se puede cargar una fase pasada
-- ya cerrada (ambas fechas) o la fase actual (solo inicio, end_date null = "en curso") y después
-- finalizarla poniéndole fecha de fin. weight_goals sigue existiendo tal cual para el peso objetivo
-- (su columna "phase" queda sin usarse desde el cliente, pero no se borra para no perder el historial).

create table public.weight_phases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  phase text not null check (phase in ('volumen','definicion','mantenimiento')),
  start_date date not null,
  end_date date,
  created_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

alter table public.weight_phases enable row level security;

create policy "select own weight_phases" on public.weight_phases for select using (auth.uid() = user_id);
create policy "insert own weight_phases" on public.weight_phases for insert with check (auth.uid() = user_id);
create policy "update own weight_phases" on public.weight_phases for update using (auth.uid() = user_id);
create policy "delete own weight_phases" on public.weight_phases for delete using (auth.uid() = user_id);
