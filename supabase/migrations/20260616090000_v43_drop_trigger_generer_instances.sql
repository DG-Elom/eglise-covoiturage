-- ============================================================
-- Migration v43 — Suppression du trigger d'auto-génération d'instances
-- IDEMPOTENTE : peut être relancée sans risque
-- ============================================================
--
-- CONTEXTE :
--   v2  a créé le trigger trg_generer_instances_on_insert (auto-matérialisation).
--   v3  l'a VOLONTAIREMENT supprimé : « désormais c'est le formulaire qui
--       insère les instances pour les dates choisies ».
--   v42 l'a RESSUSCITÉ par erreur (croyant qu'il existait encore).
--
-- CONSÉQUENCE de v42 :
--   À la création d'un trajet, le trigger insère les instances (on conflict
--   do nothing), PUIS le formulaire ré-insère les mêmes (trajet_id, date)
--   SANS on conflict → "duplicate key value violates unique constraint
--   trajets_instances_trajet_id_date_key". Casse aussi la sélection de dates
--   (le trigger génère tout le créneau de 30 jours en ignorant les cases
--   cochées par le conducteur).
--
-- FIX : rejouer la décision de v3. Le formulaire est seul maître des dates.
--   Les instances déjà créées ne sont pas touchées.
--   Le cron generer_trajets_instances() n'est pas concerné (il a on conflict).
--
-- ROLLBACK : ré-appliquer v42 (sections 7 et 8).
-- ============================================================

drop trigger if exists trg_generer_instances_on_insert on trajets;
drop function if exists generer_instances_pour_trajet();
