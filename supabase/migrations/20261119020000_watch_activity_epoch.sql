-- Reloj Garmin: las actividades llegaban con la fecha corrida 20 años (ej. 20/11/2006 en vez de 19/11/2026).
--
-- UserActivity.startTime del reloj (UserProfile.getUserActivityHistory) viene en la época de Garmin/FIT
-- (segundos desde el 31/12/1989 00:00 UTC), no en Unix: hay que sumarle 631065600. watch_save_health
-- lo corrige solo si al sumarlo la fecha no queda en el futuro (un valor que ya viniera en Unix
-- quedaría 20 años adelante), así sirve con la app del reloj ya instalada y no rompe si algún día
-- el reloj manda segundos Unix. Además corrige las actividades ya guardadas.
-- Aditiva e idempotente.

create or replace function public.watch_unix_time(p_start bigint)
returns bigint
language sql
stable
set search_path = public
as $$
  -- 631065600 = diferencia entre la época FIT (1989-12-31) y la Unix (1970-01-01)
  select case when to_timestamp(p_start + 631065600) <= now() + interval '1 day' then p_start + 631065600 else p_start end
$$;
revoke execute on function public.watch_unix_time(bigint) from public, anon, authenticated;

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
  select v_user, to_timestamp(public.watch_unix_time((a->>'start')::bigint)),
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

grant execute on function public.watch_save_health(text, jsonb, jsonb) to anon, authenticated;

-- actividades ya guardadas con la época de Garmin (si la corregida ya existe, se descarta la vieja)
delete from public.watch_activities w
where w.start_time + interval '631065600 seconds' <= now() + interval '1 day'
  and exists (
    select 1 from public.watch_activities c
    where c.user_id = w.user_id and c.start_time = w.start_time + interval '631065600 seconds'
  );
update public.watch_activities
set start_time = start_time + interval '631065600 seconds'
where start_time + interval '631065600 seconds' <= now() + interval '1 day';
