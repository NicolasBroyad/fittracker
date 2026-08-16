-- Los ejercicios pasan de pertenecer a un único día a ser un catálogo independiente
-- (creado/editado/borrado en un apartado propio) asignable a varios días de la rutina.
-- Cada variante existente (columna "variant") ya era una fila propia en routine_exercises,
-- así que pasa a ser directamente un ejercicio independiente del catálogo, sin migración especial.

alter table public.routine_exercises
  add column muscle_group text check (muscle_group in ('Pierna','Pecho','Hombro','Tricep','Biceps','Espalda'));

-- Asignación de un ejercicio del catálogo a un día de la semana, con su posición en ese día.
-- Un mismo ejercicio puede tener una fila por cada día al que está asignado.
create table public.routine_exercise_days (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.routine_exercises(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  order_index smallint not null default 0,
  primary key (exercise_id, day_of_week)
);

alter table public.routine_exercise_days enable row level security;

create policy "select own routine_exercise_days" on public.routine_exercise_days for select using (auth.uid() = user_id);
create policy "insert own routine_exercise_days" on public.routine_exercise_days for insert with check (auth.uid() = user_id);
create policy "update own routine_exercise_days" on public.routine_exercise_days for update using (auth.uid() = user_id);
create policy "delete own routine_exercise_days" on public.routine_exercise_days for delete using (auth.uid() = user_id);

-- migra la asignación día+orden que hoy vive en routine_exercises hacia la nueva tabla
insert into public.routine_exercise_days (user_id, exercise_id, day_of_week, order_index)
select user_id, id, day_of_week, order_index from public.routine_exercises;

alter table public.routine_exercises drop column day_of_week;
alter table public.routine_exercises drop column order_index;
alter table public.routine_exercises drop column variant;
