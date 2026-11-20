-- Reloj Garmin (app de Connect IQ del repo fittracker-garmin).
--
-- Aditiva: tablas y funciones nuevas, no toca nada de lo que usan la 1.x ni la web.
--
-- El reloj no puede iniciar sesión con contraseña, así que se vincula una vez:
--   1. el reloj llama a watch_pair_start() (con la anon key) y recibe un código de 6 dígitos y un
--      secreto largo que guarda;
--   2. el usuario escribe el código en la web (Ajustes → Reloj Garmin) → watch_pair_confirm(), que
--      corre con su sesión y crea el reloj en watch_devices;
--   3. el reloj consulta watch_pair_status(secreto) hasta que diga { s: 'linked' }.
-- Desde ahí el reloj usa el secreto como token en watch_routine / watch_save_sets (security definer:
-- el usuario sale del token, no de auth.uid()). En la base solo queda el sha256 del secreto.
-- Desvincular = borrar la fila de watch_devices (lo hace la web con RLS).

-- ── Tablas ──────────────────────────────────────────────────────────────────

create table if not exists public.watch_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Reloj Garmin',
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

alter table public.watch_devices enable row level security;
-- la web lista y desvincula; altas y cambios solo por las funciones
drop policy if exists "select own watch_devices" on public.watch_devices;
create policy "select own watch_devices" on public.watch_devices for select using (auth.uid() = user_id);
drop policy if exists "delete own watch_devices" on public.watch_devices;
create policy "delete own watch_devices" on public.watch_devices for delete using (auth.uid() = user_id);

-- vinculaciones pendientes (duran 10 minutos); sin políticas: solo se tocan desde las funciones
create table if not exists public.watch_pairings (
  code text primary key,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.watch_pairings enable row level security;

-- códigos mal escritos, para limitar los intentos por usuario
create table if not exists public.watch_pair_failures (
  user_id uuid not null references auth.users(id) on delete cascade,
  at timestamptz not null default now()
);
create index if not exists watch_pair_failures_user_idx on public.watch_pair_failures (user_id, at);
alter table public.watch_pair_failures enable row level security;

-- ── Funciones internas ──────────────────────────────────────────────────────

create or replace function public.watch_token_hash(p_secret text)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(sha256(convert_to(coalesce(p_secret, ''), 'UTF8')), 'hex')
$$;

-- usuario dueño del token (o null) y marca la última vez que se vio el reloj
create or replace function public.watch_user(p_secret text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  update public.watch_devices set last_seen_at = now()
  where token_hash = public.watch_token_hash(p_secret)
  returning user_id into v_user;
  return v_user;
end;
$$;

revoke execute on function public.watch_token_hash(text) from public, anon, authenticated;
revoke execute on function public.watch_user(text) from public, anon, authenticated;

-- ── Vinculación ─────────────────────────────────────────────────────────────

-- La llama el reloj sin sesión. Devuelve { code, secret, expires_in } o { err: 'busy' }.
create or replace function public.watch_pair_start()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_code text;
begin
  delete from public.watch_pairings where expires_at < now();
  -- la función es pública (anon key): que nadie pueda llenar la tabla
  if (select count(*) from public.watch_pairings) >= 50 then
    return jsonb_build_object('err', 'busy');
  end if;
  loop
    v_code := lpad(floor(random() * 1000000)::int::text, 6, '0');
    exit when not exists (select 1 from public.watch_pairings where code = v_code);
  end loop;
  insert into public.watch_pairings (code, token_hash, expires_at)
  values (v_code, public.watch_token_hash(v_secret), now() + interval '10 minutes');
  return jsonb_build_object('code', v_code, 'secret', v_secret, 'expires_in', 600);
end;
$$;

-- La llama el reloj mientras muestra el código: { s: 'linked' | 'pending' | 'expired' }.
-- Devuelve un objeto y no un texto suelto porque Connect IQ no acepta un string JSON como cuerpo
-- de la respuesta (makeWebRequest da -400). El drop es por si quedó la versión que devolvía text.
drop function if exists public.watch_pair_status(text);
create function public.watch_pair_status(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text := public.watch_token_hash(p_secret);
begin
  if exists (select 1 from public.watch_devices where token_hash = v_hash) then
    delete from public.watch_pairings where token_hash = v_hash;
    return jsonb_build_object('s', 'linked');
  end if;
  if exists (select 1 from public.watch_pairings where token_hash = v_hash and expires_at >= now()) then
    return jsonb_build_object('s', 'pending');
  end if;
  return jsonb_build_object('s', 'expired');
end;
$$;

-- La llama la web con la sesión del usuario: 'ok', 'invalid' (código mal o vencido) o 'too_many'.
-- No tira excepciones para que los intentos fallidos queden registrados.
create or replace function public.watch_pair_confirm(p_code text, p_name text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_pairing public.watch_pairings;
begin
  if v_user is null then
    raise exception 'No hay sesión iniciada';
  end if;
  delete from public.watch_pair_failures where at < now() - interval '1 hour';
  if (select count(*) from public.watch_pair_failures where user_id = v_user) >= 10 then
    return 'too_many';
  end if;

  select * into v_pairing from public.watch_pairings
  where code = trim(coalesce(p_code, '')) and expires_at >= now();
  if v_pairing.code is null then
    insert into public.watch_pair_failures (user_id) values (v_user);
    return 'invalid';
  end if;

  insert into public.watch_devices (user_id, name, token_hash)
  values (v_user, coalesce(nullif(trim(p_name), ''), 'Reloj Garmin'), v_pairing.token_hash)
  on conflict (token_hash) do nothing;
  -- el código ya no sirve; el reloj se entera por watch_pair_status (busca en watch_devices)
  update public.watch_pairings set expires_at = now() - interval '1 second' where code = v_pairing.code;
  return 'ok';
end;
$$;

-- ── Datos para el reloj ─────────────────────────────────────────────────────

-- Rutina activa compacta para guardar en el reloj (pesa poco: el reloj tiene ~128 KB).
-- p_today = fecha local del reloj (la del servidor está en UTC).
--   v: versión del formato
--   r: nombre de la rutina (null si no hay activa)
--   t: p_today
--   e: [[id, nombre], ...]              ejercicios de la rutina; el resto los referencia por índice
--   d: 7 días (0 = lunes): [nombre, descanso, puestos]
--        puesto = [[ejercicio, series, reps], ...] (alternativas ordenadas por variant)
--   p: [[ejercicio, fecha, unidad, series], ...]   última sesión antes de p_today
--   h: [[ejercicio, unidad, series], ...]          lo ya cargado el día p_today
--        serie = [peso, reps (izq.), reps der. o null]
-- Si el token no corresponde a ningún reloj: { err: 'unlinked' }.
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
                              'p', '[]'::jsonb, 'h', '[]'::jsonb);
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
                   from sess s join ex on ex.id = s.exercise_id where s.session_date = p_today), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

-- Reemplaza las series de un ejercicio en una fecha, igual que replace_session_sets pero con el
-- usuario del token. Idempotente: la cola del reloj puede reintentar sin duplicar.
-- p_sets = [{ "weight": 7.5, "reps": 12, "weight_unit": "ladrillos", "reps_right": 10 }, ...]
-- Devuelve { ok: cantidad } o { err: 'unlinked' | 'exercise' }.
create or replace function public.watch_save_sets(p_secret text, p_exercise_id uuid, p_session_date date, p_sets jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := public.watch_user(p_secret);
  v_count int;
begin
  if v_user is null then
    return jsonb_build_object('err', 'unlinked');
  end if;
  if not exists (select 1 from public.routine_exercises where id = p_exercise_id and user_id = v_user) then
    return jsonb_build_object('err', 'exercise');
  end if;

  delete from public.routine_logs
  where exercise_id = p_exercise_id and session_date = p_session_date and user_id = v_user;

  insert into public.routine_logs (user_id, exercise_id, session_date, set_number, weight, reps, weight_unit, reps_right)
  select v_user, p_exercise_id, p_session_date, t.n::smallint,
         nullif(t.s->>'weight', '')::numeric(6,2),
         nullif(t.s->>'reps', '')::smallint,
         coalesce(nullif(t.s->>'weight_unit', ''), 'kg'),
         nullif(t.s->>'reps_right', '')::smallint
  from jsonb_array_elements(coalesce(p_sets, '[]'::jsonb)) with ordinality as t(s, n);
  get diagnostics v_count = row_count;
  return jsonb_build_object('ok', v_count);
end;
$$;

-- ── Permisos ────────────────────────────────────────────────────────────────

-- las del reloj se llaman con la anon key (se autentican con el token)
grant execute on function public.watch_pair_start() to anon, authenticated;
grant execute on function public.watch_pair_status(text) to anon, authenticated;
grant execute on function public.watch_routine(text, date) to anon, authenticated;
grant execute on function public.watch_save_sets(text, uuid, date, jsonb) to anon, authenticated;
-- vincular, solo con sesión
revoke execute on function public.watch_pair_confirm(text, text) from public, anon;
grant execute on function public.watch_pair_confirm(text, text) to authenticated;
