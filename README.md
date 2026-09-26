# FitTracker 2.0

Web app (PWA) para llevar el peso corporal diario y las rutinas del gimnasio: promedios semanales y mensuales, metas con plazo y fases de volumen/definición/mantenimiento; rutinas por día de la semana con varias rutinas y una activa, ejercicios compartidos entre días y rutinas, alternativas por puesto, carga de series y métricas de rendimiento (récords, 1RM estimado, volumen por grupo muscular, constancia).

**Stack**: Vite · React 19 · TypeScript · Tailwind CSS 4 · TanStack Query · Motion · Vaul · Recharts · Supabase (Postgres + Auth + RLS) · PWA.

```bash
npm install
npm run dev        # abrí http://localhost:5173/?demo para verla con datos de ejemplo
npm run build
npm run test:db    # prueba las migraciones de Supabase sobre PGlite
```

Detalles de arquitectura, backend y decisiones de diseño en [`CLAUDE.md`](CLAUDE.md).
