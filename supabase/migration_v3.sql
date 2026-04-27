-- ============================================================
-- Migration v3 — Le conducteur choisit ses dates explicitement
-- À exécuter dans Supabase SQL Editor
-- ============================================================

-- Supprime le trigger d'auto-génération : c'est désormais
-- le formulaire qui insère les instances pour les dates choisies.
drop trigger if exists trg_generer_instances_on_insert on trajets;
drop function if exists generer_instances_pour_trajet();

-- Optionnel : nettoyer les instances futures qui auraient été
-- créées par l'ancien trigger pour des trajets déjà existants.
-- Décommenter pour exécuter :
-- delete from trajets_instances where date >= current_date;
