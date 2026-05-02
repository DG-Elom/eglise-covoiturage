-- Migration v28 — Nettoyage des abonnements avec position GPS [0,0] (bug null island)
-- Idempotente : peut être relancée sans effet si déjà appliquée.
--
-- Compte d'abord pour mesurer l'impact :
-- SELECT count(*) FROM subscriptions
-- WHERE st_x(pickup_position::geometry) BETWEEN -0.01 AND 0.01
--   AND st_y(pickup_position::geometry) BETWEEN -0.01 AND 0.01;

DO $$
DECLARE
  nb_deleted integer;
BEGIN
  DELETE FROM subscriptions
  WHERE st_x(pickup_position::geometry) BETWEEN -0.01 AND 0.01
    AND st_y(pickup_position::geometry) BETWEEN -0.01 AND 0.01;

  GET DIAGNOSTICS nb_deleted = ROW_COUNT;
  RAISE NOTICE '[v28] % abonnement(s) supprimé(s) (position GPS [0,0] — bug null island)', nb_deleted;
END;
$$;
