# Silhouette Telephone

Juego multijugador en tiempo real: un jugador escribe conceptos, otro dibuja desde una silueta borrosa, el siguiente adivina lo que vio y al final se vota. 2–8 jugadores, 3 cadenas paralelas.

## Estructura

- `packages/shared-types` — tipos compartidos (DB, avatar, motor).
- `packages/game-engine` — normalización, matching, scoring y scheduling (Vitest).
- `apps/web` — Next.js 15 (App Router), Supabase SSR, Tailwind 4.
- `supabase/migrations/001_init_silhouette_telephone.sql` — esquema, triggers, RLS y Storage.
- `supabase/seed.sql` — datos de ejemplo.

## Desarrollo local

```bash
pnpm install
cp .env.example apps/web/.env.local   # rellena los valores
pnpm --filter @silhouette/game-engine test
pnpm --filter web typecheck
pnpm --filter web dev
```

## Configuración de Supabase

1. Ejecuta `supabase/migrations/001_init_silhouette_telephone.sql` en el SQL Editor del proyecto (y `seed.sql` si quieres datos de prueba).
2. **Authentication → Providers → Anonymous Sign-Ins: ON**. Sin esto no se puede jugar como invitado.
3. **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000` en desarrollo; tu dominio de Vercel en producción.
   - Redirect URLs: añade `http://localhost:3000/auth/confirm` y `https://<tu-app>.vercel.app/auth/confirm`.
4. **Storage**: el bucket `drawings` se crea en la migración; las políticas permiten lectura/escritura solo a participantes de la sala correspondiente.

### Variables de entorno

| Variable | Dónde | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | cliente + servidor | URL del proyecto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | cliente + servidor | RLS protege el acceso |
| `SUPABASE_SERVICE_ROLE_KEY` | **solo servidor** | operaciones autoritativas (nunca con prefijo `NEXT_PUBLIC_`) |
| `NEXT_PUBLIC_APP_URL` | cliente + servidor | redirects de confirmación de correo |

## Cómo funciona la identidad

- **Invitado (recomendado para jugar rápido):** escribes tu nombre en `/`, se crea una sesión anónima; el trigger `handle_new_auth_user()` crea tu perfil y se guarda el nombre. No se pide correo.
- **Guardar progreso:** desde `/profile`, "Vincular correo a mi cuenta" convierte el invitado en cuenta permanente (`auth.updateUser({ email, password })`) conservando puntos y avatar.
- **Registro con correo:** `/auth` → Registrarse. El enlace de confirmación vuelve a `NEXT_PUBLIC_APP_URL/auth/confirm`, verifica la OTP y abre sesión. El `username` se envía en `user_metadata`, así que el trigger lo usa en vez de `Jugador-XXXXXX`.

## Despliegue en Vercel + Supabase

1. Importa el repositorio en Vercel; el framework es Next.js, root directory `apps/web`.
2. Configura las **4 variables de entorno** en Vercel (Project Settings → Environment Variables) para Production y Preview. Las `NEXT_PUBLIC_*` se inyectan en el bundle **durante el build**: si las añades después, haz un **Redeploy**.
3. En Supabase → Authentication → URL Configuration, pon Site URL = `https://<tu-app>.vercel.app` y añade `https://<tu-app>.vercel.app/auth/confirm` a Redirect URLs.
4. Activa Anonymous Sign-Ins (si quieres el flujo de invitado) y confirma que la migración SQL fue aplicada **completa** (en particular `generate_unique_room_code()`, `handle_new_auth_user()` y el bucket `drawings`).
5. `pnpm --filter web build` debe terminar sin errores. Las rutas API son dinámicas (`force-dynamic`); el middleware refresca la sesión en cada request.

### Diagnóstico de errores

Los endpoints devuelven `{ error, detail }` y registran la causa en los logs de Vercel. Si crear sala falla:

- `Falta la variable de entorno SUPABASE_SERVICE_ROLE_KEY` → configúrala en Vercel y redeploy.
- `No se pudo generar el código de sala` → falta la función `generate_unique_room_code()` en la BD.
- `Tu usuario no tiene perfil...` → falta el trigger `on_auth_user_created` o la confirmación de correo; vuelve a entrar.
