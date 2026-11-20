-- Reloj Garmin, segunda parte: peso diario desde el reloj y datos de actividad del reloj.
--
-- Aditiva: tablas y funciones nuevas; watch_routine suma la clave `w` (los clientes viejos la ignoran).
--   - watch_save_weight: el reloj carga el peso del día (mismas reglas que la web: uno por día, 20 a
--     400 kg, cada cambio queda en weight_entries_log).
--   - watch_save_health: el reloj sube lo que mide (pasos, calorías, distancia y minutos activos por
--     día, y las actividades que grabó: deporte, inicio, duración, distancia). Lo manda cada vez que
--     se abre la app; Connect IQ no da calorías ni FC de cada actividad, ni deja escribir en Garmin.
--   - watch_routine trae además `w`: los últimos 14 pesos ([[fecha, peso], ...], de más viejo a más nuevo).

-- ── Tablas ──────────────────────────────────────────────────────────────────

-- un registro por día; lo escribe solo el reloj (watch_save_health), la web lo lee
create table if not exists public.watch_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  steps integer,
  step_goal integer,
  calories integer,          -- kcal del día (incluye las de reposo)
  distance_m integer,
  active_minutes integer,
  resting_hr smallint,       -- FC en reposo (solo la del día en que se abrió la app)
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);
alter table public.watch_daily enable row level security;
drop policy if exists "select own watch_daily" on public.watch_daily;
create policy "select own watch_daily" on public.watch_daily for select using (auth.uid() = user_id);

-- actividades grabadas en el reloj (cardio, fuerza, etc.); `sport` es el deporte de Garmin (FIT):
-- 1 carrera, 2 ciclismo, 4 cardio en máquina, 5 natación, 10 entrenamiento, 11 caminata, 15 remo, 17 senderismo…
create table if not exists public.watch_activities (
  user_id uuid not null references auth.users(id) on delete cascade,
  start_time timestamptz not null,
  sport smallint,
  duration_s integer,
  distance_m integer,
  updated_at timestamptz not null default now(),
  primary key (user_id, start_time)
);
alter table public.watch_activities enable row level security;
drop policy if exists "select own watch_activities" on public.watch_activities;
create policy "select own watch_activities" on public.watch_activities for select using (auth.uid() = user_id);

-- ── Funciones ───────────────────────────────────────────────────────────────

-- interna: últimos 14 pesos de un usuario hasta una fecha
create or replace function public.watch_weights(p_user uuid, p_today date)
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_array(w.date, w.weight) order by w.date), '[]'::jsonb)
  from (
    select date, weight from public.weight_entries
    where user_id = p_user and date <= p_today
    order by date desc
    limit 14
  ) w
$$;
revoke execute on function public.watch_weights(uuid, date) from public, anon, authenticated;

create or replace function public.watch_routine(p_secret text, p_today date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := public.watch_user(p_secret);
  v_routine public.routines;
  v_result jsonb;
begin
  if v_user is null then
    return jsonb_build_object('err', 'unlinked');
  end if;
  select * into v_routine from public.routines where user_id = v_user and is_active limit 1;
  if v_routine.id is null then
    return jsonb_build_object('v', 1, 'r', null, 't', p_today, 'e', '[]'::jsonb, 'd', '[]'::jsonb,
                              'p', '[]'::jsonb, 'h', '[]'::jsonb, 'w', public.watch_weights(v_user, p_today));
  end if;

  with ex as (
    select e.id, e.name, (row_number() over (order by e.name, e.id) - 1)::int as idx
    from public.routine_exercises e
    where e.user_id = v_user
      and e.id in (select pe.exercise_id from public.routine_plan_exercises pe where pe.routine_id = v_routine.id)
  ),
  slots as (
    select pe.day_of_week, pe.order_index,
           jsonb_agg(jsonb_build_array(ex.idx, pe.sets_target, pe.reps_target) order by pe.variant) as alts
    from public.routine_plan_exercises pe
    join ex on ex.id = pe.exercise_id
    where pe.routine_id = v_routine.id
    group by pe.day_of_week, pe.order_index
  ),
  days as (
    select g.dow,
           jsonb_build_array(
             coalesce(pd.name, ''),
             coalesce(pd.is_rest, false),
             coalesce((select jsonb_agg(s.alts order by s.order_index) from slots s where s.day_of_week = g.dow),
                      '[]'::jsonb)
           ) as j
    from generate_series(1, 7) as g(dow)
    left join public.routine_plan_days pd on pd.routine_id = v_routine.id and pd.day_of_week = g.dow
  ),
  logs as (
    select l.*
    from public.routine_logs l
    join ex on ex.id = l.exercise_id
    where l.user_id = v_user and l.session_date <= p_today
  ),
  prev_dates as (
    select exercise_id, max(session_date) as d from logs where session_date < p_today group by exercise_id
  ),
  sess as (
    select l.exercise_id, l.session_date,
           jsonb_agg(jsonb_build_array(l.weight, l.reps, l.reps_right) order by l.set_number) as sets,
           -- unidad de la sesión: la de sus series con peso (como sessionUnit en la web)
           (array_agg(l.weight_unit order by (l.weight is null or l.weight <= 0), l.set_number))[1] as unit
    from logs l
    where l.session_date = p_today
       or (l.exercise_id, l.session_date) in (select exercise_id, d from prev_dates)
    group by l.exercise_id, l.session_date
  )
  select jsonb_build_object(
    'v', 1,
    'r', v_routine.name,
    't', p_today,
    'e', coalesce((select jsonb_agg(jsonb_build_array(ex.id, ex.name) order by ex.idx) from ex), '[]'::jsonb),
    'd', (select jsonb_agg(days.j order by days.dow) from days),
    'p', coalesce((select jsonb_agg(jsonb_build_array(ex.idx, s.session_date, s.unit, s.sets) order by ex.idx)
                   from sess s join ex on ex.id = s.exercise_id where s.session_date < p_today), '[]'::jsonb),
    'h', coalesce((select jsonb_agg(jsonb_build_array(ex.idx, s.unit, s.sets) order by ex.idx)
                   from sess s join ex on ex.id = s.exercise_id where s.session_date = p_today), '[]'::jsonb),
    'w', public.watch_weights(v_user, p_today)
  ) into v_result;
  return v_result;
end;
$$;


-- Peso del día desde el reloj: { ok: true } | { err: 'unlinked' | 'weight' }.
-- Como la web: crea o corrige el peso de esa fecha (conserva la nota) y lo anota en weight_entries_log.
-- Idempotente: si ya está ese peso no cambia nada (la cola del reloj puede reintentar).
create or replace function public.watch_save_weight(p_secret text, p_date date, p_weight numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := public.watch_user(p_secret);
  v_weight numeric(5,2) := round(p_weight, 2);
  v_prev public.weight_entries;
begin
  if v_user is null then
    return jsonb_build_object('err', 'unlinked');
  end if;
  if p_weight is null or p_weight < 20 or p_weight > 400 or p_date is null then
    return jsonb_build_object('err', 'weight');
  end if;
  select * into v_prev from public.weight_entries where user_id = v_user and date = p_date;
  if v_prev.date is not null and v_prev.weight = v_weight then
    return jsonb_build_object('ok', true);
  end if;
  insert into public.weight_entries (user_id, date, weight, note, updated_at)
  values (v_user, p_date, v_weight, '', now())
  on conflict (user_id, date) do update set weight = excluded.weight, updated_at = now();
  insert into public.weight_entries_log (user_id, entry_date, action, previous_weight, previous_note, new_weight, new_note)
  values (v_user, p_date, case when v_prev.date is null then 'created' else 'updated' end,
          v_prev.weight, v_prev.note, v_weight, coalesce(v_prev.note, ''));
  return jsonb_build_object('ok', true);
end;
$$;

-- Datos de actividad que mide el reloj: { ok: true, days: n, activities: m } | { err: 'unlinked' }.
-- p_days = [{ date, steps, step_goal, calories, distance_m, active_minutes, resting_hr }, ...] (máx. 14)
-- p_activities = [{ start (segundos Unix), sport, duration_s, distance_m }, ...] (máx. 50)
-- Reemplaza lo que había de esos días/actividades; un dato que no viene (null) no borra el anterior.
create or replace function public.watch_save_health(p_secret text, p_days jsonb, p_activities jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := public.watch_user(p_secret);
  v_days int;
  v_acts int;
begin
  if v_user is null then
    return jsonb_build_object('err', 'unlinked');
  end if;

  insert into public.watch_daily (user_id, date, steps, step_goal, calories, distance_m, active_minutes, resting_hr, updated_at)
  select v_user, (d->>'date')::date,
         nullif(d->>'steps', '')::int, nullif(d->>'step_goal', '')::int, nullif(d->>'calories', '')::int,
         nullif(d->>'distance_m', '')::int, nullif(d->>'active_minutes', '')::int,
         nullif(d->>'resting_hr', '')::smallint, now()
  from (select d from jsonb_array_elements(coalesce(p_days, '[]'::jsonb)) as t(d) limit 14) x
  where d->>'date' is not null
  on conflict (user_id, date) do update set
    steps = coalesce(excluded.steps, watch_daily.steps),
    step_goal = coalesce(excluded.step_goal, watch_daily.step_goal),
    calories = coalesce(excluded.calories, watch_daily.calories),
    distance_m = coalesce(excluded.distance_m, watch_daily.distance_m),
    active_minutes = coalesce(excluded.active_minutes, watch_daily.active_minutes),
    resting_hr = coalesce(excluded.resting_hr, watch_daily.resting_hr),
    updated_at = now();
  get diagnostics v_days = row_count;

  insert into public.watch_activities (user_id, start_time, sport, duration_s, distance_m, updated_at)
  select v_user, to_timestamp((a->>'start')::bigint),
         nullif(a->>'sport', '')::smallint, nullif(a->>'duration_s', '')::int, nullif(a->>'distance_m', '')::int, now()
  from (select a from jsonb_array_elements(coalesce(p_activities, '[]'::jsonb)) as t(a) limit 50) x
  where a->>'start' is not null
  on conflict (user_id, start_time) do update set
    sport = coalesce(excluded.sport, watch_activities.sport),
    duration_s = coalesce(excluded.duration_s, watch_activities.duration_s),
    distance_m = coalesce(excluded.distance_m, watch_activities.distance_m),
    updated_at = now();
  get diagnostics v_acts = row_count;

  return jsonb_build_object('ok', true, 'days', v_days, 'activities', v_acts);
end;
$$;

-- ── Permisos ────────────────────────────────────────────────────────────────

grant execute on function public.watch_save_weight(text, date, numeric) to anon, authenticated;
grant execute on function public.watch_save_health(text, jsonb, jsonb) to anon, authenticated;
