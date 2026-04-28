-- Migration v13 : tables pour saved_places, trip_ratings, driver_availability
-- (features inspirées Bolt/Uber)

-- =================== SAVED PLACES ===================
create table if not exists saved_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  label text not null,
  icon text default 'pin',
  adresse text not null,
  position geography(point) not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_saved_places_user on saved_places(user_id);
alter table saved_places enable row level security;

drop policy if exists "saved_places owner" on saved_places;
create policy "saved_places owner" on saved_places
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "saved_places admin" on saved_places;
create policy "saved_places admin" on saved_places
  for all using (is_admin()) with check (is_admin());

-- =================== TRIP RATINGS ===================
create table if not exists trip_ratings (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations(id) on delete cascade,
  rater_id uuid not null references profiles(id) on delete cascade,
  rated_id uuid not null references profiles(id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  comment text check (length(comment) <= 500),
  created_at timestamptz not null default now(),
  unique (reservation_id, rater_id)
);
create index if not exists idx_trip_ratings_rated on trip_ratings(rated_id);
alter table trip_ratings enable row level security;

drop policy if exists "trip_ratings rater" on trip_ratings;
create policy "trip_ratings rater" on trip_ratings
  for all using (rater_id = auth.uid()) with check (rater_id = auth.uid());

drop policy if exists "trip_ratings rated lit" on trip_ratings;
create policy "trip_ratings rated lit" on trip_ratings
  for select using (rated_id = auth.uid());

drop policy if exists "trip_ratings public lit" on trip_ratings;
create policy "trip_ratings public lit" on trip_ratings
  for select using (true);

drop policy if exists "trip_ratings admin" on trip_ratings;
create policy "trip_ratings admin" on trip_ratings
  for all using (is_admin()) with check (is_admin());

-- =================== DRIVER AVAILABILITY ===================
-- Toggle "je suis dispo le dimanche matin sans avoir créé de trajet précis"
alter table profiles
  add column if not exists available_now boolean not null default false,
  add column if not exists available_until timestamptz;

-- =================== EMERGENCY CONTACT ===================
alter table profiles
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text;
