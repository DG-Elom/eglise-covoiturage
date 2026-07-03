-- Destination optionnelle par programme.
-- Historiquement, tous les trajets pointent vers l'unique église (table `eglise`).
-- Ces colonnes permettent qu'un programme (culte décentralisé, convention, sortie…)
-- ait sa propre destination. Si null → fallback sur l'église globale.
alter table public.cultes
  add column if not exists destination_adresse text,
  add column if not exists destination_position geography(Point, 4326);
