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
├── icons/                  # íconos de la PWA (192/512/apple-touch/favicon), generados desde un SVG propio
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
│   └── main.js                          # wiring de todos los event listeners + arranque
└── supabase/
    └── migrations/                     # SQL versionado de la base (ver sección Supabase)
```

Todo `js/*.js` son **ES modules** (`type="module"` en `index.html`). Esto importa: no se puede abrir `index.html` con `file://` directo porque los navegadores bloquean imports de módulos por CORS. Para probar local:

```bash
cd /home/nicobroyad/repos/registro-peso
python3 -m http.server 8000
# abrir http://localhost:8000/
```

## PWA

- `manifest.json` + `sw.js` + `icons/` hacen que el navegador ofrezca "Agregar a pantalla de inicio" (Android/Chrome muestra el prompt automático si el manifest y el service worker son válidos; iOS/Safari lo permite desde el menú Compartir igual, sin necesitar el service worker).
- Los íconos (`icons/icon-192.png`, `icons/icon-512.png`, `icons/apple-touch-icon.png`, `icons/favicon-32.png`) se generaron rasterizando un SVG propio (un ícono simple de balanza, paleta del `card-lcd`) con capturas de Chrome headless a distintos tamaños de ventana — no hay ImageMagick/rsvg-convert instalado en este entorno. Si hay que regenerarlos, el patrón es: escribir el SVG en un HTML mínimo, `google-chrome --headless --screenshot=salida.png --window-size=WxH archivo.html`.
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

**La contraseña de la base de datos** se generó al azar al crear el proyecto y no quedó guardada en ningún lado recuperable — si hace falta correr una migración y no se tiene, hay que resetearla desde el dashboard de Supabase (Project Settings → Database → Reset database password) y usar la nueva.

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

## Cosas a tener en cuenta / posibles próximos pasos

- El plan gratuito de Supabase pausa el proyecto tras 7 días sin actividad (se reactiva con un click desde el dashboard, no se pierden datos). Si el usuario deja de usar la app un tiempo largo, puede encontrarse con esto.
- No hay manejo de "olvidé mi contraseña" en la UI — si hace falta, se resetea manualmente vía Admin API o dashboard (ver sección Supabase).
- No hay tests automatizados ni CI. Cualquier cambio se verifica manualmente como se describe arriba antes de pushear y deployar.
- El deploy a Vercel es manual (no hay auto-deploy on push a `main`). Si en algún momento se quiere automatizar, se puede conectar el repo desde el dashboard de Vercel para que cada push a `main` dispare un deploy solo.
