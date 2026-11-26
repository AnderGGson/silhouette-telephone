```markdown
# MEGA PROMPT: Especificación Integral de "Silhouette Telephone" (Monorepo Full-Stack)

Actúa como un **Arquitecto de Software Principal, Ingeniero Full-Stack Senior, Especialista en Sistemas en Tiempo Real y Diseñador de Producto**. Tu misión es construir de extremo a extremo **"Silhouette Telephone"**, un juego web multijugador en tiempo real al estilo *Gartic Phone* centrado en la **interpretación de siluetas borrosas**, **adivinanza rápida ("¿Qué viste?")**, **votación social al final**, **autenticación + modo invitado**, **personalización simple de avatar** y **chat en vivo**, organizado como un **monorepo** listo para desplegarse en **Vercel** y respaldado por **Supabase** (PostgreSQL, Auth, Realtime y Storage).

Este documento es la **fuente de verdad absoluta** para la arquitectura, reglas de negocio, esquema de datos, contratos de eventos, UI/UX, pruebas, seguridad y despliegue. No omitas detalles, no dejes placeholders sin resolver en la lógica central y respeta estrictamente todas las restricciones indicadas.

---

## 1. CONTEXTO, OBJETIVO Y ENTREGABLES

### 1.1 Qué estamos construyendo
Un juego web multijugador donde los jugadores entran a una sala, envían conceptos, el sistema sortea **3 conceptos al azar**, y se desarrollan **3 cadenas paralelas** de interpretación visual:
1. Cada cadena comienza con un concepto sorteado y un primer dibujante.
2. Al enviar el dibujo o agotarse el tiempo, la imagen se transforma en una **silueta borrosa** (perdiendo detalle fino y dejando formas/masas ambiguas).
3. El siguiente jugador de esa cadena ve **solo la silueta borrosa**, escribe en pocos segundos qué cree que es (**"¿Qué viste?"**), y luego dibuja su propia interpretación tomando como referencia esa silueta.
4. Repite el ciclo hasta completar los pasos de la cadena.
5. Al final, se revela la **evolución completa de los 3 conceptos** una por una, los jugadores votan en categorías sociales para sumar puntos y se muestra el podio.

### 1.2 Restricciones de Sala y Reglas Clave
- **Jugadores por sala:** Mínimo **2 jugadores**, máximo **8 jugadores**. No se puede iniciar partida con menos de 2 ni permitir que entren más de 8 jugadores activos/reservados a una misma sala.
- **Gestión de los 3 conceptos:** Se trabajan **todos a la vez (en paralelo)** en cada ronda de turnos, **nunca** uno por uno secuencialmente esperando a que termine todo un concepto antes de empezar el siguiente.
- **Despliegue:** Todo el repositorio debe poder compilar, pasar tipos/tests y desplegarse sin errores en **Vercel** (usando `pnpm` + `Turborepo` + Next.js App Router).
- **Backend / Persistencia:** **Supabase** (Auth, PostgreSQL con RLS, Realtime, Storage).
- **Cuentas y acceso:** Posible inicio de sesión (Email/Password, OAuth si está configurado, o **modo invitado anónimo** de Supabase Auth para entrar rápido).
- **Avatar:** Personalizador simple de avatar en capas SVG guardable en perfil.
- **Chat:** Chat en tiempo real dentro de la web integrado en la sala.

---

## 2. REGLAS DE NEGOCIO Y MECÁNICA DETALLADA

### 2.1 Ciclo de Vida de una Partida (Máquina de Estados)
La sala (`rooms.status`) sigue una máquina de estados estricta validada en el servidor:

1. `LOBBY`
   - Sala creada con código único de 6 caracteres alfanuméricos (sin caracteres ambiguos como `0/O`, `1/I/L`).
   - Se muestran los jugadores conectados (mínimo 2, máximo 8), su avatar, estado (`Listo` / `Host` / `Desconectado`) y el chat de sala.
   - El `host` puede configurar ajustes de la partida (antes de iniciar):
     - `conceptSubmissionSeconds` (ej. `20`s, rango `10–45`s).
     - `guessSeconds` (ej. `10`s, rango `5–20`s).
     - `drawSeconds` (ej. `50`s, rango `20–120`s).
     - `blurIntensity`: `'soft' | 'medium' | 'extreme'` (por defecto `'medium'`).
     - `maxChainSteps`: número de pasos por cadena (`3` a `6`, ajustado automáticamente si hay `2` jugadores).
     - `conceptsPerPlayer`: cuántos conceptos propone cada jugador (ej. `2`, rango `1–4`).
     - `muteChatDuringDraw`: `boolean` (por defecto `false`; si es `true`, el chat se oculta o queda solo lectura durante `PLAYING_TURN` para evitar pistas/spoilers).
   - Solo el `host` puede iniciar la partida cuando `playerCount >= 2` y `playerCount <= 8`.

2. `CONCEPT_SUBMISSION`
   - Cada jugador envía hasta `conceptsPerPlayer` conceptos (texto limpio, 2 a 60 caracteres, sin vacíos ni duplicados exactos dentro de la misma sala).
   - Si un jugador no envía suficientes conceptos antes de `step_ends_at`, el servidor completa automáticamente con conceptos del banco por defecto (`supabase/seed.sql`) para garantizar siempre un pool suficiente.

3. `CONCEPT_DRAW`
   - El servidor selecciona **3 conceptos distintos al azar** del pool de la sala (marcando `is_selected = true` y asignando `chain_index` `0`, `1`, `2`).
   - Muestra animación de sorteo de los 3 conceptos (duración corta, ej. `5` segundos) y genera el plan de turnos paralelos para el Turno `1`.

4. `PLAYING_TURN` (En paralelo para las 3 cadenas)
   Cada cadena (`chain_index` 0, 1, 2) tiene un paso actual (`step_number`: `1..totalSteps`) y un jugador asignado (`assigned_player_id`).

   - **Caso Turno 1 (`step_number === 1`):**
     - El jugador asignado a la cadena recibe el **concepto original** sorteado (no hay silueta previa aún).
     - Pasa directamente a **Dibujo** (`phase = 'DRAWING'`). No hay adivinanza previa porque ya conoce el concepto inicial.
     - Dibuja en el canvas y envía (o expira el temporizador). El servidor guarda `original_image_url` y genera `silhouette_image_url` (versión borrosa) para el Turno 2.

   - **Caso Turnos posteriores (`step_number > 1`):**
     - **Sub-fase 1 — Adivinanza rápida ("¿Qué viste?") (`phase = 'GUESSING'`, duración `guessSeconds`):**
       - El jugador asignado ve **únicamente la `silhouette_image_url`** del paso anterior (`step_number - 1`).
       - Escribe en un input rápido qué cree que es (`guess_text`, 1 a 80 caracteres).
       - Puede enviar antes de tiempo (pasando a `DRAWING` para esa cadena) o avanzar automáticamente cuando expire el micro-temporizador de adivinanza. Si no escribe nada, `guess_text` queda vacío o `"(sin respuesta)"`.
     - **Sub-fase 2 — Dibujo (`phase = 'DRAWING'`, duración `drawSeconds`):**
       - El jugador ve la **silueta borrosa** del paso anterior como referencia visual (puede alternar opacidad/guía o verla en panel de referencia/canvas) y dibuja su propia interpretación.
       - Al enviar su dibujo o cuando expira `drawSeconds`, el servidor sube `original_image_url` y `silhouette_image_url` a Supabase Storage, registra `chain_steps`, calcula puntos automáticos de ese turno y avanza la cadena.

5. `REVEAL_AND_VOTE`
   - Las **3 cadenas se presentan una por una** (`active_reveal_chain` `0` $\rightarrow$ `1` $\rightarrow$ `2`).
   - En cada cadena se muestra el flujo paso a paso:
     - Concepto inicial sorteado.
     - Paso 1: Dibujo inicial (y silueta generada).
     - Paso 2: Lo que el jugador escribió en *"¿Qué viste?"* + su dibujo + silueta generada.
     - Paso $k$: *"¿Qué viste?"* + dibujo + silueta generada... hasta el dibujo final.
   - Al terminar de recorrer/mostrar una cadena (o en su ventana de votación de `20–25` segundos), cada jugador puede emitir **hasta 1 voto por categoría** en esa cadena (sin auto-votarse en su propio dibujo si es posible, o con regla clara documentada):
     - `faithful`: **Más fiel al original** (`+150 pts` al autor del paso premiado)
     - `funny`: **El más gracioso** (`+150 pts` al autor del paso premiado)
     - `plot_twist`: **Giro más inesperado** (`+150 pts` al autor del paso premiado)
   - Al completar la votación de las 3 cadenas, se consolidan los puntos de votación y se pasa a `PODIUM`.

6. `PODIUM`
   - Muestra el ranking final ordenado por `score` descendente, desglose de puntos por fuente (adivinanzas, claridad visual, puntualidad, votos sociales), estadísticas divertidas de la partida y botón de **"Nueva partida (volver al Lobby)"** que reinicia ronda/cadenas manteniendo la sala y los jugadores (o crea sala nueva).

### 2.2 Algoritmo de Rotación Paralela para 2 a 8 Jugadores
Debes implementar esta lógica como función pura y determinista/testeable en `packages/game-engine`:

- **Regla fundamental:** Los **3 conceptos** avanzan **en paralelo** en cada ronda de turnos (`roundIndex`). En una ronda de turnos, cada cadena activa asigna un jugador.
- **Si hay `N = 2` jugadores (`P0`, `P1`):**
  - Hay 3 cadenas (`C0`, `C1`, `C2`).
  - Para que ambos participen en todas las cadenas y se genere evolución visual sin que un jugador dibuje dos pasos consecutivos de la misma cadena:
    - En cada ronda (`r = 1..K`, con `K = 3` o `4` pasos por cadena), `P0` y `P1` se reparten las cadenas de forma alternada y balanceada (por ejemplo, en un paso `P0` toma 2 cadenas y `P1` toma 1, y en el siguiente `P1` toma 2 y `P0` toma 1, garantizando que en pasos consecutivos de la misma cadena no repita el mismo jugador cuando hay 2 jugadores).
- **Si hay `3 <= N <= 8` jugadores:**
  - En el **Turno 1 (`step_number = 1`)**, se asignan 3 jugadores distintos (uno a `C0`, uno a `C1`, uno a `C2`).
  - En los turnos siguientes (`step_number = 2..S`), donde `S = min(maxChainSteps, N)` (o `maxChainSteps` si se permite reutilizar jugadores cuando `S > N`, priorizando siempre jugadores que aún no hayan participado en esa cadena):
    - Cada cadena selecciona al siguiente jugador disponible que **no haya participado aún** en esa cadena (`!usedPlayerIds.has(player.id)`), priorizando jugadores con menor carga de turnos en la ronda actual para equilibrar el esfuerzo.
    - Si todos los jugadores ya participaron en esa cadena y `S > N`, rota evitando repetir al mismo jugador en dos pasos consecutivos (`prevPlayerId !== candidate.id`).

### 2.3 Sistema de Puntos (Híbrido: Automático + Votación Social)
Define constantes centralizadas en `packages/game-engine/src/scoring.ts`:

- **Acierto con concepto original (`GUESS_MATCH_ORIGINAL`):** `+100 pts`
  - Cuando en "¿Qué viste?" (`step_number > 1`), el `guess_text` normalizado coincide (coincidencia exacta normalizada, inclusión significativa o similitud de texto/lema) con el concepto original de la cadena.
- **Coincidencia con el dibujante anterior (`GUESS_MATCH_PREVIOUS`):** `+50 pts`
  - Si no acertó el concepto original (o adicionalmente si coincide con la adivinanza/etiqueta del paso anterior), coincide con lo que el jugador anterior interpretó/escribió.
- **Claridad visual (`VISUAL_CLARITY_BONUS`):** `+75 pts`
  - Otorgado al autor del paso `k-1` cuando el jugador del paso `k` acierta el concepto original a partir de la silueta generada por el dibujo del paso `k-1`.
- **Entrega a tiempo (`ON_TIME_BONUS`):** `+25 pts`
  - Otorgado cuando el jugador envía su dibujo antes de que expire `step_ends_at` y el canvas contiene trazos reales (no lienzo vacío).
- **Votos de la comunidad (`VOTE_CATEGORY_BONUS`):** `+150 pts` por cada categoría ganada en cada cadena (`faithful`, `funny`, `plot_twist`). En caso de empate en una categoría dentro de una cadena, todos los empatados en el primer lugar de esa categoría reciben `+150 pts` (o se documenta claramente la regla).

---

## 3. ARQUITECTURA DEL MONOREPO Y RESTRICCIONES DE VERCEL

### 3.1 Por qué este diseño funciona en Vercel + Supabase
- En **Vercel**, los Route Handlers / Server Actions son serverless y no mantienen conexiones WebSocket persistentes en memoria entre peticiones.
- Por ello:
  1. **Estado autoritativo y temporizadores:** Se persisten en **Supabase PostgreSQL** (`rooms.status`, `rooms.current_step`, `rooms.step_ends_at`, `chain_steps`, `votes`, etc.).
  2. **Sincronización en tiempo real:** Se usa **Supabase Realtime** (canales por sala `room:{code}` usando `Broadcast` para eventos instantáneos como trazos/avisos de fase + `Postgres Changes` para cambios en `rooms`, `room_players`, `chain_steps`, `votes` y `room_messages`).
  3. **Avance de fase / expiración de tiempo:** Cada cliente ejecuta un reloj local sincronizado con `step_ends_at` (compensando drift de reloj). Al llegar a `0` o al completar todos los envíos esperados de la fase, el cliente invoca un endpoint idempotente en Next.js (`POST /api/rooms/[code]/tick` o `/api/turns/submit`), y el servidor verifica `now >= step_ends_at` o `allSubmitted` dentro de una transacción/operación segura antes de mutar el estado.

### 3.2 Estructura de Carpetas Obligatoria
```text
silhouette-telephone/
├── apps/
│   └── web/
│       ├── next.config.ts
│       ├── postcss.config.mjs
│       ├── tsconfig.json
│       ├── package.json
│       └── src/
│           ├── app/
│           │   ├── layout.tsx
│           │   ├── page.tsx                  # Landing: Crear sala, Unirse por código, Acceso rápido / Auth
│           │   ├── globals.css
│           │   ├── auth/
│           │   │   └── page.tsx              # Login / Registro / Continuar como Invitado
│           │   ├── profile/
│           │   │   └── page.tsx              # Editar username, avatar y ver historial/estadísticas
│           │   ├── lobby/[code]/
│           │   │   └── page.tsx              # Sala de espera (2-8 jugadores), ajustes de host, avatar, chat
│           │   ├── game/[code]/
│           │   │   └── page.tsx              # Orquestador de partida: Conceptos, Turnos, Revelación, Podio
│           │   └── api/
│           │       ├── health/route.ts       # Healthcheck para Vercel
│           │       ├── rooms/
│           │       │   ├── create/route.ts
│           │       │   ├── join/route.ts
│           │       │   ├── [code]/route.ts
│           │       │   ├── [code]/start/route.ts
│           │       │   └── [code]/tick/route.ts
│           │       ├── concepts/
│           │       │   └── submit/route.ts
│           │       ├── turns/
│           │       │   ├── guess/route.ts
│           │       │   └── draw/route.ts
│           │       ├── votes/
│           │       │   └── submit/route.ts
│           │       └── chat/
│           │           └── send/route.ts
│           ├── components/
│           │   ├── avatar/
│           │   │   ├── AvatarRenderer.tsx    # Render SVG en capas desde AvatarConfig
│           │   │   └── AvatarCustomizer.tsx  # Editor simple de avatar
│           │   ├── canvas/
│           │   │   ├── DrawingCanvas.tsx     # Lienzo HTML5 (mouse + touch), undo, clear, colores, grosor
│           │   │   ├── SilhouetteViewer.tsx  # Visor de silueta borrosa de referencia
│           │   │   └── silhouetteGenerator.ts# Generador de imagen silueta/blur (original + blur)
│           │   ├── chat/
│           │   │   └── RoomChat.tsx          # Chat en tiempo real con mensajes del sistema y avatares
│           │   └── game/
│           │       ├── ConceptSubmissionPhase.tsx
│           │       ├── ConceptDrawAnimation.tsx
│           │       ├── TurnWorkspace.tsx     # Sub-fase "¿Qué viste?" + Dibujo en cadenas paralelas
│           │       ├── RevealAndVotePhase.tsx# Revelación de las 3 cadenas una por una + votación
│           │       ├── PodiumPhase.tsx       # Podio final y desglose de puntos
│           │       └── TurnTimer.tsx         # Cronómetro sincronizado con step_ends_at
│           └── lib/
│               ├── supabase/
│               │   ├── client.ts           # createBrowserClient
│               │   ├── server.ts           # createServerClient (cookies)
│               │   ├── admin.ts            # Service role solo en servidor para operaciones atómicas si aplica
│               │   └── middleware.ts       # Refresco de sesión en Next.js middleware
│               └── game/
│                   └── roomClient.ts       # Helpers para Realtime y llamadas a API
├── packages/
│   ├── shared-types/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── avatar.ts
│   │       ├── game.ts
│   │       ├── database.ts
│   │       └── realtime.ts
│   ├── game-engine/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── turnScheduler.ts              # Rotación paralela para 2-8 jugadores
│   │       ├── textMatching.ts               # Normalización y coincidencia para "¿Qué viste?"
│   │       ├── scoring.ts                    # Cálculo de puntos automáticos y votos
│   │       └── __tests__/
│   │           ├── turnScheduler.test.ts
│   │           ├── textMatching.test.ts
│   │           └── scoring.test.ts
│   └── tsconfig/
│       ├── package.json
│       ├── base.json
│       └── nextjs.json
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   └── 001_init_silhouette_telephone.sql
│   └── seed.sql
├── .env.example
├── turbo.json
├── pnpm-workspace.yaml
└── package.json

```

---

## 4. ESQUEMA DE BASE DE DATOS, STORAGE Y RLS (SUPABASE)

En `supabase/migrations/001_init_silhouette_telephone.sql`, define todas las tablas, enums, restricciones de integridad, índices, triggers y políticas **Row Level Security (RLS)**:

### 4.1 Tipos ENUM

* `room_status`: `'LOBBY'`, `'CONCEPT_SUBMISSION'`, `'CONCEPT_DRAW'`, `'PLAYING_TURN'`, `'REVEAL_AND_VOTE'`, `'PODIUM'`
* `turn_subphase`: `'GUESSING'`, `'DRAWING'`
* `blur_intensity`: `'soft'`, `'medium'`, `'extreme'`
* `vote_category`: `'faithful'`, `'funny'`, `'plot_twist'`

### 4.2 Tablas Principales

1. `profiles`
* `id uuid primary key references auth.users(id) on delete cascade`
* `username text not null check (char_length(trim(username)) between 2 and 24)`
* `is_guest boolean not null default false`
* `avatar_config jsonb not null` (estructura validada de capas SVG)
* `total_points integer not null default 0 check (total_points >= 0)`
* `games_played integer not null default 0 check (games_played >= 0)`
* `created_at timestamptz not null default now()`
* `updated_at timestamptz not null default now()`
* *Trigger:* al crearse un usuario en `auth.users`, crear automáticamente su fila en `profiles` con un avatar por defecto y un `username` inicial válido.


2. `rooms`
* `id uuid primary key default gen_random_uuid()`
* `code varchar(6) not null unique`
* `host_id uuid not null references profiles(id)`
* `status room_status not null default 'LOBBY'`
* `turn_subphase turn_subphase not null default 'DRAWING'`
* `round_number integer not null default 1`
* `max_steps integer not null default 4 check (max_steps between 2 and 8)`
* `min_players integer not null default 2 check (min_players = 2)`
* `max_players integer not null default 8 check (max_players = 8)`
* `active_reveal_chain integer not null default 0 check (active_reveal_chain between 0 and 2)`
* `settings jsonb not null` (`conceptSubmissionSeconds`, `guessSeconds`, `drawSeconds`, `blurIntensity`, `conceptsPerPlayer`, `muteChatDuringDraw`)
* `step_ends_at timestamptz`
* `created_at timestamptz not null default now()`
* `updated_at timestamptz not null default now()`


3. `room_players`
* `id uuid primary key default gen_random_uuid()`
* `room_id uuid not null references rooms(id) on delete cascade`
* `user_id uuid not null references profiles(id) on delete cascade`
* `seat_index integer not null`
* `score integer not null default 0`
* `is_ready boolean not null default false`
* `is_connected boolean not null default true`
* `joined_at timestamptz not null default now()`
* `unique (room_id, user_id)`
* *Regla de capacidad:* Trigger o validación en servidor para impedir superar `8` jugadores en `room_players` por `room_id`.


4. `concepts`
* `id uuid primary key default gen_random_uuid()`
* `room_id uuid not null references rooms(id) on delete cascade`
* `round_number integer not null default 1`
* `author_id uuid references profiles(id) on delete set null`
* `text varchar(60) not null`
* `is_selected boolean not null default false`
* `chain_index smallint check (chain_index in (0, 1, 2))`
* `created_at timestamptz not null default now()`


5. `chain_assignments` (o estado por cadena en la ronda activa)
* `id uuid primary key default gen_random_uuid()`
* `room_id uuid not null references rooms(id) on delete cascade`
* `round_number integer not null default 1`
* `chain_index smallint not null check (chain_index in (0, 1, 2))`
* `concept_id uuid not null references concepts(id) on delete cascade`
* `step_number integer not null check (step_number >= 1)`
* `assigned_user_id uuid not null references profiles(id) on delete cascade`
* `guess_text varchar(80)`
* `guess_submitted boolean not null default false`
* `draw_submitted boolean not null default false`
* `created_at timestamptz not null default now()`
* `unique (room_id, round_number, chain_index, step_number)`


6. `chain_steps` (Historial consolidado de pasos completados para revelación y puntuación)
* `id uuid primary key default gen_random_uuid()`
* `room_id uuid not null references rooms(id) on delete cascade`
* `round_number integer not null default 1`
* `chain_index smallint not null check (chain_index in (0, 1, 2))`
* `concept_id uuid not null references concepts(id) on delete cascade`
* `step_number integer not null check (step_number >= 1)`
* `player_id uuid not null references profiles(id) on delete cascade`
* `guess_text varchar(80)`
* `original_image_path text not null`
* `silhouette_image_path text not null`
* `auto_points integer not null default 0`
* `vote_points integer not null default 0`
* `submitted_on_time boolean not null default false`
* `created_at timestamptz not null default now()`
* `unique (room_id, round_number, chain_index, step_number)`


7. `votes`
* `id uuid primary key default gen_random_uuid()`
* `room_id uuid not null references rooms(id) on delete cascade`
* `round_number integer not null default 1`
* `chain_index smallint not null check (chain_index in (0, 1, 2))`
* `voter_id uuid not null references profiles(id) on delete cascade`
* `target_step_id uuid not null references chain_steps(id) on delete cascade`
* `category vote_category not null`
* `created_at timestamptz not null default now()`
* `unique (room_id, round_number, chain_index, voter_id, category)`


8. `room_messages`
* `id uuid primary key default gen_random_uuid()`
* `room_id uuid not null references rooms(id) on delete cascade`
* `user_id uuid references profiles(id) on delete set null`
* `content varchar(280) not null`
* `is_system boolean not null default false`
* `created_at timestamptz not null default now()`



### 4.3 Storage Bucket

* Bucket público o autenticado `drawings` para almacenar `original.png` / `original.webp` y `silhouette.png` / `silhouette.webp` bajo la ruta `{room_id}/{round_number}/chain-{chain_index}/step-{step_number}/{type}.png`.
* Políticas de Storage: usuarios autenticados (incluidos invitados) pueden subir/leer dentro de rutas válidas de sala; `DELETE` restringido.

### 4.4 Políticas RLS

* Habilita `alter table ... enable row level security` en todas las tablas.
* Permite lectura de `profiles` pública (datos no sensibles: `id`, `username`, `is_guest`, `avatar_config`, `total_points`, `games_played`), y escritura de `profiles` solo sobre `auth.uid() = id`.
* Restringe visibilidad y escritura de datos de sala (`rooms`, `room_players`, `concepts`, `chain_assignments`, `chain_steps`, `votes`, `room_messages`) a participantes de la sala o lectura de metadatos necesarios para unirse por código, garantizando que durante `PLAYING_TURN` un jugador no lea respuestas privadas de otros antes de tiempo (o controlando accesos sensibles desde API routes).

---

## 5. EXPERIENCIA DE USUARIO (UI/UX), AVATAR, SILUETAS Y CHAT

### 5.1 Estética y Navegación

* Tema oscuro moderno y vibrante, con alto contraste, tipografía legible, animaciones suaves y layout responsivo (desktop y móvil).
* Flujo claro:
* `/` (Inicio): Crear sala, unirse con código de 6 letras, ver avatar actual o ir a `/auth` y `/profile`.
* `/auth`: Iniciar sesión con correo/contraseña, registrarse o entrar en 1 clic como Invitado (`signInAnonymously()`).
* `/profile`: Personalizar avatar, cambiar nombre visible, ver puntos acumulados y partidas jugadas.
* `/lobby/[code]`: Lista de jugadores (slots 1 a 8), configuración de sala (host), botón de `Listo` / `Iniciar partida` (habilitado con 2 a 8 jugadores), y chat en vivo.
* `/game/[code]`: Vista unificada según `rooms.status` + panel/drawer de chat (`RoomChat`) respetando `muteChatDuringDraw` si aplica.



### 5.2 Personalizador Simple de Avatar (`AvatarCustomizer` + `AvatarRenderer`)

Debe ser rápido, divertido y ligero (SVG puro parametrizado por `AvatarConfig`):

* `skinTone`: 6 opciones (ej. tonos cálidos, neutros, oscuros, fantasía pastel/neón opcional).
* `faceShape`: `'round' | 'oval' | 'square' | 'cat'`
* `eyes`: `'normal' | 'happy' | 'wink' | 'sleepy' | 'wide' | 'cool'`
* `brows`: `'neutral' | 'raised' | 'angry' | 'soft'`
* `mouth`: `'smile' | 'grin' | 'surprised' | 'smirk' | 'cat_smile' | 'neutral'`
* `hairOrTop`: `'none' | 'spiky' | 'bob' | 'curly' | 'cap' | 'beanie' | 'horns' | 'sprout'`
* `bgColor`: 8 colores de fondo para el badge circular del avatar.
* Debe incluir botón **"Aleatorio"** y vista previa en vivo. Al guardar, persiste en `profiles.avatar_config` en Supabase.

### 5.3 Lienzo de Dibujo y Generación de Silueta Borrosa

* `DrawingCanvas`:
* Usa `<canvas>` con escalado `devicePixelRatio` para nitidez en pantallas Retina/móviles.
* Soporta `pointerdown`, `pointermove`, `pointerup`, `pointercancel` (mouse, trackpad, dedo y stylus).
* Herramientas mínimas sólidas: Pincel (`brush`), Borrador (`eraser`), 4 tamaños de trazo (`sm`, `md`, `lg`, `xl`), paleta de al menos 12 colores, `Deshacer` (historial de strokes/snapshots) y `Limpiar`.
* Trackea `hasStrokes: boolean` para saber si el jugador realmente dibujó algo.


* `SilhouetteViewer` y `silhouetteGenerator.ts`:
* Al finalizar el dibujo, se genera la imagen limpia (`originalBlob`) y la imagen silueta borrosa (`silhouetteBlob`).
* El desenfoque debe ocultar detalles finos pero conservar la masa/contorno general: combina desenfoque gaussiano (`blur` según `blurIntensity`: `'soft'` ~ `8px`, `'medium'` ~ `15px`, `'extreme'` ~ `24px`), ajuste de contraste/saturación y/o silueta oscura/difuminada sobre fondo limpio para que al siguiente jugador le resulte sugerente pero ambiguo.
* En `TurnWorkspace`, durante `GUESSING` (`step > 1`), el jugador solo ve la silueta borrosa y el campo *"¿Qué viste?"*. Durante `DRAWING` (`step > 1`), ve la silueta borrosa de referencia y dibuja su interpretación.



### 5.4 Chat en Tiempo Real (`RoomChat`)

* Muestra mensajes de los jugadores de la sala (con `AvatarRenderer` pequeño, `username`, hora y texto) y mensajes del sistema (`is_system = true`).
* Envíos vía `POST /api/chat/send` (validando longitud y pertenencia a la sala) y actualización instantánea vía Supabase Realtime (`INSERT` en `room_messages` + broadcast opcional).
* Incluye límite anti-spam básico (ej. máximo 1 mensaje cada 1.2s por usuario y máximo 280 caracteres).

---

## 6. CONTRATOS DE API Y SEGURIDAD

Implementa los endpoints bajo `apps/web/src/app/api/**` validando sesión de Supabase en cada petición:

1. `GET /api/health` -> Devuelve `200 { ok: true, timestamp }`.
2. `POST /api/rooms/create` -> Crea sala (2–8 jugadores, código único de 6 chars), agrega al creador como `host` y primer jugador en `room_players`, emite mensaje de sistema al chat.
3. `POST /api/rooms/join` -> Une al usuario autenticado/invitado a la sala por `code` si `status === 'LOBBY'` y `currentPlayers < 8` (o reconecta si ya estaba en `room_players`).
4. `POST /api/rooms/[code]/start` -> Verifica que el solicitante sea `host_id`, que haya entre `2` y `8` jugadores y que `status === 'LOBBY'`. Transiciona a `CONCEPT_SUBMISSION` con `step_ends_at`.
5. `POST /api/rooms/[code]/tick` -> Endpoint idempotente para avanzar fases cuando expira `step_ends_at` o cuando todos completan la sub-fase actual:
* `CONCEPT_SUBMISSION` expirado $\rightarrow$ rellena conceptos faltantes desde seed si aplica, sortea **3 conceptos**, crea asignaciones del Turno 1 en paralelo y pasa a `PLAYING_TURN` (`turn_subphase = 'DRAWING'`).
* `PLAYING_TURN` (`GUESSING`) expirado o todos enviaron adivinanza $\rightarrow$ pasa a `PLAYING_TURN` (`turn_subphase = 'DRAWING'`).
* `PLAYING_TURN` (`DRAWING`) expirado o todos enviaron dibujo de la ronda de turnos actual $\rightarrow$ si quedan pasos por cadena, genera asignaciones del siguiente paso en paralelo y pasa a `GUESSING` (o `DRAWING` si no hay adivinanza); si ya se completaron todos los pasos, pasa a `REVEAL_AND_VOTE` (`active_reveal_chain = 0`).
* `REVEAL_AND_VOTE` expirado $\rightarrow$ avanza `active_reveal_chain` (`0 -> 1 -> 2`), y tras la cadena `2` consolida puntos de votación, actualiza `profiles.total_points` y `profiles.games_played`, y pasa a `PODIUM`.


6. `POST /api/concepts/submit` -> Guarda el/los conceptos del jugador en `concepts` durante `CONCEPT_SUBMISSION`.
7. `POST /api/turns/guess` -> Guarda `guess_text` y marca `guess_submitted = true` en `chain_assignments` para el turno del jugador.
8. `POST /api/turns/draw` -> Recibe `original` y `silhouette` (o `FormData` / base64 validado), sube ambos archivos al bucket `drawings` de Supabase Storage, inserta/actualiza `chain_steps`, evalúa coincidencia de `guess_text` con concepto original y con respuesta anterior + bonificación de entrega a tiempo (`+25`), suma puntos automáticos y marca `draw_submitted = true`.
9. `POST /api/votes/submit` -> Registra votos del jugador para `faithful`, `funny` y `plot_twist` en la cadena revelada actual.
10. `POST /api/chat/send` -> Inserta mensaje en `room_messages` tras validar sesión, pertenencia a la sala, longitud y regla de `muteChatDuringDraw` si aplica.

---

## 7. VARIABLES DE ENTORNO Y CONFIGURACIÓN DE VERCEL

Crea `.env.example` con todas las variables necesarias (sin secretos reales):

```env
NEXT_PUBLIC_SUPABASE_URL=[https://tu-proyecto.supabase.co](https://tu-proyecto.supabase.co)
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000

```

Asegúrate de que:

* `pnpm --filter @silhouette/game-engine test` (o `pnpm test`) ejecute pruebas unitarias reales cubriendo:
* Rotación paralela con `2` jugadores, `3` jugadores, `4` jugadores y `8` jugadores.
* Coincidencias y normalización en "¿Qué viste?".
* Cálculo de puntajes automáticos y votos.


* `pnpm --filter web build` (o `pnpm build`) compile TypeScript y Next.js sin errores para despliegue directo en Vercel.
* Incluye en tu entrega final una sección clara de **Despliegue en Vercel + Supabase** (pasos exactos para crear proyecto en Supabase, ejecutar migración SQL + seed, habilitar Anonymous Auth y Realtime, configurar variables en Vercel y desplegar el monorepo).

---

## 8. INSTRUCCIONES DE EJECUCIÓN PARA EL AGENTE

Construye el monorepo completo de forma sistemática, archivo por archivo, asegurando coherencia total de tipos entre `packages/shared-types`, `packages/game-engine`, `supabase/migrations/001_init_silhouette_telephone.sql` y `apps/web`. No dejes importaciones rotas, hooks incompletos ni endpoints simulados. Comienza generando la estructura base del monorepo, paquetes compartidos, migración SQL y seed, y continúa hasta completar toda la aplicación web y la guía de despliegue.

```

```