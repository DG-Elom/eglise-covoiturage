-- ============================================================
-- v31 — Expose lat/lng sur saved_places via colonnes générées
-- Permet au client de récupérer les coordonnées sans parser
-- la geography (fix bug "raccourci -> Null Island").
-- Idempotent.
-- ============================================================

alter table saved_places
  add column if not exists lat double precision generated always as (
    st_y(position::geometry)
  ) stored;

alter table saved_places
  add column if not exists lng double precision generated always as (
    st_x(position::geometry)
  ) stored;

create index if not exists idx_saved_places_lat_lng on saved_places(lat, lng);
