-- Reloj Garmin: actividades borradas.
--
-- Connect IQ no ve Garmin Connect: si una actividad se borra en la app de Garmin del celular, el
-- reloj la sigue teniendo en su historial y la sigue mandando. Entonces:
--   - watch_save_health borra las que el reloj ya no manda (se borraron en el reloj), dentro del
--     período que cubre la lista que mandó.
--   - La web puede borrar una actividad (watch_activities.hidden_at): queda oculta y, aunque el
--     reloj la vuelva a mandar, no reaparece (la subida no toca hidden_at).
-- Aditiva e idempotente.

alter table public.watch_activities add column if not exists hidden_at timestamptz;

-- el dueño solo puede ocultar/mostrar (la política deja actualizar sus filas; el permiso de columna
-- limita a hidden_at)
drop policy if exists "update own watch_activities" on public.watch_activities;
create policy "update own watch_activities" on public.watch_activities
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke update on public.watch_activities from anon, authenticated;
grant update (hidden_at) on public.watch_activities to authenticated;

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
  v_starts timestamptz[];
  v_hi timestamptz;
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

  -- lo que el reloj ya no tiene en su historial (se borró en el reloj) se borra acá también,
  -- dentro del período que cubre la lista: desde la más vieja que mandó y, si mandó menos de 30
  -- (el tope de la app del reloj, o sea su historial entero), sin límite hacia adelante; si mandó
  -- 30, hasta la más nueva (por si el reloj las da en otro orden). Una lista vacía no borra nada
  -- (también es lo que manda un reloj sin historial de actividades).
  select array_agg(to_timestamp(public.watch_unix_time((a->>'start')::bigint)))
  into v_starts
  from (select a from jsonb_array_elements(coalesce(p_activities, '[]'::jsonb)) as t(a) limit 50) x
  where a->>'start' is not null;
  if v_starts is not null then
    v_hi := case when cardinality(v_starts) < 30 then 'infinity'::timestamptz
                 else (select max(s) from unnest(v_starts) s) end;
    delete from public.watch_activities
    where user_id = v_user
      and start_time >= (select min(s) from unnest(v_starts) s)
      and start_time <= v_hi
      and not (start_time = any(v_starts));
  end if;

  return jsonb_build_object('ok', true, 'days', v_days, 'activities', v_acts);
end;
$$;

grant execute on function public.watch_save_health(text, jsonb, jsonb) to anon, authenticated;
