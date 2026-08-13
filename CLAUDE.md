# Registro de Peso — contexto del proyecto

App personal (uso de un solo usuario) para registrar el peso diario en ayunas. Nació como un prototipo de un chat web de Claude (un solo archivo HTML) y se fue evolucionando acá en la terminal hasta quedar como una mini-app con backend en la nube y deploy automático.

Este archivo existe para que una sesión nueva de Claude Code pueda retomar el trabajo sin tener que redescubrir todo el contexto. Léelo entero antes de tocar nada.

## Qué hace la app

- Cargar el peso del día (+ nota opcional) desde un modal.
- Ver el historial en un calendario mensual, en una lista cronológica ("Registros") y en gráficos (semanal con tendencia lineal, diario con promedio móvil de 7 días).
- Tocar un día del calendario o un ítem de "Registros" que ya tiene dato abre un modal de **solo lectura** con un botón de lápiz para pasar a edición (no se edita directo).
- Modo claro/oscuro con toggle manual (ícono sol/luna en SVG, no emoji) que respeta la preferencia del sistema por defecto y persiste la elección en `localStorage`.
- Login obligatorio (un solo usuario) para que los datos no queden expuestos públicamente.

## Stack y por qué

- **Frontend**: HTML/CSS/JS vanilla, sin build step ni framework. Se eligió así porque es una app chica de un solo usuario y no vale la pena la complejidad de un bundler.
- **Backend/datos**: Supabase (Postgres + Auth), plan gratuito. Antes vivía en `localStorage` del navegador, pero eso no sincroniza entre dispositivos ni sobrevive un cambio de navegador — se migró a Supabase para tener los datos disponibles desde cualquier lugar (celu, PC).
- **Hosting**: Vercel, plan gratuito, deploy manual vía CLI (no hay integración automática de "push a main = deploy" configurada; ver sección Deploy).
- **Repo**: GitHub, privado (`NicolasBroyad/registro-peso`).

## Estructura de archivos

```
registro-peso/
├── index.html              # markup, sin lógica
├── css/
│   └── styles.css          # todos los estilos (incluye paleta clara/oscura)
├── js/
│   ├── config.js            # cliente Supabase (URL + anon key, ambas públicas por diseño)
│   ├── seed-data.js          # historial importado del excel original, para sembrar la DB la primera vez
│   ├── state.js               # estado compartido (entries, viewMonth, activeTab, etc.) con setters porque son ES modules
│   ├── utils.js                # fechas, formato, toasts, escapeHtml
│   ├── storage.js               # capa de datos: loadEntries/upsertEntry/deleteEntryByDate contra Supabase
│   ├── derived.js                # cálculos: tendencia, racha, min/max, promedios semanales, regresión lineal
│   ├── chart.js                   # dibuja los gráficos SVG a mano (sin librería de charts)
│   ├── chart-modal.js              # pestañas semanal/diario + modal de gráfico ampliado
│   ├── render.js                    # pinta stats, calendario, notas, lista de registros
│   ├── modal.js                      # modal de vista (solo lectura) + modal de edición/alta
│   ├── auth.js                        # login/logout, chequeo de sesión al cargar
│   ├── theme.js                        # toggle claro/oscuro, iconos SVG inline
│   └── main.js                         # wiring de todos los event listeners + arranque
└── supabase/
    └── migrations/                     # SQL versionado de la base (ver sección Supabase)
```

Todo `js/*.js` son **ES modules** (`type="module"` en `index.html`). Esto importa: no se puede abrir `index.html` con `file://` directo porque los navegadores bloquean imports de módulos por CORS. Para probar local:

```bash
cd /home/nicobroyad/repos/registro-peso
python3 -m http.server 8000
# abrir http://localhost:8000/
```

## Supabase

- **Proyecto**: `registro-peso`, ref `ogqbvooefjojaovxhhcx`, región `sa-east-1`.
- **Organización**: `Broyi Personal`, id `mtfgkmyeuxlhxsizsykj`.
- **URL**: `https://ogqbvooefjojaovxhhcx.supabase.co` (hardcodeada en `js/config.js` junto con la `anon key` — ambas son seguras de exponer en el cliente, la seguridad real la da Row Level Security).
- **Tabla**: `public.weight_entries` — columnas `user_id` (default `auth.uid()`), `date`, `weight`, `note`, `updated_at`; PK compuesta `(user_id, date)`.
- **RLS**: activado, con policies de select/insert/update/delete que sólo permiten `auth.uid() = user_id`. Cada usuario (en la práctica, uno solo) ve y edita únicamente sus propias filas.
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

## Cosas a tener en cuenta / posibles próximos pasos

- El plan gratuito de Supabase pausa el proyecto tras 7 días sin actividad (se reactiva con un click desde el dashboard, no se pierden datos). Si el usuario deja de usar la app un tiempo largo, puede encontrarse con esto.
- No hay manejo de "olvidé mi contraseña" en la UI — si hace falta, se resetea manualmente vía Admin API o dashboard (ver sección Supabase).
- No hay tests automatizados ni CI. Cualquier cambio se verifica manualmente como se describe arriba antes de pushear y deployar.
- El deploy a Vercel es manual (no hay auto-deploy on push a `main`). Si en algún momento se quiere automatizar, se puede conectar el repo desde el dashboard de Vercel para que cada push a `main` dispare un deploy solo.
