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
// sin sesión, como el reloj con la anon key
const asAnon = async (fn) => {
  await db.exec(`set role anon; select set_config('request.jwt.claim.sub', '', false);`);
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
  create role anon;
  grant usage on schema auth to authenticated, anon;
  grant execute on function auth.uid() to authenticated, anon;
  insert into auth.users values ('${A}'), ('${B}');
`);

const files = readdirSync(MIG).sort();
const v2 = files.find((f) => f.includes('v2_routines'));
for (const f of files.filter((f) => f < v2)) await db.exec(readFileSync(`${MIG}/${f}`, 'utf8'));
console.log('migraciones 1.x aplicadas:', files.filter((f) => f < v2).length);

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
const after = files.filter((f) => f > v2);
for (const f of after) await db.exec(readFileSync(`${MIG}/${f}`, 'utf8'));
console.log('migraciones posteriores aplicadas:', after.join(', ') || 'ninguna');
let rerun = true;
try {
  for (const f of after) await db.exec(readFileSync(`${MIG}/${f}`, 'utf8'));
} catch {
  rerun = false;
}
ok(rerun, 'las migraciones posteriores se pueden volver a aplicar sin error');

// Supabase da estos permisos por defecto a "authenticated" y "anon" (RLS es lo que protege)
await db.exec(`grant usage on schema public to authenticated, anon;
  grant all on all tables in schema public to authenticated, anon;
  grant all on all sequences in schema public to authenticated, anon;`);

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
  ok(
    ins.rows.every((x) => x.weight_unit === 'kg' && x.reps_right === null),
    'sin weight_unit ni reps_right (cliente viejo) quedan en kg y bilaterales',
  );
  await db.query(`select * from public.replace_session_sets('aaaaaaaa-0000-0000-0000-000000000001', '2026-09-20', '[]'::jsonb)`);
  const logs2 = await db.query(`select count(*)::int n from public.routine_logs where session_date = '2026-09-20'`);
  ok(logs2.rows[0].n === 0, 'array vacío borra la sesión');

  const uni = await db.query(
    `select * from public.replace_session_sets('aaaaaaaa-0000-0000-0000-000000000002', '2026-09-22', $1::jsonb)`,
    [
      JSON.stringify([
        { weight: 7.5, reps: 12, weight_unit: 'ladrillos', reps_right: 10 },
        { weight: 7.5, reps: 11, weight_unit: 'ladrillos', reps_right: null },
      ]),
    ],
  );
  ok(
    uni.rows.length === 2 &&
      Number(uni.rows[0].weight) === 7.5 &&
      uni.rows[0].weight_unit === 'ladrillos' &&
      uni.rows[0].reps_right === 10 &&
      uni.rows[1].reps_right === null,
    'replace_session_sets guarda ladrillos (con medios) y reps del lado derecho',
  );
  let badUnit = false;
  try {
    await db.query(
      `select * from public.replace_session_sets('aaaaaaaa-0000-0000-0000-000000000002', '2026-09-23', '[{"weight": 10, "reps": 8, "weight_unit": "lbs"}]'::jsonb)`,
    );
  } catch {
    badUnit = true;
  }
  ok(badUnit, 'una unidad desconocida se rechaza');
  // la 1.x inserta directo en la tabla sin las columnas nuevas
  await db.query(
    `insert into public.routine_logs (exercise_id, session_date, set_number, weight, reps) values ('aaaaaaaa-0000-0000-0000-000000000003', '2026-09-24', 1, 40, 10) `,
  );
  const v1row = await db.query(`select weight_unit, reps_right from public.routine_logs where session_date = '2026-09-24'`);
  ok(
    v1row.rows[0].weight_unit === 'kg' && v1row.rows[0].reps_right === null,
    'un insert como el de la 1.x queda en kg y bilateral',
  );

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

console.log('\nReloj Garmin');
{
  const EX1 = 'aaaaaaaa-0000-0000-0000-000000000001'; // Press banca (puesto 2 del lunes)
  const EX2 = 'aaaaaaaa-0000-0000-0000-000000000002'; // Press inclinado (puesto 1, con series en ladrillos/por lado)
  const start = await asAnon(() => db.query(`select public.watch_pair_start() as j`));
  const { code, secret } = start.rows[0].j;
  ok(/^\d{6}$/.test(code) && secret.length >= 32, 'watch_pair_start (sin sesión) da código de 6 dígitos y secreto');
  const status = async (s) => (await asAnon(() => db.query(`select public.watch_pair_status($1) as j`, [s]))).rows[0].j.s;
  ok((await status(secret)) === 'pending', 'queda pendiente hasta que se confirme');
  const routine = async (s, today) =>
    (await asAnon(() => db.query(`select public.watch_routine($1, $2::date) as j`, [s, today]))).rows[0].j;
  ok((await routine(secret, '2026-09-25')).err === 'unlinked', 'sin confirmar no da datos');

  let anonConfirm = false;
  try {
    await asAnon(() => db.query(`select public.watch_pair_confirm($1)`, [code]));
  } catch {
    anonConfirm = true;
  }
  ok(anonConfirm, 'sin sesión no se puede confirmar un código');
  const confirm = async (uid, c) =>
    (await as(uid, () => db.query(`select public.watch_pair_confirm($1, 'Forerunner 55') as s`, [c]))).rows[0].s;
  ok((await confirm(A, code === '000000' ? '000001' : '000000')) === 'invalid', 'un código incorrecto no vincula');
  ok((await confirm(A, code)) === 'ok', 'A vincula el reloj con el código');
  ok((await confirm(B, code)) === 'invalid', 'el código no sirve dos veces');
  ok((await status(secret)) === 'linked', 'el reloj se entera de que quedó vinculado');
  const dev = await db.query(`select user_id, name, token_hash from public.watch_devices`);
  ok(
    dev.rows.length === 1 &&
      dev.rows[0].user_id === A &&
      dev.rows[0].name === 'Forerunner 55' &&
      dev.rows[0].token_hash !== secret,
    'en la base queda el reloj de A con el hash del secreto, no el secreto',
  );

  const j = await routine(secret, '2026-09-25');
  const e2 = j.e.findIndex((x) => x[0] === EX2);
  const e1 = j.e.findIndex((x) => x[0] === EX1);
  ok(j.r === 'Mi rutina' && j.e.length === 2 && j.d.length === 7, 'watch_routine trae la rutina activa con los 7 días');
  ok(
    j.d[0][0] === 'Pecho y tríceps' &&
      j.d[0][2].length === 2 &&
      j.d[0][2][0][0][0] === e2 &&
      j.d[0][2][0][0][1] === 4 &&
      j.d[0][2][0][0][2] === '6-8',
    'el lunes con sus puestos en orden y el objetivo de cada uno',
  );
  const prev2 = j.p.find((x) => x[0] === e2);
  ok(
    prev2 && prev2[1] === '2026-09-22' && prev2[2] === 'ladrillos' && prev2[3][0][0] === 7.5 && prev2[3][0][2] === 10,
    'trae la sesión anterior con unidad y reps por lado',
  );
  ok(j.h.length === 0, 'sin series cargadas ese día');

  const save = async (s, ex, date, sets) =>
    (
      await asAnon(() =>
        db.query(`select public.watch_save_sets($1, $2, $3::date, $4::jsonb) as j`, [s, ex, date, JSON.stringify(sets)]),
      )
    ).rows[0].j;
  const sets = [
    { weight: 80, reps: 8, weight_unit: 'kg', reps_right: null },
    { weight: 80, reps: 7, weight_unit: 'kg', reps_right: null },
  ];
  ok((await save(secret, EX1, '2026-09-25', sets)).ok === 2, 'watch_save_sets guarda las series');
  ok((await save(secret, EX1, '2026-09-25', sets)).ok === 2, 'y reintentar no las duplica');
  const saved = await db.query(`select user_id, weight_unit from public.routine_logs where session_date = '2026-09-25'`);
  ok(saved.rows.length === 2 && saved.rows.every((x) => x.user_id === A && x.weight_unit === 'kg'), 'quedan a nombre de A');
  const j2 = await routine(secret, '2026-09-25');
  ok(j2.h.length === 1 && j2.h[0][0] === e1 && j2.h[0][2].length === 2, 'watch_routine muestra lo cargado hoy');
  ok((await save('otro-secreto', EX1, '2026-09-26', sets)).err === 'unlinked', 'un token inválido no guarda nada');

  const bEx = await as(B, () => db.query(`insert into public.routine_exercises (name) values ('De B') returning id`));
  ok(
    (await save(secret, bEx.rows[0].id, '2026-09-25', sets)).err === 'exercise',
    'el reloj de A no puede cargar series en ejercicios de B',
  );

  const anonSees = await asAnon(() => db.query(`select count(*)::int n from public.watch_devices`));
  const anonPairs = await asAnon(() => db.query(`select count(*)::int n from public.watch_pairings`));
  ok(anonSees.rows[0].n === 0 && anonPairs.rows[0].n === 0, 'sin sesión no se ven relojes ni códigos');
  let anonUser = false;
  try {
    await asAnon(() => db.query(`select public.watch_user($1)`, [secret]));
  } catch {
    anonUser = true;
  }
  ok(anonUser, 'watch_user no se puede llamar desde afuera');
  const bSees = await as(B, () => db.query(`select count(*)::int n from public.watch_devices`));
  const aSees = await as(A, () => db.query(`select count(*)::int n from public.watch_devices`));
  ok(bSees.rows[0].n === 0 && aSees.rows[0].n === 1, 'cada usuario ve solo sus relojes');

  // código vencido
  const s2 = (await asAnon(() => db.query(`select public.watch_pair_start() as j`))).rows[0].j;
  await db.query(`update public.watch_pairings set expires_at = now() - interval '1 minute' where code = $1`, [s2.code]);
  ok((await confirm(A, s2.code)) === 'invalid' && (await status(s2.secret)) === 'expired', 'un código vencido no vincula');

  // intentos
  let last = '';
  for (let i = 0; i < 11; i++) last = await confirm(B, '999999');
  ok(last === 'too_many', 'después de 10 códigos mal escritos en una hora no deja seguir probando');

  // peso desde el reloj
  const saveW = async (s, date, w) =>
    (await asAnon(() => db.query(`select public.watch_save_weight($1, $2::date, $3) as j`, [s, date, w]))).rows[0].j;
  ok((await saveW(secret, '2026-10-30', 15)).err === 'weight', 'watch_save_weight rechaza pesos fuera de 20-400');
  ok((await saveW('otro-secreto', '2026-10-30', 80)).err === 'unlinked', 'y con un token inválido no guarda');
  ok((await saveW(secret, '2026-10-30', 80.4)).ok === true, 'watch_save_weight guarda el peso del día');
  const wRow = async () =>
    (await db.query(`select user_id, weight::float8 w, note from public.weight_entries where date = '2026-10-30'`)).rows;
  const wLog = async () =>
    (
      await db.query(
        `select user_id, action, previous_weight::float8 pw, new_weight::float8 nw, new_note from public.weight_entries_log where entry_date = '2026-10-30' order by id`,
      )
    ).rows;
  let wr = await wRow();
  ok(wr.length === 1 && wr[0].user_id === A && wr[0].w === 80.4 && wr[0].note === '', 'queda a nombre de A, sin nota');
  ok(
    (await wLog()).length === 1 && (await wLog())[0].action === 'created' && (await wLog())[0].user_id === A,
    'y en el historial como alta',
  );
  await saveW(secret, '2026-10-30', 80.4);
  ok((await wLog()).length === 1, 'reintentar el mismo peso no agrega historial');
  await db.query(`update public.weight_entries set note = 'ayuno' where date = '2026-10-30'`);
  await saveW(secret, '2026-10-30', 80.1);
  wr = await wRow();
  const lg = await wLog();
  ok(
    wr[0].w === 80.1 &&
      wr[0].note === 'ayuno' &&
      lg.length === 2 &&
      lg[1].action === 'updated' &&
      lg[1].pw === 80.4 &&
      lg[1].new_note === 'ayuno',
    'corregirlo actualiza el peso, conserva la nota y queda como edición',
  );
  const jw = await routine(secret, '2026-10-30');
  ok(
    Array.isArray(jw.w) && jw.w.length >= 1 && jw.w[jw.w.length - 1][0] === '2026-10-30' && jw.w[jw.w.length - 1][1] === 80.1,
    'watch_routine trae los últimos pesos (w)',
  );
  ok(Array.isArray((await routine(secret, '2026-09-25')).w), 'w también viene en días sin peso');

  // datos de actividad del reloj
  const saveH = async (s, days, acts) =>
    (
      await asAnon(() =>
        db.query(`select public.watch_save_health($1, $2::jsonb, $3::jsonb) as j`, [
          s,
          JSON.stringify(days),
          JSON.stringify(acts),
        ]),
      )
    ).rows[0].j;
  const h1 = await saveH(
    secret,
    [
      { date: '2026-10-29', steps: 9000, step_goal: 8000, calories: 2400, distance_m: 7000, active_minutes: 45 },
      { date: '2026-10-30', steps: 3000, calories: 1200, resting_hr: 52 },
    ],
    [{ start: 1761832800, sport: 1, duration_s: 1800, distance_m: 5000 }],
  );
  ok(h1.ok === true && h1.days === 2 && h1.activities === 1, 'watch_save_health guarda días y actividades');
  await saveH(
    secret,
    [{ date: '2026-10-30', steps: 6500 }],
    [{ start: 1761832800, sport: 1, duration_s: 1850, distance_m: 5100 }],
  );
  const dd = (await db.query(`select steps, calories, resting_hr, user_id from public.watch_daily where date = '2026-10-30'`))
    .rows[0];
  ok(
    dd.steps === 6500 && dd.calories === 1200 && dd.resting_hr === 52 && dd.user_id === A,
    'actualizar un día no borra lo que no vino',
  );
  const aa = (await db.query(`select count(*)::int n, max(duration_s) d from public.watch_activities`)).rows[0];
  ok(aa.n === 1 && aa.d === 1850, 'una actividad no se duplica al volver a subirla');
  // el reloj manda el inicio en la época de Garmin (desde 1989-12-31): se pasa a Unix
  const garmin = 1763510400 - 631065600; // 2025-11-19 00:00 UTC
  await saveH(secret, [], [{ start: garmin, sport: 10, duration_s: 3600 }]);
  const ga = (await db.query(`select (start_time at time zone 'UTC')::text t from public.watch_activities where sport = 10`))
    .rows;
  ok(ga.length === 1 && ga[0].t.startsWith('2025-11-19'), 'el inicio en época de Garmin se guarda con la fecha real');
  // las ya guardadas con la fecha corrida se corrigen al aplicar la migración
  await db.query(`insert into public.watch_activities (user_id, start_time, sport) values ($1, to_timestamp($2), 4)`, [
    A,
    garmin + 7200,
  ]);
  // (y las posteriores, que vuelven a definir watch_save_health)
  for (const f of files.filter((f) => f >= '20261119020000')) await db.exec(readFileSync(`${MIG}/${f}`, 'utf8'));
  const fixed = (await db.query(`select (start_time at time zone 'UTC')::text t from public.watch_activities where sport = 4`))
    .rows;
  ok(fixed.length === 1 && fixed[0].t.startsWith('2025-11-19 02'), 'la migración corrige las actividades viejas');
  await db.query(`delete from public.watch_activities where sport in (4, 10)`);

  // actividades borradas: lo que el reloj ya no manda se borra; lo que se borra en la web no vuelve
  const a1 = { start: 1761832800, sport: 1, duration_s: 1850, distance_m: 5100 };
  const a2 = { start: 1761840000, sport: 10, duration_s: 68 };
  const acts = async () =>
    (
      await db.query(
        `select extract(epoch from start_time)::int s, hidden_at is not null h from public.watch_activities order by 1`,
      )
    ).rows;
  await saveH(secret, [], [a1, a2]);
  ok((await acts()).length === 2, 'se guardan las dos actividades');
  await saveH(secret, [], [a1]);
  ok(JSON.stringify((await acts()).map((r) => r.s)) === JSON.stringify([a1.start]), 'la que el reloj ya no manda se borra');
  await db.query(`insert into public.watch_activities (user_id, start_time, sport) values ($1, to_timestamp(1761800000), 1)`, [
    A,
  ]);
  await saveH(secret, [], [a1]);
  ok((await acts()).length === 2, 'las más viejas que la lista del reloj no se borran');
  await saveH(secret, [], []);
  ok((await acts()).length === 2, 'una lista vacía no borra nada');
  await db.query(`delete from public.watch_activities where start_time = to_timestamp(1761800000)`);
  const hide = (u, col = 'hidden_at = now()') =>
    as(u, () => db.query(`update public.watch_activities set ${col} where start_time = to_timestamp(${a1.start})`));
  ok((await hide(B)).affectedRows === 0, 'otro usuario no puede borrar mi actividad');
  ok((await hide(A)).affectedRows === 1, 'el dueño puede borrar (ocultar) una actividad');
  await saveH(secret, [], [a1]);
  ok((await acts())[0].h === true, 'si el reloj la vuelve a mandar sigue borrada');
  let colDenied = false;
  try {
    await hide(A, 'duration_s = 1');
  } catch {
    colDenied = true;
  }
  let anonDenied = false;
  try {
    await asAnon(() => db.query(`update public.watch_activities set hidden_at = now()`));
  } catch {
    anonDenied = true;
  }
  ok(colDenied && anonDenied, 'desde la web solo se puede cambiar hidden_at, y sin sesión nada');
  await db.query(`update public.watch_activities set hidden_at = null`);
  ok(
    (await saveH('otro-secreto', [{ date: '2026-10-31', steps: 1 }], [])).err === 'unlinked',
    'token inválido no sube actividad',
  );
  const seenA = await as(A, () =>
    db.query(`select (select count(*) from public.watch_daily)::int d, (select count(*) from public.watch_activities)::int a`),
  );
  const seenB = await as(B, () =>
    db.query(`select (select count(*) from public.watch_daily)::int d, (select count(*) from public.watch_activities)::int a`),
  );
  const seenAnon = await asAnon(() =>
    db.query(`select (select count(*) from public.watch_daily)::int d, (select count(*) from public.watch_activities)::int a`),
  );
  ok(
    seenA.rows[0].d === 2 && seenA.rows[0].a === 1 && seenB.rows[0].d === 0 && seenB.rows[0].a === 0 && seenAnon.rows[0].d === 0,
    'cada usuario ve solo su actividad y sin sesión no se ve nada',
  );
  let anonWeights = false;
  try {
    await asAnon(() => db.query(`select public.watch_weights($1, '2026-10-30')`, [A]));
  } catch {
    anonWeights = true;
  }
  ok(anonWeights, 'watch_weights no se puede llamar desde afuera');

  // desvincular desde la web
  const del = await as(A, () => db.query(`delete from public.watch_devices returning id`));
  ok(del.rows.length === 1 && (await routine(secret, '2026-09-25')).err === 'unlinked', 'desvinculado, el token deja de servir');
}

console.log(fails ? `\n${fails} FALLAS` : '\nTodo OK');
process.exit(fails ? 1 : 0);
