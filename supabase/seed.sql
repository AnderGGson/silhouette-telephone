-- =============================================================================
-- Silhouette Telephone — Seed
-- Banco de conceptos por defecto usado por el servidor cuando, al expirar
-- CONCEPT_SUBMISSION, algún jugador no completó su cuota de conceptos
-- (ver POST /api/rooms/[code]/tick). Estos NO se insertan en `public.concepts`
-- (esa tabla es por-sala); viven en una tabla de banco aparte que la API
-- consulta para autocompletar.
-- =============================================================================

create table if not exists public.default_concept_bank (
  id uuid primary key default gen_random_uuid(),
  text varchar(60) not null unique,
  created_at timestamptz not null default now()
);

alter table public.default_concept_bank enable row level security;

-- Banco de lectura pública (no contiene datos de usuario); sin políticas de
-- escritura porque solo se gestiona por migraciones/seed o el rol de servicio.
create policy default_concept_bank_select_all on public.default_concept_bank
  for select using (true);

insert into public.default_concept_bank (text) values
  ('Un gato astronauta'),
  ('Pulpo tocando guitarra'),
  ('Robot regando plantas'),
  ('Dinosaurio en patineta'),
  ('Fantasma lavando platos'),
  ('Pingüino en la playa'),
  ('Dragón tomando café'),
  ('Unicornio en el metro'),
  ('Tiburón con paraguas'),
  ('Momia bailando salsa'),
  ('Alien pidiendo pizza'),
  ('Sirena montando bicicleta'),
  ('Vampiro haciendo yoga'),
  ('Oso panda programando'),
  ('Jirafa jugando ajedrez'),
  ('Zombi paseando perro'),
  ('Caballero sacando la basura'),
  ('Bruja en el supermercado'),
  ('Rana con sombrero de copa'),
  ('Elefante surfeando'),
  ('Búho piloteando avión'),
  ('Conejo mecánico de autos'),
  ('Pato detective'),
  ('León tocando el violín'),
  ('Ardilla astronauta'),
  ('Cangrejo DJ en una fiesta'),
  ('Lobo repartiendo correo'),
  ('Koala en bote de remos'),
  ('Serpiente tejiendo bufanda'),
  ('Erizo patinando sobre hielo'),
  ('Camaleón de incógnito'),
  ('Flamenco haciendo yoga'),
  ('Hipopótamo en ballet'),
  ('Murciélago leyendo un libro'),
  ('Cebra pintando un cuadro'),
  ('Topo manejando un submarino'),
  ('Loro presentador de noticias'),
  ('Tortuga en carrera de autos'),
  ('Mapache robando un pastel'),
  ('Delfín jugando basquetbol')
on conflict (text) do nothing;
