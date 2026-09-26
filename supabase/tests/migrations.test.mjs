/**
 * Aplica todas las migraciones sobre un Postgres en memoria (PGlite, sin Docker ni red) con un
 * esquema auth simulado como el de Supabase, y verifica el backfill de la 2.0, las funciones RPC y
 * el RLS entre dos usuarios. Uso: npm run test:db
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MIG = fileURLToPath(new URL('../migrations', import.meta.url));
const db = new PGlite();
const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
let fails = 0;
const ok = (cond, msg) => {
  console.log((cond ? '  ✔ ' : '  ✘ ') + msg);
  if (!cond) fails++;
};
const as = async (uid, fn) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role;`);
  }
};

// stub del entorno de Supabase
await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role authenticated;
  grant usage on schema auth to authenticated;
  grant execute on function auth.uid() to authenticated;
  insert into auth.users values ('${A}'), ('${B}');
`);

const files = readdirSync(MIG).sort();
const v2 = files.find((f) => f.includes('v2_routines'));
for (const f of files.filter((f) => f !== v2)) await db.exec(readFileSync(`${MIG}/${f}`, 'utf8'));
console.log('migraciones 1.x aplicadas:', files.length - 1);

// datos como los dejaría la 1.x (el usuario A tiene rutina; B no)
await db.exec(`
  insert into public.routine_days (user_id, day_of_week, name, is_rest) values ('${A}', 1, 'Push', false), ('${A}', 4, '', true);
  insert into public.routine_exercises (id, user_id, name, muscle_group) values
    ('aaaaaaaa-0000-0000-0000-000000000001', '${A}', 'Press banca', 'Pecho'),
    ('aaaaaaaa-0000-0000-0000-000000000002', '${A}', 'Press inclinado', 'Pecho'),
    ('aaaaaaaa-0000-0000-0000-000000000003', '${A}', 'Press inclinado Smith', 'Pecho');
  insert into public.routine_exercise_days (user_id, exercise_id, day_of_week, order_index, variant, sets_target, reps_target) values
    ('${A}', 'aaaaaaaa-0000-0000-0000-000000000001', 1, 1, 0, 4, '6-8'),
    ('${A}', 'aaaaaaaa-0000-0000-0000-000000000002', 1, 2, 0, 3, '8-10'),
    ('${A}', 'aaaaaaaa-0000-0000-0000-000000000003', 1, 2, 1, 3, '8-10');
  insert into public.routine_logs (user_id, exercise_id, session_date, set_number, weight, reps) values
    ('${A}', 'aaaaaaaa-0000-0000-0000-000000000001', '2026-09-20', 1, 80, 8);
`);

await db.exec(readFileSync(`${MIG}/${v2}`, 'utf8'));
console.log('migración 2.0 aplicada');

// Supabase da estos permisos por defecto a "authenticated"
await db.exec(`grant usage on schema public to authenticated;
  grant all on all tables in schema public to authenticated;
  grant all on all sequences in schema public to authenticated;`);

console.log('\nBackfill');
const r = await db.query(`select user_id, name, is_active from public.routines`);
ok(
  r.rows.length === 1 && r.rows[0].user_id === A && r.rows[0].is_active && r.rows[0].name === 'Mi rutina',
  'una rutina activa "Mi rutina" solo para el usuario con datos',
);
const d = await db.query(`select day_of_week, name, is_rest from public.routine_plan_days order by 1`);
ok(d.rows.length === 2 && d.rows[0].name === 'Push' && d.rows[1].is_rest === true, 'días copiados (nombre y descanso)');
const it = await db.query(
  `select exercise_id, order_index, variant, sets_target, reps_target from public.routine_plan_exercises order by order_index, variant`,
);
ok(
  it.rows.length === 3 && it.rows[2].variant === 1 && it.rows[2].order_index === 2 && it.rows[0].reps_target === '6-8',
  'ejercicios copiados con puesto, alternativa y objetivo',
);
const v1 = await db.query(`select count(*)::int n from public.routine_exercise_days`);
ok(v1.rows[0].n === 3, 'tablas de la 1.x intactas');

const rid = r.rows[0] && (await db.query(`select id from public.routines`)).rows[0].id;

console.log('\nRPC como usuario A');
await as(A, async () => {
  const mine = await db.query(`select count(*)::int n from public.routines`);
  ok(mine.rows[0].n === 1, 'A ve su rutina');

  await db.query(`select public.save_routine_day($1, 1::smallint, 'Pecho y tríceps', false, $2::jsonb)`, [
    rid,
    JSON.stringify([
      { exercise_id: 'aaaaaaaa-0000-0000-0000-000000000002', order_index: 1, variant: 0, sets_target: 4, reps_target: '6-8' },
      { exercise_id: 'aaaaaaaa-0000-0000-0000-000000000001', order_index: 2, variant: 0, sets_target: null, reps_target: '' },
    ]),
  ]);
  const day = await db.query(`select name from public.routine_plan_days where routine_id = $1 and day_of_week = 1`, [rid]);
  const items = await db.query(
    `select exercise_id, order_index, sets_target, reps_target from public.routine_plan_exercises where routine_id = $1 and day_of_week = 1 order by order_index`,
    [rid],
  );
  ok(day.rows[0].name === 'Pecho y tríceps', 'save_routine_day actualiza el nombre del día');
  ok(
    items.rows.length === 2 && items.rows[1].sets_target === null && items.rows[1].reps_target === null,
    'save_routine_day reemplaza la lista (y vacíos → null)',
  );

  const ins = await db.query(
    `select * from public.replace_session_sets('aaaaaaaa-0000-0000-0000-000000000001', '2026-09-20', $1::jsonb)`,
    [
      JSON.stringify([
        { weight: 82.5, reps: 8 },
        { weight: 82.5, reps: 7 },
        { weight: null, reps: 12 },
      ]),
    ],
  );
  ok(
    ins.rows.length === 3 && Number(ins.rows[0].weight) === 82.5 && ins.rows[2].weight === null && ins.rows[2].set_number === 3,
    'replace_session_sets reemplaza y numera las series',
  );
  const logs = await db.query(`select count(*)::int n from public.routine_logs where session_date = '2026-09-20'`);
  ok(logs.rows[0].n === 3, 'la serie vieja de ese día se reemplazó');
  await db.query(`select * from public.replace_session_sets('aaaaaaaa-0000-0000-0000-000000000001', '2026-09-20', '[]'::jsonb)`);
  const logs2 = await db.query(`select count(*)::int n from public.routine_logs where session_date = '2026-09-20'`);
  ok(logs2.rows[0].n === 0, 'array vacío borra la sesión');

  const r2 = await db.query(`insert into public.routines (name) values ('Full body') returning id`);
  await db.query(`select public.set_active_routine($1)`, [r2.rows[0].id]);
  const act = await db.query(`select name from public.routines where is_active`);
  ok(act.rows.length === 1 && act.rows[0].name === 'Full body', 'set_active_routine deja una sola activa');
  await db.query(`select public.set_active_routine($1)`, [rid]);
  const act2 = await db.query(`select name from public.routines where is_active`);
  ok(act2.rows.length === 1 && act2.rows[0].name === 'Mi rutina', 'y se puede volver a cambiar');

  let dup = false;
  try {
    await db.query(`update public.routines set is_active = true`);
  } catch {
    dup = true;
  }
  ok(dup, 'el índice impide dos rutinas activas a la vez');

  const g = await db.query(
    `insert into public.weight_goals (target_weight, target_date) values (74.5, '2026-12-01') returning target_date`,
  );
  ok(g.rows.length === 1, 'weight_goals acepta target_date');

  await db.query(`insert into public.routine_exercises (name, muscle_group) values ('Hip thrust', 'Gluteo')`);
  let bad = false;
  try {
    await db.query(`insert into public.routine_exercises (name, muscle_group) values ('X', 'Cuadriceps')`);
  } catch {
    bad = true;
  }
  ok(bad, 'grupos musculares nuevos válidos, desconocidos rechazados');

  let del = await db.query(`delete from public.routines where id = $1 returning id`, [r2.rows[0].id]);
  ok(del.rows.length === 1, 'se puede borrar una rutina');
});

console.log('\nRLS como usuario B');
await as(B, async () => {
  const seen = await db.query(`select count(*)::int n from public.routines`);
  ok(seen.rows[0].n === 0, 'B no ve rutinas de A');
  const seenItems = await db.query(`select count(*)::int n from public.routine_plan_exercises`);
  ok(seenItems.rows[0].n === 0, 'B no ve ejercicios de rutinas de A');
  let blocked = false;
  try {
    await db.query(`insert into public.routine_plan_days (routine_id, day_of_week, name) values ($1, 2, 'hack')`, [rid]);
  } catch {
    blocked = true;
  }
  ok(blocked, 'B no puede agregar días a una rutina de A');
  let blocked2 = false;
  try {
    await db.query(`select public.save_routine_day($1, 3::smallint, 'hack', false, '[]'::jsonb)`, [rid]);
  } catch {
    blocked2 = true;
  }
  ok(blocked2, 'B no puede usar save_routine_day sobre una rutina de A');
  await db.query(`select * from public.replace_session_sets('aaaaaaaa-0000-0000-0000-000000000001', '2026-09-21', '[]'::jsonb)`);
  await db.query(`select public.set_active_routine($1)`, [rid]);
  const stillActive = await as(A, () => db.query(`select is_active from public.routines where id = $1`, [rid]));
  ok(stillActive.rows[0].is_active === true, 'set_active_routine de B no afecta a A');
});

console.log(fails ? `\n${fails} FALLAS` : '\nTodo OK');
process.exit(fails ? 1 : 0);
