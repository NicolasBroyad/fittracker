-- FitTracker 2.0
--
-- Esta migración es 100% aditiva: la app 1.x sigue en producción contra la misma base, así que no se
-- modifica ni se borra nada de lo que ella usa (routine_days / routine_exercise_days siguen intactas).
--
-- 1) Múltiples rutinas con una sola activa por usuario. La estructura de cada rutina vive en tablas
--    nuevas (routine_plan_days / routine_plan_exercises). El catálogo de ejercicios (routine_exercises)
--    y el registro de series (routine_logs) se comparten con la 1.x: un ejercicio es la misma entidad
--    en todas las rutinas y días, con un único historial.
-- 2) Metas de peso con plazo: weight_goals.target_date (nullable; la 1.x no la manda y queda null).
-- 3) Grupos musculares adicionales.
-- 4) Funciones RPC para operaciones que tienen que ser atómicas (reemplazar las series de un día,
--    guardar un día de rutina completo, cambiar la rutina activa).
-- 5) Índices para las consultas más frecuentes.

-- ─────────────────────────────────────────────────────────────────────────────
-- Rutinas
-- ─────────────────────────────────────────────────────────────────────────────

create table public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

-- como mucho una rutina activa por usuario
create unique index routines_one_active_per_user on public.routines (user_id) where is_active;

-- configuración de cada día de la semana dentro de una rutina (nombre del entrenamiento, descanso)
create table public.routine_plan_days (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  routine_id uuid not null references public.routines(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7), -- 1=lunes .. 7=domingo
  name text not null default '',
  is_rest boolean not null default false,
  primary key (routine_id, day_of_week)
);

-- ejercicios de un día de una rutina. order_index es el puesto (slot) 1, 2, 3...; varias filas del
-- mismo día pueden compartir order_index si son alternativas entre sí (variant 0 = a, 1 = b, ...).
create table public.routine_plan_exercises (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  routine_id uuid not null references public.routines(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  exercise_id uuid not null references public.routine_exercises(id) on delete cascade,
  order_index smallint not null default 0,
  variant smallint not null default 0,
  sets_target smallint check (sets_target is null or sets_target between 1 and 20),
  reps_target text,
  primary key (routine_id, day_of_week, exercise_id)
);

create index routine_plan_exercises_exercise_idx on public.routine_plan_exercises (exercise_id);

alter table public.routines enable row level security;
alter table public.routine_plan_days enable row level security;
alter table public.routine_plan_exercises enable row level security;

create policy "select own routines" on public.routines for select using (auth.uid() = user_id);
create policy "insert own routines" on public.routines for insert with check (auth.uid() = user_id);
create policy "update own routines" on public.routines for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own routines" on public.routines for delete using (auth.uid() = user_id);

create policy "select own routine_plan_days" on public.routine_plan_days for select using (auth.uid() = user_id);
create policy "insert own routine_plan_days" on public.routine_plan_days for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.routines r where r.id = routine_id and r.user_id = auth.uid())
);
create policy "update own routine_plan_days" on public.routine_plan_days for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own routine_plan_days" on public.routine_plan_days for delete using (auth.uid() = user_id);

create policy "select own routine_plan_exercises" on public.routine_plan_exercises for select using (auth.uid() = user_id);
create policy "insert own routine_plan_exercises" on public.routine_plan_exercises for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.routines r where r.id = routine_id and r.user_id = auth.uid())
  and exists (select 1 from public.routine_exercises e where e.id = exercise_id and e.user_id = auth.uid())
);
create policy "update own routine_plan_exercises" on public.routine_plan_exercises for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own routine_plan_exercises" on public.routine_plan_exercises for delete using (auth.uid() = user_id);

-- Backfill: la rutina que hoy existe en la 1.x pasa a ser la primera rutina (activa) de la 2.0.
-- Es una copia: de acá en adelante la 1.x y la 2.0 editan la estructura de rutina por separado.
insert into public.routines (user_id, name, is_active)
select u.user_id, 'Mi rutina', true
from (
  select user_id from public.routine_days
  union
  select user_id from public.routine_exercise_days
) u;

insert into public.routine_plan_days (user_id, routine_id, day_of_week, name, is_rest)
select d.user_id, r.id, d.day_of_week, d.name, d.is_rest
from public.routine_days d
join public.routines r on r.user_id = d.user_id and r.is_active;

insert into public.routine_plan_exercises (user_id, routine_id, day_of_week, exercise_id, order_index, variant, sets_target, reps_target)
select e.user_id, r.id, e.day_of_week, e.exercise_id, e.order_index, e.variant, e.sets_target, e.reps_target
from public.routine_exercise_days e
join public.routines r on r.user_id = e.user_id and r.is_active;

-- ─────────────────────────────────────────────────────────────────────────────
-- Metas de peso con plazo
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.weight_goals add column target_date date;

-- ─────────────────────────────────────────────────────────────────────────────
-- Grupos musculares
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.routine_exercises drop constraint if exists routine_exercises_muscle_group_check;
alter table public.routine_exercises add constraint routine_exercises_muscle_group_check check (
  muscle_group in ('Pecho','Espalda','Hombro','Biceps','Tricep','Antebrazo','Pierna','Gluteo','Gemelo','Abdomen')
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Índices
-- ─────────────────────────────────────────────────────────────────────────────

create index if not exists routine_logs_exercise_date_idx on public.routine_logs (exercise_id, session_date);
create index if not exists routine_logs_user_date_idx on public.routine_logs (user_id, session_date);

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC (security invoker: corren con los permisos y el RLS del usuario que llama)
-- ─────────────────────────────────────────────────────────────────────────────

-- Reemplaza todas las series de un ejercicio en una fecha. p_sets = [{ "weight": 80, "reps": 8 }, ...]
-- en orden; set_number sale de la posición. Un array vacío borra la sesión de ese día.
create or replace function public.replace_session_sets(p_exercise_id uuid, p_session_date date, p_sets jsonb)
returns setof public.routine_logs
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from public.routine_logs
  where exercise_id = p_exercise_id and session_date = p_session_date and user_id = auth.uid();

  return query
  with inserted as (
    insert into public.routine_logs (exercise_id, session_date, set_number, weight, reps)
    select p_exercise_id, p_session_date, t.n::smallint,
           nullif(t.s->>'weight', '')::numeric(6,2),
           nullif(t.s->>'reps', '')::smallint
    from jsonb_array_elements(coalesce(p_sets, '[]'::jsonb)) with ordinality as t(s, n)
    returning *
  )
  select * from inserted;
end;
$$;

-- Guarda un día completo de una rutina: nombre, descanso y la lista entera de ejercicios.
-- p_items = [{ "exercise_id": "...", "order_index": 1, "variant": 0, "sets_target": 4, "reps_target": "8-10" }, ...]
create or replace function public.save_routine_day(
  p_routine_id uuid, p_day smallint, p_name text, p_is_rest boolean, p_items jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.routine_plan_days (routine_id, day_of_week, name, is_rest)
  values (p_routine_id, p_day, coalesce(p_name, ''), coalesce(p_is_rest, false))
  on conflict (routine_id, day_of_week)
  do update set name = excluded.name, is_rest = excluded.is_rest;

  delete from public.routine_plan_exercises
  where routine_id = p_routine_id and day_of_week = p_day and user_id = auth.uid();

  insert into public.routine_plan_exercises
    (routine_id, day_of_week, exercise_id, order_index, variant, sets_target, reps_target)
  select p_routine_id, p_day, (i->>'exercise_id')::uuid,
         coalesce((i->>'order_index')::smallint, 0),
         coalesce((i->>'variant')::smallint, 0),
         nullif(i->>'sets_target', '')::smallint,
         nullif(trim(coalesce(i->>'reps_target', '')), '')
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) i;
end;
$$;

-- Deja activa una sola rutina (dos updates en orden para no chocar con el índice único parcial).
create or replace function public.set_active_routine(p_routine_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.routines set is_active = false
  where user_id = auth.uid() and is_active and id <> p_routine_id;

  update public.routines set is_active = true
  where user_id = auth.uid() and id = p_routine_id;
end;
$$;

grant execute on function public.replace_session_sets(uuid, date, jsonb) to authenticated;
grant execute on function public.save_routine_day(uuid, smallint, text, boolean, jsonb) to authenticated;
grant execute on function public.set_active_routine(uuid) to authenticated;
