-- Series/reps objetivo dejan de ser intrínsecas del ejercicio (routine_exercises) y pasan a
-- ser propias de cada asignación día+ejercicio (routine_exercise_days): el mismo ejercicio del
-- catálogo puede estar asignado a distintos días con distinta cantidad de series/rango de reps.

alter table public.routine_exercise_days add column sets_target smallint;
alter table public.routine_exercise_days add column reps_target text;

-- backfill: cada asignación existente arranca con el objetivo que hoy tiene su ejercicio
update public.routine_exercise_days red
set sets_target = re.sets_target, reps_target = re.reps_target
from public.routine_exercises re
where red.exercise_id = re.id;

alter table public.routine_exercises drop column sets_target;
alter table public.routine_exercises drop column reps_target;
