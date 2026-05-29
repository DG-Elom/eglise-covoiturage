-- Extensions requises par le schéma (le dump --schema public ne les inclut pas).
-- Doit s'appliquer AVANT le dump remote (geography/uuid_generate_v4).
create extension if not exists "postgis" with schema "public";
create extension if not exists "uuid-ossp" with schema "public";
create extension if not exists "pg_trgm" with schema "public";
