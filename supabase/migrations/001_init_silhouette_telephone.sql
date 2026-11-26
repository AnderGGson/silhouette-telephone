-- =============================================================================
-- Silhouette Telephone — Migración inicial
-- Enums, tablas, integridad, índices, triggers, RLS y políticas de Storage.
-- =============================================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- -----------------------------------------------------------------------------
-- 1. ENUMS
-- -----------------------------------------------------------------------------

create type room_status as enum (
  'LOBBY',
  'CONCEPT_SUBMISSION',
  'CONCEPT_DRAW',
  'PLAYING_TURN',
  'REVEAL_AND_VOTE',
  'PODIUM'
);

create type turn_subphase as enum ('GUESSING', 'DRAWING');

create type blur_intensity as enum ('soft', 'medium', 'extreme');

create type vote_category as enum ('faithful', 'funny', 'plot_twist');

-- -----------------------------------------------------------------------------
-- 2. FUNCIONES DE UTILIDAD (declaradas antes de los triggers que las usan)
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Código de sala de 6 caracteres sin ambiguos (sin 0/O, 1/I/L).
create or replace function public.generate_room_code()
returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text := '';
  i integer;
begin
  for i in 1..6 loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return result;
end;
$$;

-- Genera un código y reintenta hasta encontrar uno libre (uso recomendado desde la API,
-- bajo un intento con reintento por si choca con el unique de rooms.code).
create or replace function public.generate_unique_room_code()
returns text
language plpgsql
as $$
declare
  candidate text;
  exists_already boolean;
begin
  loop
    candidate := public.generate_room_code();
    select exists(select 1 from public.rooms r where r.code = candidate) into exists_already;
    exit when not exists_already;
  end loop;
  return candidate;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. TABLAS
-- -----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (char_length(trim(username)) between 2 and 24),
  is_guest boolean not null default false,
  avatar_config jsonb not null,
  total_points integer not null default 0 check (total_points >= 0),
  games_played integer not null default 0 check (games_played >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code varchar(6) not null unique,
  host_id uuid not null references public.profiles(id),
  status room_status not null default 'LOBBY',
  turn_subphase turn_subphase not null default 'DRAWING',
  round_number integer not null default 1,
  max_steps integer not null default 4 check (max_steps between 2 and 8),
  min_players integer not null default 2 check (min_players = 2),
  max_players integer not null default 8 check (max_players = 8),
  active_reveal_chain integer not null default 0 check (active_reveal_chain between 0 and 2),
  settings jsonb not null,
  step_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rooms_code_idx on public.rooms (code);
create index rooms_status_idx on public.rooms (status);

create trigger rooms_set_updated_at
  before update on public.rooms
  for each row execute function public.set_updated_at();

create table public.room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  seat_index integer not null,
  score integer not null default 0,
  is_ready boolean not null default false,
  is_connected boolean not null default true,
  joined_at timestamptz not null default now(),
  unique (room_id, user_id)
);

create index room_players_room_id_idx on public.room_players (room_id);

-- Regla de capacidad: nunca más de 8 jugadores activos/reservados por sala.
create or replace function public.enforce_room_player_capacity()
returns trigger
language plpgsql
as $$
declare
  current_count integer;
begin
  select count(*) into current_count
  from public.room_players
  where room_id = new.room_id;

  if current_count >= 8 then
    raise exception 'La sala ya tiene el máximo de 8 jugadores' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger room_players_capacity_check
  before insert on public.room_players
  for each row execute function public.enforce_room_player_capacity();

create table public.concepts (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  round_number integer not null default 1,
  author_id uuid references public.profiles(id) on delete set null,
  text varchar(60) not null check (char_length(trim(text)) between 2 and 60),
  is_selected boolean not null default false,
  chain_index smallint check (chain_index in (0, 1, 2)),
  created_at timestamptz not null default now()
);

create index concepts_room_round_idx on public.concepts (room_id, round_number);

-- Evita conceptos duplicados (texto exacto normalizado) dentro de la misma sala/ronda.
create unique index concepts_no_duplicates_idx
  on public.concepts (room_id, round_number, lower(trim(text)));

create table public.chain_assignments (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  round_number integer not null default 1,
  chain_index smallint not null check (chain_index in (0, 1, 2)),
  concept_id uuid not null references public.concepts(id) on delete cascade,
  step_number integer not null check (step_number >= 1),
  assigned_user_id uuid not null references public.profiles(id) on delete cascade,
  guess_text varchar(80),
  guess_submitted boolean not null default false,
  draw_submitted boolean not null default false,
  created_at timestamptz not null default now(),
  unique (room_id, round_number, chain_index, step_number)
);

create index chain_assignments_room_round_idx
  on public.chain_assignments (room_id, round_number, chain_index);

create table public.chain_steps (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  round_number integer not null default 1,
  chain_index smallint not null check (chain_index in (0, 1, 2)),
  concept_id uuid not null references public.concepts(id) on delete cascade,
  step_number integer not null check (step_number >= 1),
  player_id uuid not null references public.profiles(id) on delete cascade,
  guess_text varchar(80),
  original_image_path text not null,
  silhouette_image_path text not null,
  auto_points integer not null default 0,
  vote_points integer not null default 0,
  submitted_on_time boolean not null default false,
  created_at timestamptz not null default now(),
  unique (room_id, round_number, chain_index, step_number)
);

create index chain_steps_room_round_idx on public.chain_steps (room_id, round_number);
create index chain_steps_player_idx on public.chain_steps (player_id);

create table public.votes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  round_number integer not null default 1,
  chain_index smallint not null check (chain_index in (0, 1, 2)),
  voter_id uuid not null references public.profiles(id) on delete cascade,
  target_step_id uuid not null references public.chain_steps(id) on delete cascade,
  category vote_category not null,
  created_at timestamptz not null default now(),
  unique (room_id, round_number, chain_index, voter_id, category)
);

create index votes_room_round_chain_idx on public.votes (room_id, round_number, chain_index);
create index votes_target_step_idx on public.votes (target_step_id);

create table public.room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  content varchar(280) not null check (char_length(trim(content)) >= 1),
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create index room_messages_room_created_idx on public.room_messages (room_id, created_at);

-- -----------------------------------------------------------------------------
-- 4. TRIGGER: crear profile automáticamente al registrarse en auth.users
-- -----------------------------------------------------------------------------

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_avatar jsonb := '{
    "skinTone": "tan",
    "faceShape": "round",
    "eyes": "happy",
    "brows": "neutral",
    "mouth": "smile",
    "hairOrTop": "spiky",
    "bgColor": "#E8FF47"
  }'::jsonb;
  base_username text;
begin
  base_username := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    'Jugador-' || substr(new.id::text, 1, 6)
  );

  insert into public.profiles (id, username, is_guest, avatar_config)
  values (
    new.id,
    left(base_username, 24),
    coalesce((new.raw_user_meta_data ->> 'is_guest')::boolean, new.is_anonymous, false),
    default_avatar
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- -----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.concepts enable row level security;
alter table public.chain_assignments enable row level security;
alter table public.chain_steps enable row level security;
alter table public.votes enable row level security;
alter table public.room_messages enable row level security;

-- Helper: ¿auth.uid() participa en esta sala? (SECURITY DEFINER para evitar
-- recursión de RLS entre room_players y las tablas que dependen de ella)
create or replace function public.is_room_participant(p_room_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.room_players rp
    where rp.room_id = p_room_id and rp.user_id = auth.uid()
  );
$$;

create or replace function public.is_room_host(p_room_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.rooms r
    where r.id = p_room_id and r.host_id = auth.uid()
  );
$$;

-- --- profiles ---
-- Ninguna columna de profiles es sensible (el email vive en auth.users, no aquí),
-- así que la lectura pública completa es segura; la escritura se restringe al dueño.
create policy profiles_select_all on public.profiles
  for select using (true);

create policy profiles_insert_own on public.profiles
  for insert with check (auth.uid() = id);

create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- --- rooms ---
-- Conocer el código de 6 caracteres ya es la barrera de acceso para unirse,
-- por lo que cualquier usuario autenticado puede leer metadatos de sala para
-- validar un código antes de unirse. Solo el host puede modificarla
-- directamente (la mayoría de transiciones de estado las hace la API con
-- el rol de servicio dentro de una transacción validada).
create policy rooms_select_authenticated on public.rooms
  for select using (auth.role() = 'authenticated');

create policy rooms_insert_as_host on public.rooms
  for insert with check (auth.uid() = host_id);

create policy rooms_update_host_only on public.rooms
  for update using (public.is_room_host(id)) with check (public.is_room_host(id));

-- --- room_players ---
create policy room_players_select_participants on public.room_players
  for select using (public.is_room_participant(room_id));

create policy room_players_insert_self on public.room_players
  for insert with check (auth.uid() = user_id);

create policy room_players_update_self_or_host on public.room_players
  for update using (auth.uid() = user_id or public.is_room_host(room_id))
  with check (auth.uid() = user_id or public.is_room_host(room_id));

-- --- concepts ---
-- Antes del sorteo, un jugador solo puede ver sus propios conceptos (para no
-- spoilear el pool a los demás). Una vez sorteados (is_selected = true) son
-- visibles para toda la sala, porque pasan a ser parte pública de la partida.
create policy concepts_select_own_or_selected on public.concepts
  for select using (
    public.is_room_participant(room_id)
    and (author_id = auth.uid() or is_selected = true)
  );

create policy concepts_insert_own on public.concepts
  for insert with check (
    public.is_room_participant(room_id) and author_id = auth.uid()
  );

-- --- chain_assignments ---
-- Estado "en vivo" de un turno: guess_text es la respuesta privada de
-- "¿Qué viste?" y no debe ser legible por otros jugadores mientras el turno
-- está en curso. Solo el jugador asignado puede leer/escribir su propia fila;
-- la API (con rol de servicio) genera las filas de la ronda para todos.
create policy chain_assignments_select_own on public.chain_assignments
  for select using (assigned_user_id = auth.uid());

create policy chain_assignments_update_own on public.chain_assignments
  for update using (assigned_user_id = auth.uid())
  with check (assigned_user_id = auth.uid());

-- --- chain_steps ---
-- Historial consolidado: una vez completado un paso, es material de
-- revelación pública para toda la sala.
create policy chain_steps_select_participants on public.chain_steps
  for select using (public.is_room_participant(room_id));

create policy chain_steps_insert_own on public.chain_steps
  for insert with check (
    public.is_room_participant(room_id) and player_id = auth.uid()
  );

-- --- votes ---
create policy votes_select_participants on public.votes
  for select using (public.is_room_participant(room_id));

create policy votes_insert_own on public.votes
  for insert with check (
    public.is_room_participant(room_id) and voter_id = auth.uid()
  );

-- --- room_messages ---
create policy room_messages_select_participants on public.room_messages
  for select using (public.is_room_participant(room_id));

create policy room_messages_insert_participants on public.room_messages
  for insert with check (
    public.is_room_participant(room_id)
    and (is_system = false and user_id = auth.uid())
  );

-- -----------------------------------------------------------------------------
-- 6. STORAGE: bucket `drawings`
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('drawings', 'drawings', true)
on conflict (id) do nothing;

-- Rutas con forma: {room_id}/{round_number}/chain-{chain_index}/step-{step_number}/{type}.png
-- storage.foldername(name) devuelve el arreglo de segmentos de carpeta; el primero es room_id.
create policy drawings_read_participants on storage.objects
  for select using (
    bucket_id = 'drawings'
    and public.is_room_participant(((storage.foldername(name))[1])::uuid)
  );

create policy drawings_insert_participants on storage.objects
  for insert with check (
    bucket_id = 'drawings'
    and public.is_room_participant(((storage.foldername(name))[1])::uuid)
  );

-- DELETE restringido: nadie borra dibujos vía API pública (solo el rol de servicio,
-- que no pasa por RLS, para tareas de limpieza/moderación).
