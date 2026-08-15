# Registro de Peso — contexto del proyecto

App personal (uso de un solo usuario) para registrar el peso diario en ayunas. Nació como un prototipo de un chat web de Claude (un solo archivo HTML) y se fue evolucionando acá en la terminal hasta quedar como una mini-app con backend en la nube y deploy automático.

Este archivo existe para que una sesión nueva de Claude Code pueda retomar el trabajo sin tener que redescubrir todo el contexto. Léelo entero antes de tocar nada.

**Mantené este archivo al día.** El usuario pidió explícitamente que, cada vez que se haga un cambio lo suficientemente significativo (features nuevas, cambios de arquitectura, tablas nuevas en Supabase, decisiones de diseño no obvias, gotchas descubiertos), se actualice este `CLAUDE.md` en el mismo commit — sin que haga falta que lo pida de nuevo en cada sesión. No hace falta documentar cambios chicos/cosméticos (ajustes de CSS, copy, un fix trivial), pero sí todo lo que otra sesión necesitaría saber para no redescubrirlo de cero.

## Qué hace la app

- Cargar el peso del día (+ nota opcional) desde un modal.
- Ver el historial en un calendario mensual, en una lista cronológica ("Registros") y en gráficos (semanal con tendencia lineal, diario con promedio móvil de 7 días).
- Tocar un día del calendario o un ítem de "Registros" que ya tiene dato abre un modal de **solo lectura** con un botón de lápiz para pasar a edición (no se edita directo).
- Modo claro/oscuro con toggle manual (ícono sol/luna en SVG, no emoji) que respeta la preferencia del sistema por defecto y persiste la elección en `localStorage`.
- Login obligatorio (un solo usuario) para que los datos no queden expuestos públicamente.
- Panel "Meta y objetivo": meta de peso opcional + fase (volumen/definición/mantenimiento/sin definir), editable o borrable en cualquier momento, con historial de cambios colapsado.
- Panel "Resumen mensual": promedio, cambio neto en el mes, máximo/mínimo con fecha, días registrados sobre días del mes, y comparación contra el promedio del mes anterior. Está atado al mismo `viewMonth` que el calendario — navegar el calendario también actualiza este resumen.
- Panel "Actividad reciente" (colapsado, al final de la página): últimas 20 altas/ediciones/bajas de registros de peso, con timestamp.
- Selector de rango temporal en el gráfico semanal (último mes/3 meses/6 meses/año/toda la historia), sincronizado entre el panel chico y el modal ampliado. Solo visible en modo "Semanal" (se oculta en "Diario", que siempre muestra todo el historial con scroll horizontal).
- Instalable como PWA (agregar a pantalla de inicio en el celu, ícono propio, abre sin barra de navegador) y con caché offline básico de los archivos propios de la app.
- Botón para exportar todo el historial a CSV (fecha, peso, nota), junto al contador de "Registros".
- Segunda pantalla ("Rutina", tab-switcher junto al de "Peso" en la parte superior) con la rutina de gimnasio del usuario: una tarjeta por día de la semana (lunes a domingo, fijo), cada una con nombre editable del entrenamiento (ej. "Push 1") y su lista de ejercicios, numerados (1, 2, 3...) y reordenables (mueven el "slot" completo, ver más abajo) con gesto de **mantener presionado hasta que tiemble y arrastrar** (igual patrón que reordenar apps en el celu): un long-press (~550ms sin mover el dedo) sobre cualquier ejercicio activa el "modo reordenar" para ese día — toda la lista tiembla y el botón "+ Ejercicio" pasa a decir "Listo" — y el ejercicio presionado queda agarrado listo para arrastrar; mientras se está en ese modo, tocar y arrastrar cualquier otro ejercicio del mismo día también lo mueve sin necesitar otro long-press. Soltar un ejercicio no sale del modo (se puede seguir reordenando); para salir hay que tocar "Listo" o tocar afuera de la lista de ese día. Implementado a mano con Pointer Events en `js/routines-dnd.js` (sin librería de drag-and-drop) — durante el arrastre se reordena el DOM en vivo (swap cuando el centro del elemento arrastrado cruza el centro de un vecino) y recién al soltar se persiste `order_index` en Supabase para los slots que cambiaron de posición. La tarjeta del día actual se resalta con el mismo tratamiento visual "LCD" oscuro que usa la tarjeta de "Peso actual" en la pantalla de Peso (fondo `--lcd-bg`, texto `--lcd-text`, acentos `--lcd-accent`, degradado circular en la esquina) más un eyebrow "Rutina de hoy" — no un simple borde de color (`js/routines-render.js`, `todayDayOfWeek()`; estilos `.routine-day-panel.is-today` en `css/styles.css`, reaplica manualmente los colores porque el resto de la tarjeta usa variables pensadas para fondo claro). Un día se puede marcar como **día de descanso** (checkbox en el mismo modal de nombre del entrenamiento) — oculta la lista de ejercicios y el botón "+ Ejercicio", muestra "Día de descanso" en su lugar; los ejercicios ya cargados ese día no se borran, solo quedan ocultos si se destilda. Cada ejercicio tiene series/reps objetivo (ej. "4x6-8") y muestra siempre a la vista dos líneas: **Mejor** y **Último** (o "Sin registros" si no hay datos). "Mejor" se calcula comparando los sets de cada sesión de mejor a peor (peso desc, luego reps desc) y comparándolos posición por posición contra las demás sesiones que tocaron el peso máximo histórico: gana la sesión con el valor más alto en el primer punto donde difieren (ej. si dos días hicieron la misma serie top, se pasa a comparar la segunda serie de cada uno); si todo empata, gana el día más reciente (`computeBestSession` en `js/routines-derived.js`). "Último" es la sesión más reciente. Tocar el nombre del ejercicio abre un modal con el historial completo (agrupado por fecha, formateado como "85kg x 6, 80kg x 8-7-6") y un formulario de series editable para una fecha (por defecto hoy). Guardar **reemplaza** todas las series de esa fecha (no las suma) — es la misma acción para "cargar hoy" y para "corregir un día viejo". Cada ejercicio tiene un ícono de calendario que abre un mini-calendario navegable (mismo patrón visual que el calendario de peso) con los días que tienen datos marcados con punto; tocar un día carga ese registro en el formulario para verlo/editarlo. Un ejercicio puede tener **alternativas** (ej. "2a"/"2b" — dos variantes intercambiables del mismo slot de la rutina, como "press inclinado máquina Smith" vs. "con mancuernas"): cada variante es una fila propia en `routine_exercises` con su propio historial de `routine_logs`, agrupadas por `order_index` compartido y diferenciadas por `variant` (ver sección Supabase). Pensada para reemplazar las notas del celular donde el usuario llevaba esto antes.
- Tercera pantalla ("Gimnasio") con analítica más profunda de la rutina: tarjeta de **racha de entrenamiento** (días consecutivos "cumplidos" — un día de descanso o un día sin ejercicios cargados cuenta solo, sin necesitar dato; un día con plan corta la racha si no tiene ningún set cargado; hoy nunca corta la racha si todavía no cargaste nada, se empieza a contar desde ayer, igual criterio que la racha de peso), panel **"Ejercicios que más mejoraron"** (compara el peso de la primera sesión contra el mejor registro actual de cada ejercicio, top 5 por diferencia en kg), y panel **"Historial de entrenamientos"** con todas las sesiones de todos los ejercicios juntas en una sola lista cronológica inversa (mismo patrón visual que "Registros" de Peso) — tocar una fila abre el modal de sesión de ese ejercicio en esa fecha. Todo se calcula en el cliente (`computeGymStreak`/`computeMostImproved`/`computeAllSessionsHistory` en `js/routines-derived.js`), sin tablas nuevas.
- Cuarta pantalla ("Home"), **la que se abre por defecto** al entrar a la app: combina lo más importante de Peso y Rutina en una sola vista con acceso rápido. Tarjeta grande (mismo estilo LCD oscuro que "hoy" en Rutina) con qué toca hoy — nombre del entrenamiento, "Descanso", o "Sin rutina para hoy" (`getTodayStatus` en `js/routines-derived.js`). Dos módulos lado a lado: **Peso** (peso actual + botón "+ Cargar peso de hoy" si no está cargado, o una insignia de completado con el valor si ya está — mismo modal de siempre, `openModal(todayISO())`, sin lógica de guardado nueva) y **Entrenamiento** (si hoy es descanso, mensaje tranquilo sin acción; si hay plan, cuenta "X/Y ejercicios registrados hoy" con botón para ir a Rutina, o una insignia de completado si ya están todos). Abajo, franja compacta con las dos rachas (peso y gimnasio) — la versión completa de la racha de gimnasio vive en Gimnasio.

**Sobre qué pantalla se abre**: Home es siempre la pantalla de arranque en una carga *fresca* del script (login o F5), pero cambiar de pestaña durante la misma sesión ya **no se guarda en `localStorage`** (a diferencia de cómo funcionaba antes, cuando recordaba la última pantalla entre Peso/Rutina). Es intencional: como es una SPA, si el usuario cambia de app en el celu sin cerrar esta (la PWA sigue viva en memoria) el estado de JS no se pierde y la pantalla activa se mantiene tal cual — no hace falta persistir nada para lograr eso. Solo un load real desde cero (cerrar la app de verdad, o que el SO mate el proceso) reinicia el JS y por lo tanto vuelve a Home. Si en algún momento hay que "recordar" la pantalla entre cargas frescas, hay que sumar de nuevo la lectura/escritura de `localStorage` en `js/screens.js` — a propósito no está.

**Navegación entre pantallas**: el tab-switcher de arriba (`.app-tabs`) pasa a un nav fijo abajo de la pantalla en mobile (`@media max-width:640px`, mismo breakpoint que usan los módulos de Home) para quedar más cómodo al pulgar — `.app` suma padding-bottom en ese breakpoint para que el contenido no quede tapado detrás. En desktop/tablet sigue arriba, centrado, sin cambios. Además de tocar una tab, **se puede arrastrar el dedo por cualquier parte de la página** para cambiar de pantalla (`js/swipe-nav.js`, Touch Events a mano, sin librería), con animación tipo carrusel de dos paneles: al detectar que el gesto es horizontal, la pantalla actual **y** la pantalla vecina (según la dirección) se vuelven `position:fixed` una al lado de la otra (`preparePane()`, clase `.screen-swiping`) y ambas se traducen juntas con `transform:translateX` seguiendo el dedo en cada `touchmove` — se ve el contenido real de la pantalla de al lado entrando, no un hueco vacío. Al soltar: si se arrastró más del 30% del ancho de pantalla (`COMMIT_RATIO`), la animación termina de completar el paso y recién ahí se llama `switchScreen()` (que deja el DOM en el estado canónico de siempre); si no llega al umbral, ambos paneles vuelven resorteando a su posición original y no cambia nada. Antes de esto se probó una versión más simple (solo la pantalla actual se movía, la de al lado aparecía recién al final) — se descartó porque el usuario la sintió vacía/poco natural durante el arrastre. **`preparePane()` usa `top: rect.top` (la posición real que tenía el elemento en el documento), no `top:0`** — con `top:0` el contenido "saltaba" hacia arriba apenas arrancaba el gesto, porque su posición natural queda más abajo del topbar; con el `rect.top` capturado antes de fijar la posición, el panel no se mueve un píxel hasta que el dedo efectivamente empieza a arrastrar. La misma animación de deslizamiento (dos paneles, uno entra y el otro sale) también se dispara al **tocar una pestaña del nav**, no solo al arrastrar — `animateToScreen()` en `js/swipe-nav.js`, que arma ambos paneles ya en posición y anima derecho al resultado (forzando un reflow entre fijar la posición inicial y la final, si no el navegador salta directo sin animar); los 4 botones del nav y el botón "Ir a mi rutina" de Home llaman a esta función en vez de `switchScreen()` directo (que sigue existiendo y se usa tal cual solo para el arranque inicial en `js/auth.js`, sin animación, no hace falta ahí). Los listeners de `touchmove`/`touchend` se agregan a `document` recién dentro del handler de `touchstart` (una vez que ese primer toque ya pasó los chequeos) y se sacan al terminar el gesto — nunca quedan pegados de forma permanente (mismo patrón que el long-press de reordenar ejercicios en `js/routines-dnd.js`). El único listener permanente es el `touchstart` en `#app-root` (no en `document`/`body` — importante, ver gotcha de iOS más abajo). Se desactiva por completo si hay un modal abierto, si se está en medio del gesto de reordenar ejercicios de Rutina (`isJiggling()`), o si el toque arrancó sobre un `input`/`textarea`/`select`/`[contenteditable]` o dentro de `.chart-scroll` (el gráfico diario, que ya tiene su propio scroll horizontal). En Rutina, si la tarjeta del día de hoy no está a la vista, aparece un botón flotante circular animado (rebote, color `--accent`, `#rutina-scroll-hint`) que hace `scrollIntoView` suave hasta ella al tocarlo; se muestra/oculta solo mirando `getBoundingClientRect()` de `.routine-day-panel.is-today` en cada scroll (throttleado con `requestAnimationFrame`) y cada vez que se re-renderiza Rutina (`updateTodayScrollHint()` en `js/routines.js`) — no usa `IntersectionObserver` a propósito, para no tener que reobservar el elemento cada vez que el DOM de Rutina se reconstruye en cada render.

**El header viejo de la pantalla de Peso** ("Registro de Peso" + "Peso en ayunas · cada mañana" + la fecha) se sacó por completo — quedaba desactualizado ahora que hay 4 pantallas y ninguna otra tiene encabezado propio. El topbar quedó reducido a solo "Cerrar sesión" + toggle de tema + (únicamente en Peso) el botón "+ Cargar peso de hoy". Las clases `.eyebrow`/`.topbar h1`/`.topbar .sub` se borraron de `styles.css` por quedar sin uso — si hace falta un título de página en algún lado nuevo, no reusar esas clases sin revisar que sigan existiendo.

## Stack y por qué

- **Frontend**: HTML/CSS/JS vanilla, sin build step ni framework. Se eligió así porque es una app chica de un solo usuario y no vale la pena la complejidad de un bundler.
- **Backend/datos**: Supabase (Postgres + Auth), plan gratuito. Antes vivía en `localStorage` del navegador, pero eso no sincroniza entre dispositivos ni sobrevive un cambio de navegador — se migró a Supabase para tener los datos disponibles desde cualquier lugar (celu, PC).
- **Hosting**: Vercel, plan gratuito, deploy manual vía CLI (no hay integración automática de "push a main = deploy" configurada; ver sección Deploy).
- **Repo**: GitHub, privado (`NicolasBroyad/registro-peso`).

## Estructura de archivos

```
registro-peso/
├── index.html              # markup, sin lógica
├── manifest.json           # manifest de la PWA (nombre, íconos, colores, display:standalone)
├── sw.js                   # service worker: cache-first de los assets propios, passthrough para Supabase/CDN
├── icons/                  # íconos de la PWA (192/512/apple-touch/favicon) + app-logo.JPEG (fuente, sin usar directo)
├── css/
│   └── styles.css          # todos los estilos (incluye paleta clara/oscura)
├── js/
│   ├── config.js            # cliente Supabase (URL + anon key, ambas públicas por diseño)
│   ├── seed-data.js          # historial importado del excel original, para sembrar la DB la primera vez
│   ├── state.js               # estado compartido (entries, viewMonth, activeTab, chartRange, etc.) con setters porque son ES modules
│   ├── utils.js                # fechas, formato, toasts, escapeHtml, íconos SVG de tendencia
│   ├── storage.js               # capa de datos: loadEntries/upsertEntry/deleteEntryByDate contra Supabase
│   ├── derived.js                # cálculos: tendencia, racha, min/max, promedios semanales, resumen mensual, regresión lineal
│   ├── chart.js                   # dibuja los gráficos SVG a mano (sin librería de charts); aplica el filtro de rango en modo semanal
│   ├── chart-modal.js              # pestañas semanal/diario, selector de rango, modal de gráfico ampliado
│   ├── render.js                    # pinta stats, calendario, resumen mensual, notas, registros, meta, actividad
│   ├── modal.js                      # modal de vista (solo lectura) + modal de edición/alta de un registro de peso
│   ├── goal.js                        # modal de meta/fase (abrir, cerrar, guardar, quitar)
│   ├── auth.js                         # login/logout, chequeo de sesión al cargar
│   ├── theme.js                         # toggle claro/oscuro, iconos SVG inline
│   ├── export.js                        # exportar todo el historial a CSV
│   ├── routines-state.js                # estado de la pantalla de Rutina (días, ejercicios, modales abiertos)
│   ├── routines-storage.js              # capa de datos de rutinas: routine_days/routine_exercises/routine_logs contra Supabase
│   ├── routines-derived.js              # agrupa sets de routine_logs por sesión y los formatea ("85kg x 6, 80kg x 8-7-6")
│   ├── routines-render.js               # pinta las 7 tarjetas de día con sus ejercicios y el último registro de cada uno
│   ├── routines-dnd.js                  # reordenar ejercicios: long-press → modo "tiembla" → arrastrar (Pointer Events, sin librería)
│   ├── routines.js                      # lógica de la pantalla de Rutina: modales (día/ejercicio/sesión), delegación de eventos
│   ├── screens.js                       # switch entre pantallas (Home/Peso/Rutina/Gimnasio) + carga perezosa de datos de rutina
│   ├── home-render.js                   # pinta la pantalla Home (hoy destacado, módulos de peso/entreno, rachas) — solo render puro
│   ├── gym-render.js                    # pinta la pantalla Gimnasio (racha, más mejorados, historial completo) — solo render puro
│   ├── swipe-nav.js                     # cambiar de pantalla arrastrando el dedo por cualquier parte de la página (Touch Events)
│   └── main.js                          # wiring de todos los event listeners + arranque
└── supabase/
    └── migrations/                     # SQL versionado de la base (ver sección Supabase)
```

**Convención de capas entre módulos** (se volvió más explícita al sumar Home/Gimnasio, conviene respetarla al agregar pantallas nuevas): los archivos `*-render.js` (`render.js`, `routines-render.js`, `home-render.js`, `gym-render.js`) son **render puro** — arman HTML a partir del estado ya cargado, sin `addEventListener` propio ni mutar nada. Los archivos de lógica (`modal.js`, `goal.js`, `routines.js`, `screens.js`, `auth.js`, `theme.js`, `export.js`) mutan estado/Supabase y orquestan qué se vuelve a renderizar. `main.js` es el único lugar que centraliza `addEventListener` sobre contenido armado dinámicamente por los módulos de render (delegación de eventos) — así los módulos de render nunca necesitan importarse entre sí ni importar la capa de lógica, lo que evita ciclos de imports (`home-render.js`/`gym-render.js` importan solo de `state.js`/`derived.js`/`routines-state.js`/`routines-storage.js`/`routines-derived.js`/`utils.js`, nunca de `routines.js` ni `screens.js`).

Todo `js/*.js` son **ES modules** (`type="module"` en `index.html`). Esto importa: no se puede abrir `index.html` con `file://` directo porque los navegadores bloquean imports de módulos por CORS. Para probar local:

```bash
cd /home/nicobroyad/repos/registro-peso
python3 -m http.server 8000
# abrir http://localhost:8000/
```

## PWA

- `manifest.json` + `sw.js` + `icons/` hacen que el navegador ofrezca "Agregar a pantalla de inicio" (Android/Chrome muestra el prompt automático si el manifest y el service worker son válidos; iOS/Safari lo permite desde el menú Compartir igual, sin necesitar el service worker).
- Los íconos (`icons/icon-192.png`, `icons/icon-512.png`, `icons/apple-touch-icon.png`, `icons/favicon-32.png`) se generaron a partir de una foto/diseño que compartió el usuario (`icons/app-logo.JPEG` guarda la fuente actual, sin usarse directo — es de referencia). Si el usuario manda un `.HEIC` (típico de iPhone), Pillow del sistema **no** lo puede abrir sin el plugin `pillow-heif`, que tampoco está instalado y el entorno es Debian "externally managed" (no se puede `pip install` directo al sistema) — hay que crear un venv (`python3 -m venv ...`, `pip install pillow pillow-heif`) y desde ahí `pillow_heif.register_heif_opener()` antes de `Image.open(...)`. Si la fuente ya viene con las esquinas redondeadas y fondo transparente (como si fuera un ícono ya recortado, ej. exportado de un editor de íconos), conviene aplanar el canal alfa sobre un color sólido igual al de relleno interior (ver un píxel interior, no la esquina) en vez de dejarlo transparente — así el cuadrado completo queda con un solo color de fondo y es el sistema (Android/iOS) el que aplica su propio recorte de esquinas, evitando un doble-redondeado feo. Redimensionar con Pillow (`Image.resize(..., Image.LANCZOS)`) a los 4 tamos necesarios. No hay ImageMagick/rsvg-convert instalado en este entorno; si en cambio hay que generar un ícono desde cero (sin foto de partida), el patrón viejo seguía funcionando: escribir un SVG en un HTML mínimo y `google-chrome --headless --screenshot=salida.png --window-size=WxH archivo.html`.
- `sw.js` cachea (cache-first, con actualización en segundo plano) únicamente los archivos de mismo origen listados en `ASSETS` — si se agrega un archivo `.js` nuevo a `js/`, hay que sumarlo a esa lista y **subir el número de `CACHE_NAME`** (ej. `registro-peso-v2`) para que los navegadores con el service worker viejo lo reemplacen; si no, algunos usuarios pueden quedar viendo una versión cacheada vieja hasta que limpien el cache a mano.
- Las llamadas a Supabase y al CDN de `supabase-js` (otro origen) pasan de largo por el service worker sin cachearse — nunca deberían quedar servidas desde caché.

## Supabase

- **Proyecto**: `registro-peso`, ref `ogqbvooefjojaovxhhcx`, región `sa-east-1`.
- **Organización**: `Broyi Personal`, id `mtfgkmyeuxlhxsizsykj`.
- **URL**: `https://ogqbvooefjojaovxhhcx.supabase.co` (hardcodeada en `js/config.js` junto con la `anon key` — ambas son seguras de exponer en el cliente, la seguridad real la da Row Level Security).
- **Tablas** (todas con RLS activado, policies restringidas a `auth.uid() = user_id`, `user_id` con default `auth.uid()`):
  - `public.weight_entries` — el registro de peso en sí. Columnas `date`, `weight`, `note`, `updated_at`; PK compuesta `(user_id, date)`. Full CRUD desde el cliente.
  - `public.weight_entries_log` — historial inmutable de altas/ediciones/bajas de `weight_entries`, para el panel "Actividad reciente". Columnas `entry_date`, `action` (`created`/`updated`/`deleted`), `previous_weight`, `previous_note`, `new_weight`, `new_note`, `changed_at`. Solo `select` + `insert` desde el cliente (nunca update/delete) — se inserta una fila nueva en cada guardado/borrado de `modal.js`, nunca se modifica una existente.
  - `public.weight_goals` — historial inmutable de metas/fases, para el panel "Meta y objetivo". Columnas `target_weight` (nullable), `phase` (nullable, check `volumen`/`definicion`/`mantenimiento`), `created_at`. Igual que el log de arriba: solo `select` + `insert`, nunca se actualiza una fila — la meta "actual" es simplemente la fila más reciente (`order by created_at desc limit 1`). Guardar una meta nueva, cambiar de fase, o "quitar la meta" son todas la misma operación: insertar una fila nueva (con `target_weight`/`phase` en `null` para "sin meta"/"sin fase"). Esto preserva el historial completo de cómo fue cambiando el objetivo a lo largo del tiempo sin necesitar una tabla separada de auditoría.
  - `public.routine_days` — nombre del entrenamiento de cada día de la semana (ej. lunes → "Push 1") + `is_rest` (boolean, default false) para marcar el día como descanso. PK compuesta `(user_id, day_of_week)`, `day_of_week` 1=lunes..7=domingo. A diferencia de `weight_goals`/`weight_entries_log`, acá SÍ hay `update` directo (upsert por `day_of_week`, `saveRoutineDay` en `js/routines-storage.js`) porque es solo una etiqueta editable, no necesita auditoría. Marcar `is_rest` no borra los ejercicios de ese día — solo los oculta en el render (`js/routines-render.js`) mientras esté tildado.
  - `public.routine_exercises` — la "plantilla" de ejercicios de cada día: `day_of_week`, `name`, `sets_target` (número, nullable), `reps_target` (texto libre, ej. "6-8", nullable), `order_index`, `variant` (smallint, default 0). `order_index` es el **slot** (posición 1, 2, 3... del ejercicio en el día); varias filas pueden compartir el mismo `order_index` si son alternativas entre sí (`variant` 0=principal, 1="b", 2="c"...) — cada variante tiene su propio `id` y por lo tanto su propio historial en `routine_logs`, completamente separado. Reordenar un slot es actualizar `order_index` de todas sus variantes a la vez (swap con el slot vecino), nunca se reasignan `variant`. Full CRUD desde el cliente (crear/editar/borrar un ejercicio). Borrar un ejercicio borra en cascada (`on delete cascade`) sus `routine_logs`.
  - `public.routine_logs` — cada serie (set) realizada en una sesión de entrenamiento: `exercise_id` (FK a `routine_exercises`), `session_date`, `set_number`, `weight`, `reps`. Un registro por set (no por sesión completa) — esto es deliberado: permite mostrar el historial agrupado por fecha (ver `js/routines-derived.js`), calcular "mejor"/"último" registro por ejercicio, y deja la puerta abierta a gráficos de progreso más adelante sin tener que migrar datos. Full CRUD desde el cliente. Guardar una sesión (`replaceSessionSets` en `js/routines-storage.js`) borra todas las filas de esa `exercise_id`+`session_date` y las vuelve a insertar — es un **reemplazo completo del día**, no un append; esto es intencional (decisión del usuario) para que "cargar hoy" y "editar un día viejo" sean la misma operación sin duplicar series.
- **RLS**: cada usuario (en la práctica, uno solo) ve y edita únicamente sus propias filas.
- **Auth**: email/password. **El registro público está desactivado** (`disable_signup: true` vía Management API) para que nadie pueda crearse una cuenta nueva y ver la data. Existe un único usuario: `nicolasbroyad@gmail.com`. La contraseña no está guardada en ningún archivo del repo por seguridad — si hace falta cambiarla, se puede resetear desde el dashboard de Supabase (Authentication → Users) o pedirle al usuario que la comparta en el chat para actualizarla vía Admin API.

### CLI de Supabase

Se instaló el binario directo (sin apt, porque no había sudo) en `~/.local/bin/supabase`. Si no está en el PATH de la sesión nueva:

```bash
export PATH="$HOME/.local/bin:$PATH"
supabase --version
```

El login normal (`supabase login`) no funciona en este entorno porque no hay TTY interactivo. Hace falta un **access token personal**:

1. El usuario genera uno en https://supabase.com/dashboard/account/tokens (recomendar "No expiration" o el máximo disponible).
2. Se usa así:
   ```bash
   export SUPABASE_ACCESS_TOKEN="sbp_..."
   supabase projects list   # confirma que el token funciona
   ```

El proyecto local ya está linkeado (`supabase link --project-ref ogqbvooefjojaovxhhcx` ya se corrió una vez); si hace falta re-linkear en una sesión nueva, correr ese comando de nuevo con el token seteado.

### Migraciones

Están versionadas en `supabase/migrations/`. Para aplicar una migración nueva:

```bash
export SUPABASE_ACCESS_TOKEN="sbp_..."
supabase db push --password "<DB_PASSWORD>"
```

**La contraseña de la base de datos** se generó al azar al crear el proyecto. Con autorización explícita del usuario (dada el 2026-08-14, repo nunca se hace público), el `SUPABASE_ACCESS_TOKEN` y la contraseña de DB quedaron guardados en `.supabase-credentials` en la raíz del repo, **gitignoreado** (no viaja a GitHub ni queda en el historial de git). Si el archivo existe, usarlo así en vez de pedirle las credenciales de nuevo al usuario:
```bash
export PATH="$HOME/.local/bin:$PATH"
cd /home/nicobroyad/repos/registro-peso
set -a; source .supabase-credentials; set +a
supabase db push --include-all
```
Si no existe o el token/contraseña dejaron de funcionar, hay que volver a pedírselos al usuario (token: dashboard.supabase.com/account/tokens; contraseña: Project Settings → Database → Reset database password) y, si vuelve a autorizarlo, reescribir `.supabase-credentials`.

## Vercel

- **Proyecto**: `registro-peso`, bajo el team `nicolasbroyad-gmailcoms-projects`.
- **URL de producción**: https://registro-peso-one.vercel.app (alias fijo; no cambia entre deploys).
- El repo de GitHub quedó conectado al proyecto de Vercel al hacer el primer `vercel --prod`, pero **no hay auto-deploy configurado on push** — cada cambio que se quiera publicar requiere correr el deploy manualmente:
  ```bash
  export PATH="$HOME/.nvm/versions/node/v22.19.0/bin:$PATH"   # o donde esté npm global en la sesión nueva
  cd /home/nicobroyad/repos/registro-peso
  vercel --prod --yes
  ```
- El CLI (`vercel`) se instaló con `npm install -g vercel`. El login (`vercel login`) es por navegador (device flow, como el de `gh`) — si la sesión perdió la autenticación, correr `vercel login`, mostrarle al usuario la URL con el código, y esperar confirmación antes de seguir.
- No hace falta `vercel.json`: al haber un `index.html` en la raíz, Vercel lo sirve directo sin rewrites.

## GitHub

- Repo: `https://github.com/NicolasBroyad/registro-peso`, **privado**, dueño `NicolasBroyad`.
- Autenticación por SSH ya configurada en esta máquina (`git@github.com`), así que `git push`/`git pull` funcionan directo sin pedir credenciales.
- `gh` (GitHub CLI) también está instalado en `~/.local/bin/gh` por si hace falta gestionar el repo, PRs, etc. Login vía `gh auth login --hostname github.com --git-protocol ssh --web` (device flow por navegador).
- Flujo de trabajo normal: commitear con mensajes descriptivos (co-autoría `Claude Sonnet 5 <noreply@anthropic.com>`), pushear a `main` directo (no se usan ramas ni PRs en este proyecto, es de un solo desarrollador).

## Cómo se verificaron los cambios en cada sesión

No hay suite de tests. La verificación se hizo así, y conviene seguir el mismo patrón:

1. **Sintaxis**: `node --check js/archivo.js` para cada módulo tocado (rápido, no requiere navegador).
2. **Visual**: levantar `python3 -m http.server` en el directorio del proyecto y sacar capturas con Chrome headless:
   ```bash
   google-chrome --headless --disable-gpu --no-sandbox \
     --screenshot=/ruta/salida.png --window-size=1280,1200 \
     --virtual-time-budget=4000 "http://localhost:PUERTO/"
   ```
3. Para probar flujos que requieren login (casi todo, ya que la app está gateada), se copiaba `index.html` a un archivo temporal con un `<script>` extra al final que autocompleta el form de login y hace click, y se le apuntaba Chrome headless a ese archivo servido por el mismo `http.server` (tiene que ser mismo origen que los módulos, si no las cookies/sesión de Supabase no aplican igual — no usar `file://` ni iframes cross-origin para esto).
4. Las capturas y servidores de prueba se guardan/limpian en el directorio scratchpad de la sesión, nunca en el repo.

Las credenciales de login (`nicolasbroyad@gmail.com` + contraseña) las tiene el usuario; pedírselas en el chat si hace falta un test end-to-end con sesión real.

**Importante**: no hay entorno de test separado — la app apunta siempre a la base de Supabase real de producción, incluso al probar localmente. Cualquier dato que se cree durante una prueba end-to-end (registros de peso, metas, etc.) queda guardado de verdad. Después de probar, borrar lo que se haya creado como parte del test (vía REST API con la `service_role` key, o desde la UI) para no dejar basura en el historial real del usuario. Ya pasó más de una vez en esta sesión (entradas de prueba en fechas sin dato real, una meta de prueba) y hubo que limpiarlas a mano.

## Gotchas encontrados

- **No usar `<input type="number">` para el peso.** Si el usuario tipea con coma decimal (común en teclado en español, ej. "70,5"), el navegador invalida el input y `.value` devuelve `""` silenciosamente — el JS nunca ve un error, simplemente el peso queda vacío y falla la validación con un mensaje que no explica la causa real. Se cambió a `<input type="text" inputmode="decimal">` + `.replace(',', '.')` antes de `parseFloat` en todos los inputs de peso (carga de registro y meta). Si se agrega algún input numérico nuevo, replicar este patrón, no usar `type="number"`.
- **La clase `.hidden` necesita `!important`.** Primero se agregó como `.hidden{ display:none; }` genérica al principio de `styles.css` (ver historial), pero seguía fallando en elementos que además tienen una clase con `display` propio definida *después* en el archivo (ej. `#btn-log-today` tiene `.btn-primary{ display:inline-flex; }`, que gana el empate de especificidad por venir más abajo en la cascada) — se descubrió al ocultar el botón "+ Cargar peso de hoy" y el título al entrar a la pantalla de Rutina. La regla quedó como `.hidden{ display:none !important; }` para que gane siempre, sin importar qué otra clase tenga el elemento ni el orden en el archivo.
- **El Browser pane sandboxeado de esta sesión de Claude Code no puede registrar el service worker** (`navigator.serviceWorker.register('/sw.js')` falla siempre con "An unknown error occurred when fetching the script" — es el mismo error inofensivo de CDN que aparece en cada test, pero en realidad es esto, no el script de Supabase). Es una restricción del entorno sandbox, no un bug de la app. Consecuencia práctica: **nada relacionado a PWA/service worker/caché se puede verificar empíricamente desde acá** — cualquier cambio a `sw.js` se valida por revisión de código nomás, y hay que pedirle al usuario que confirme en su dispositivo real (y° preferentemente sacando la PWA de la pantalla de inicio y agregándola de nuevo, para descartar una versión vieja de service worker/caché pisada).
- **`sw.js` pasó de cache-first para todo a network-first para el "shell"** (navegación / `index.html`) manteniendo cache-first para el resto de los assets (JS/CSS/íconos), después de un reporte del usuario en iPhone (Safari, PWA agregada a pantalla de inicio) de que el formulario de login quedaba completamente no interactivo (no se podían tocar los inputs, no aparecía el teclado) al abrir la app por primera vez. La sospecha principal: con cache-first puro, `index.html` puede quedar servido desde una versión vieja cacheada mientras los `.js` se actualizan de forma asincrónica e independiente por URL — una mezcla de shell viejo + JS nuevo (o viceversa) puede romper el arranque de la app de formas difíciles de diagnosticar. Con el shell en network-first, cuando hay conexión siempre se sirve la versión más nueva de `index.html`, evitando ese desfasaje; solo cae al cache si está offline. De paso se blindó `js/swipe-nav.js` para que el gesto de swipe-para-navegar ignore por completo los toques que empiezan sobre un `input`/`textarea`/`select`/`[contenteditable]` o mientras la pantalla de login está visible (chequea si `#app-root` tiene la clase `hidden`) — no se confirmó que esto fuera la causa real del bug (no se pudo reproducir en este entorno), pero es una protección razonable independientemente de cuál haya sido la causa. **Confirmado (2026-08-15): el fix de `sw.js` no alcanzó.** El usuario probó en Safari normal (anda perfecto) vs. la PWA agregada a pantalla de inicio (sigue rota), incluso después de borrar el ícono viejo y volver a agregarlo desde cero varias veces — así que **no es un problema de caché/service worker viejo**, es algo propio del modo `display: standalone` en sí (WKWebView) que no se puede reproducir desde este entorno (ni siquiera se puede registrar un service worker acá, ver arriba). Como no hay Mac a mano para conectar Safari Web Inspector y ver la consola real del dispositivo, se agregó **instrumentación de diagnóstico temporal** en el `<head>` de `index.html`: un `window.onerror`/`unhandledrejection` que muestra un banner rojo en pantalla con el mensaje de cualquier error de JS no capturado (`window.__diagBanner`), un `onerror` inline en el `<script>` del CDN de Supabase y en `<script type="module" src="js/main.js">` para detectar fallos de carga de esos scripts puntuales (que no siempre disparan `window.onerror`), y un chequeo a los 4s de si `window.supabase` sigue `undefined` (por si el CDN se cuelga en vez de fallar limpio). **Sacar todo este bloque una vez resuelto el bug** — está marcado "TEMPORAL" en el HTML.

**Resuelto (2026-08-15): no era caché.** El usuario confirmó que en la pantalla rota **podía hacer scroll** y que **tocar "Ingresar" sí reaccionaba** (el botón se oscurecía y disparaba la validación nativa "completá este campo" del navegador) — es decir, los toques SÍ llegaban a la página, no era un freeze total. El problema era puntual: los `<input>` de email/contraseña nunca se enfocaban al tocarlos (no aparecía el teclado), aunque el resto de la página respondía normal. Esa firma (botones y scroll ok, inputs de texto no) es la de un bug conocido de WebKit/iOS standalone: **un listener de `touchstart` en un ancestro del input puede romper el foco de ese input, aunque el listener sea `passive:true` y no llame `preventDefault`** — en teoría no debería importar, pero empíricamente en WKWebView a veces sí. El único listener global de `touchstart` de la app era el de `js/swipe-nav.js` (para el swipe entre pantallas), colgado de `document` — un ancestro de *todo*, incluida la pantalla de login. Se cambió para colgarse de `#app-root` en vez de `document`: como `#login-screen` es un **hermano** de `#app-root` (no un descendiente), el listener estructuralmente nunca puede tocar nada de la pantalla de login, en vez de solo esquivarla con un chequeo adentro del handler (que es lo que se había hecho en el intento anterior y no alcanzó). El usuario confirmó que esto lo arregló. **Moraleja para cualquier listener global nuevo de `touchstart`/`pointerdown`/etc.: colgarlo de `#app-root`, nunca de `document`/`body`, para que estructuralmente no pueda alcanzar `#login-screen`.** La instrumentación de diagnóstico temporal (banner rojo en pantalla ante errores de JS) se sacó de `index.html` una vez confirmado el fix — si hace falta volver a diagnosticar algo parecido en el futuro, el patrón está en el historial de git de ese archivo.

## Cosas a tener en cuenta / posibles próximos pasos

- El plan gratuito de Supabase pausa el proyecto tras 7 días sin actividad (se reactiva con un click desde el dashboard, no se pierden datos). Si el usuario deja de usar la app un tiempo largo, puede encontrarse con esto.
- No hay manejo de "olvidé mi contraseña" en la UI — si hace falta, se resetea manualmente vía Admin API o dashboard (ver sección Supabase).
- No hay tests automatizados ni CI. Cualquier cambio se verifica manualmente como se describe arriba antes de pushear y deployar.
- El deploy a Vercel es manual (no hay auto-deploy on push a `main`). Si en algún momento se quiere automatizar, se puede conectar el repo desde el dashboard de Vercel para que cada push a `main` dispare un deploy solo.
