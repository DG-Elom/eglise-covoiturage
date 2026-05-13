-- v37: augmenter la limite rayon_detour_km de 5.0 à 10.0 km
ALTER TABLE trajets DROP CONSTRAINT trajets_rayon_detour_km_check;
ALTER TABLE trajets ADD CONSTRAINT trajets_rayon_detour_km_check
  CHECK (rayon_detour_km BETWEEN 0.5 AND 10.0);
