-- Vuelve a existir el concepto de "alternativas": dos ejercicios del catálogo pueden compartir
-- la misma posición (slot) dentro de un día puntual, distinguidos por variant (0=principal, 1="b", 2="c"...).
-- A diferencia de como era antes de la migración del catálogo, el ejercicio en sí sigue siendo una
-- entidad única y reusable entre varios días — variant vive en la asignación día+ejercicio
-- (routine_exercise_days), no en el ejercicio (routine_exercises).
alter table public.routine_exercise_days add column variant smallint not null default 0;
