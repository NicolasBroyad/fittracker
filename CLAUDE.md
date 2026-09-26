# FitTracker 2.0 — contexto del proyecto

Rama `release/2.0`. Es una reescritura **completa del frontend, desde cero**, de FitTracker (app personal de un solo usuario para registrar el peso diario en ayunas y llevar las rutinas del gimnasio). El usuario pidió explícitamente que la 2.0 se construya **sin mirar ni basarse en el frontend de la 1.x** (que vive en `main`/`develop`): de la versión anterior solo se reutiliza el **backend** (Supabase: tablas, RLS, datos) y el concepto de **alternativas** de un ejercicio dentro de un puesto de la rutina y la numeración de los puestos. No abrir los `js/`, `css/` ni `index.html` de `main` como referencia de diseño o código.

**Mantené este archivo al día**: cada cambio significativo (features, arquitectura, tablas o funciones nuevas en Supabase, decisiones de diseño no obvias, gotchas) se documenta acá en el mismo commit, sin que el usuario lo tenga que pedir. Cambios cosméticos chicos no hace falta.

Estructura de ramas: `main` (producción, 1.x) ← `develop` (hoy igual a `main`) ← `release/2.0` (esta).

## Qué hace la app

Cuatro pestañas (barra flotante abajo, estilo iOS) + pantallas secundarias:

- **Hoy** (`/`): peso de hoy (o botón para cargarlo), entrenamiento que toca hoy según la rutina activa (puestos con check de hechos, anillo de progreso X/Y), promedio de 7 días con sparkline, entrenos de la semana con racha, y meta/fase actual. Engranaje → hoja de Ajustes (tema, cuenta, cerrar sesión).
- **Peso** (`/peso`): último registro + promedio 7 días, variación vs semana anterior y tendencia (regresión lineal de 28 días, kg/semana). Gráfico **Diario** (puntos + promedio móvil de 7 días por días de calendario) o **Semanal** (promedio por semana lunes-domingo), rangos 1M/3M/6M/1A/Todo, bandas de color por **fase** y línea de **meta** (ambas con toggle; preferencias en `localStorage` `ft-chart`). Tarjeta **Objetivo**: fase actual + meta de peso **con plazo opcional** (progreso %, ritmo necesario vs tendencia real, "vas en camino", fecha proyectada). **Calendario** mensual con el peso de cada día y una 8ª columna con el promedio de cada semana (semana completa aunque cruce de mes, con variación vs la anterior), resumen del mes abajo. **Mes a mes** (promedios mensuales con variación). `/peso/historial`: todos los registros agrupados por mes.
- **Entrenamiento** (`/entreno?dia=N`; la ruta quedó `/entreno`, el nombre visible es "Entrenamiento"): rutina activa (tocando el nombre se cambia cuál está activa), tira de la semana actual con el estado de cada día, y los **puestos** del día elegido numerados 1, 2, 3… Cada puesto es una tarjeta con objetivo (ej. `4 × 6-8`), última sesión y récord; tocarla abre la hoja para **cargar series**. Botones: catálogo de ejercicios y editor de la rutina.
- **Progreso** (`/progreso`): semana actual vs anterior (entrenos/planificados, series, volumen), racha de semanas, **calendario** mensual navegable con los días entrenados (tocar un día abre sus ejercicios y series; es el único lugar con esa acción), mapa de **constancia** de 17 semanas (solo visual, sin interacción), **series por grupo muscular** por semana (navegable), series de las últimas 12 semanas (barras), **récords recientes** y ejercicios principales con la tendencia de su 1RM estimado.
- `/entreno/rutinas`: lista de rutinas (activa primero), crear (vacía o copiando otra), activar.
- `/entreno/rutinas/:id?dia=N`: **editor de rutina**. Pestañas por día; nombre del día, switch de descanso (los ejercicios se conservan ocultos), puestos reordenables arrastrando (Motion `Reorder` con manija), objetivo series × reps **por puesto y por día**, "+ Alternativa" por puesto, "+ Agregar ejercicio" (buscador con creación inline). **Guardado automático** (debounce ~700 ms y al cambiar de día/salir) vía la RPC `save_routine_day`. Menú: renombrar, activar, duplicar, eliminar.
- `/entreno/ejercicios`: catálogo con búsqueda (sin tildes) y filtro por grupo muscular. `/entreno/ejercicios/:id`: récords (1RM estimado Epley, mejor serie, sesiones), gráfico de progreso (1RM est. / peso máx. / volumen; puntos dorados = récords), en qué rutinas/días está, historial completo (tocar una sesión la abre para editarla).

### Conceptos de dominio (importantes)

- **Varias rutinas, una activa.** La activa es la que manda en Hoy y Entreno.
- **Ejercicios = catálogo compartido.** Un ejercicio es una única entidad con un único historial, aunque esté en varios días o en varias rutinas. Cargar series desde cualquier día actualiza su historial en todos lados.
- **Puestos y alternativas.** Dentro de un día, cada ejercicio tiene `order_index` (el puesto: 1, 2, 3…) y `variant`. Varios ejercicios con el mismo `order_index` son **alternativas intercambiables** de ese puesto (ej. press inclinado con mancuernas vs. en Smith), cada uno con su propio historial y objetivo. Se numeran `2a`, `2b`… La numeración que se muestra es la posición real (1..n), no el `order_index` crudo. En Entreno, un puesto con alternativas es un carrusel deslizable (scroll-snap) con flechas y puntitos (las flechas son para desktop); **arranca en la alternativa registrada más recientemente** (`defaultAlternative` en `src/lib/training.ts`) y, si el usuario desliza a otra, se recuerda en memoria mientras la app siga abierta (`chosen` en `SlotCard.tsx`).
- **Series = reemplazo por día.** Guardar las series de un ejercicio en una fecha **reemplaza** todas las de esa fecha (RPC atómica `replace_session_sets`); es la misma acción para cargar hoy o corregir un día viejo. Guardar vacío borra la sesión. En la hoja de series, los placeholders muestran la sesión anterior; si una serie tiene reps pero el peso vacío, se usa el peso de esa serie de la vez anterior (está aclarado en la UI). "Repetir" copia la sesión anterior completa.
- **Récords**: una sesión es récord si supera el peso máximo previo de ese ejercicio, o si no, el mejor 1RM estimado previo, o (peso corporal) las reps máximas. La primera sesión nunca es récord.
- **Metas de peso**: historial inmutable (cada cambio inserta una fila; la vigente es la más reciente; "quitar meta" = fila con `target_weight` null). Ahora con `target_date` opcional.
- **Fases** (volumen/definición/mantenimiento): períodos con inicio y fin opcional (sin fin = en curso). Crear una fase en curso cierra la anterior en curso el día previo.
- **Color de las variaciones**: siempre verde si sube y rojo si baja, sin importar la fase ni la meta (pedido del usuario; antes dependía de la fase y se sacó). `Delta` con `neutral` queda gris. Fases en el gráfico: volumen verde, definición rojo, mantenimiento violeta.
- **Mejor registro de un ejercicio** ("Mejor" en cada puesto, en la hoja de series y en el detalle): es la **sesión completa** donde se hizo la mejor serie (más peso, a igual peso más reps; si empatan, se comparan las demás series de mejor a peor y luego gana la más reciente) — `bestSession` en `src/lib/training.ts`. No se muestra una serie suelta.

## Stack y por qué

- **Vite + React 19 + TypeScript 7 + Tailwind CSS 4**. SPA estática (no hace falta SSR: todo es privado detrás de login y los datos vienen de Supabase desde el cliente), build rápido y deploy estático en Vercel.
- **TanStack Query** (+ persistencia en `localStorage`, clave `ft-cache-v2`) para que la PWA abra instantáneamente con los datos cacheados y refresque en segundo plano; mutaciones **optimistas** en todo.
- **Motion** (animaciones, reorder), **Vaul** (hojas inferiores arrastrables tipo iOS), **Recharts** (gráficos, cargado solo en las pantallas que lo usan), **Sonner** (toasts), **date-fns** (locale `es`), **lucide-react** (íconos).
- **vite-plugin-pwa** (manifest + service worker con precache; las llamadas a Supabase no se cachean).
- **Router propio** (`src/app/router.ts`, ~100 líneas sobre la History API): sabe si la navegación fue hacia adelante/atrás para animar en la dirección correcta y restaurar el scroll al volver. Se evitó una librería para no depender de APIs de versiones mayores nuevas.

## Estructura

```
index.html, vite.config.ts, vercel.json, tsconfig.json, .prettierrc.json
public/                  íconos de la PWA (generados desde cero: línea de progreso lima sobre fondo oscuro)
src/
  main.tsx               arranque (initApi → render) + registro del service worker en producción
  index.css              tokens de color claro/oscuro (variables CSS → @theme de Tailwind), utilidades
  api/
    types.ts             interfaz Api (todo lo que la app le pide al backend) + BackendError
    live.ts              implementación contra Supabase (URL + anon key públicas; paginación de a 1000)
    demo.ts              backend falso en memoria con datos de ejemplo (solo en dev con ?demo)
    index.ts             elige la implementación (api())
    hooks.ts             queries y mutaciones de TanStack Query (optimistas)
  lib/                   lógica pura, sin React: dates, format, weight (promedios, tendencia, meta), training (sesiones, récords, semanas, rutinas/puestos), constants, types
  ui/                    componentes base: Button, Sheet/SheetBody/SheetFooter, Segmented, Chip, Switch, campos (DateField), Card, Delta, ProgressRing, Sparkline…
  app/                   App (rutas, providers, shell), Page (título grande + barra compacta al scrollear), TabBar, router, theme, auth, sheets (hojas globales)
  features/              pantallas por dominio: today, weight, training, progress, auth, settings
supabase/
  migrations/            SQL versionado (las de la 1.x + 20260925000000_v2_routines.sql)
  tests/migrations.test.mjs   aplica todas las migraciones sobre PGlite y verifica backfill, RPCs y RLS
```

Convenciones: `lib/` es puro (testeable, sin React ni Supabase); las pantallas leen datos con los hooks de `api/hooks.ts` y derivan todo con funciones de `lib/`. Las hojas que se abren desde varias pantallas (cargar peso, cargar series, día de entrenamiento, ajustes) son **globales** (`src/app/sheets.ts`, renderizadas una vez en el Shell). Una hoja con acciones usa `bare` + `<SheetBody>` (scrollea) + `<SheetFooter>` (fijo abajo); si el formulario tiene que resetearse al reabrir, se le pone `key` con `useResetKey(open)` (no se desmonta al cerrar, así la animación de cierre no queda vacía). Acciones destructivas: `ConfirmButton` (dos toques) en vez de diálogos apilados sobre hojas.

## Backend (Supabase)

Mismo proyecto que la 1.x: `fittracker`, ref `ogqbvooefjojaovxhhcx`. La 1.x **sigue en producción contra la misma base**, así que todo cambio de esquema tiene que ser **aditivo** (no romper ni modificar lo que usa la 1.x).

Tablas que usa la 2.0: `weight_entries` (+ inserta en `weight_entries_log` en cada alta/edición/baja, igual que la 1.x), `weight_goals` (ahora con `target_date`), `weight_phases`, `routine_exercises` (catálogo), `routine_logs` (una fila por serie) y las **nuevas** `routines`, `routine_plan_days`, `routine_plan_exercises`.

Migración `20260925000000_v2_routines.sql` (**hay que aplicarla antes de usar la 2.0 con datos reales**; si falta, la app muestra un aviso en las pantallas de rutinas):
- `routines` (con índice único parcial: una sola activa por usuario), `routine_plan_days` (nombre/descanso por día de cada rutina), `routine_plan_exercises` (ejercicio del catálogo en un día de una rutina: `order_index`, `variant`, `sets_target`, `reps_target`). RLS por `user_id` y además los inserts verifican que la rutina/ejercicio sean del usuario.
- **Backfill**: la rutina que el usuario tiene en la 1.x (`routine_days` + `routine_exercise_days`) se **copia** como "Mi rutina" activa. Es una copia: desde ahí la 1.x y la 2.0 editan la estructura de rutina por separado (el catálogo y las series sí son compartidos).
- `weight_goals.target_date`; grupos musculares nuevos (`Antebrazo`, `Gluteo`, `Gemelo`, `Abdomen`).
- RPC (security invoker, respetan RLS): `replace_session_sets(p_exercise_id, p_session_date, p_sets jsonb)`, `save_routine_day(p_routine_id, p_day, p_name, p_is_rest, p_items jsonb)`, `set_active_routine(p_routine_id)`.
- Índices en `routine_logs` por ejercicio+fecha y usuario+fecha.

Para aplicarla: desde una máquina con el CLI de Supabase y `.supabase-credentials` (ver el `CLAUDE.md` de `main`), `supabase db push`; o pegando el SQL en el SQL Editor del dashboard. Antes, `npm run test:db` la prueba localmente.

**Gotcha**: PostgREST de Supabase devuelve como máximo 1000 filas por request sin avisar; `live.ts` pagina (`fetchAll`) las tablas que pueden crecer (series, pesos, ejercicios, ítems de rutina).

## Desarrollo

En esta máquina Node está en `~/.local/node` (instalado a mano, no había): `export PATH="$HOME/.local/node/bin:$PATH"`.

```bash
npm install
npm run dev          # http://localhost:5173 — con /?demo usa datos de ejemplo (no toca Supabase)
npm run typecheck
npm run build
npm run test:db      # migraciones sobre PGlite
npm run format       # prettier (+ orden de clases de Tailwind)
```

**Modo demo**: `?demo` en la URL, solo en `npm run dev` (en el build de producción ese código ni se incluye). Es la forma de verificar la UI desde Claude Code: acá no se puede iniciar sesión con la cuenta real (el entorno bloquea escribir contraseñas en formularios de login), así que el flujo con datos reales lo prueba el usuario.

## Diseño / gotchas de UI

- Mobile-first pensado para PWA en iPhone (pantalla de inicio). `viewport-fit=cover` + paddings con `env(safe-area-inset-*)`; barra de estado `black-translucent` (texto blanco): en tema claro se pinta una franja oscura detrás de la barra de estado para que se lea.
- Color de acento verde jade/esmeralda (`--accent`, `--accent-ink` en `src/index.css`). Historial a pedido del usuario: empezó lima (#C8F750, no le gustó), pasó a celeste/azul y volvió a verde: primero jade (#2ECC8F) y después esmeralda más oscuro (#059669 fondo de botones, #10B981 texto/líneas en oscuro). Los íconos de `public/` usan el mismo color. Tema oscuro por defecto; claro/sistema desde Ajustes (`localStorage` `ft-theme`, aplicado por un script inline en `index.html` antes del primer paint).
- Recharts no entiende `var(--x)` en props: los colores salen de `useCssColors()` (lee las variables CSS reales según el tema).
- Inputs con `font-size` ≥ 16px (si no, iOS hace zoom al enfocar). Números decimales con `inputMode="decimal"` en inputs de texto (acepta coma o punto; nunca `type="number"`). Formato de números `es-AR` (coma decimal).
- **Teclado en iOS dentro de hojas**: `repositionInputs` de Vaul está apagado porque en iOS empujaba la hoja fuera de la pantalla al abrir el teclado (bug real reportado al renombrar una rutina). En su lugar `useKeyboard` en `src/ui/sheet.tsx` mide `visualViewport` y apoya la hoja justo encima del teclado limitando su altura.
- Hojas: se arrastran para cerrar solo desde el encabezado (`data-vaul-no-drag` en el cuerpo), para no cerrarlas sin querer al scrollear o al tocar inputs.

## Deploy

Vercel, proyecto `fittracker` conectado al repo de GitHub con **auto-deploy por push** (un push a `main` publica producción en https://fittracker-broyi.vercel.app; un push a otra rama genera un deploy de preview con su propia URL). `vercel.json` fija framework Vite, `npm ci`, `npm run build`, salida `dist` y el rewrite SPA a `index.html`.
