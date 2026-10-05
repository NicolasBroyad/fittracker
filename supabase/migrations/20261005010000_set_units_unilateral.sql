-- Series en ladrillos y series por lado (unilaterales).
--
-- Aditiva: la 1.x sigue usando routine_logs sin enterarse. Sus filas (y las de cualquier cliente
-- viejo) quedan en kg y bilaterales por los valores por defecto.
--
-- weight_unit: unidad del peso de la serie ('kg' o 'ladrillos', para máquinas que no dicen cuánto
--              pesa cada placa; se permiten medios ladrillos: numeric(6,2) ya lo admite).
-- reps_right:  en una serie por lado, las reps del lado derecho (reps = izquierdo). null = ambos
--              lados juntos (bilateral).

alter table public.routine_logs
  add column if not exists weight_unit text not null default 'kg',
  add column if not exists reps_right smallint;

alter table public.routine_logs drop constraint if exists routine_logs_weight_unit_check;
alter table public.routine_logs
  add constraint routine_logs_weight_unit_check check (weight_unit in ('kg', 'ladrillos'));

alter table public.routine_logs drop constraint if exists routine_logs_reps_right_check;
alter table public.routine_logs
  add constraint routine_logs_reps_right_check check (reps_right is null or reps_right >= 0);

-- Misma firma que en 20260925000000_v2_routines.sql; ahora también guarda la unidad y las reps del
-- lado derecho. Si un elemento no trae esas claves (cliente viejo), queda en kg y bilateral.
-- p_sets = [{ "weight": 7.5, "reps": 12, "weight_unit": "ladrillos", "reps_right": 10 }, ...]
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
    insert into public.routine_logs (exercise_id, session_date, set_number, weight, reps, weight_unit, reps_right)
    select p_exercise_id, p_session_date, t.n::smallint,
           nullif(t.s->>'weight', '')::numeric(6,2),
           nullif(t.s->>'reps', '')::smallint,
           coalesce(nullif(t.s->>'weight_unit', ''), 'kg'),
           nullif(t.s->>'reps_right', '')::smallint
    from jsonb_array_elements(coalesce(p_sets, '[]'::jsonb)) with ordinality as t(s, n)
    returning *
  )
  select * from inserted;
end;
$$;

grant execute on function public.replace_session_sets(uuid, date, jsonb) to authenticated;
