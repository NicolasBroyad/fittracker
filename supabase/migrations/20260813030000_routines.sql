-- Nombre del entrenamiento de cada día de la semana (ej. lunes = "Push 1")
create table public.routine_days (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7), -- 1=lunes .. 7=domingo
  name text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, day_of_week)
);

-- Ejercicios definidos para cada día (la "plantilla" de la rutina)
create table public.routine_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  name text not null,
  sets_target smallint,
  reps_target text,
  order_index smallint not null default 0,
  created_at timestamptz not null default now()
);

-- Cada serie realizada en una sesión de entrenamiento
create table public.routine_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.routine_exercises(id) on delete cascade,
  session_date date not null,
  set_number smallint not null,
  weight numeric(6,2),
  reps smallint,
  created_at timestamptz not null default now()
);

alter table public.routine_days enable row level security;
alter table public.routine_exercises enable row level security;
alter table public.routine_logs enable row level security;

create policy "select own routine_days" on public.routine_days for select using (auth.uid() = user_id);
create policy "insert own routine_days" on public.routine_days for insert with check (auth.uid() = user_id);
create policy "update own routine_days" on public.routine_days for update using (auth.uid() = user_id);
create policy "delete own routine_days" on public.routine_days for delete using (auth.uid() = user_id);

create policy "select own routine_exercises" on public.routine_exercises for select using (auth.uid() = user_id);
create policy "insert own routine_exercises" on public.routine_exercises for insert with check (auth.uid() = user_id);
create policy "update own routine_exercises" on public.routine_exercises for update using (auth.uid() = user_id);
create policy "delete own routine_exercises" on public.routine_exercises for delete using (auth.uid() = user_id);

create policy "select own routine_logs" on public.routine_logs for select using (auth.uid() = user_id);
create policy "insert own routine_logs" on public.routine_logs for insert with check (auth.uid() = user_id);
create policy "update own routine_logs" on public.routine_logs for update using (auth.uid() = user_id);
create policy "delete own routine_logs" on public.routine_logs for delete using (auth.uid() = user_id);
