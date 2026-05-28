-- =============================================================================
-- Migration v40 — Security: ajoute WITH CHECK à la policy conducteur
-- Context: audit 2026-05-29 — la policy "conducteur traite résa" (schema.sql)
--          n'avait pas de clause WITH CHECK. Sans WITH CHECK, la clause USING
--          était réutilisée comme check sur la nouvelle ligne : elle validait
--          seulement l'appartenance du trajet au conducteur, jamais la valeur
--          de `statut`. Un conducteur pouvait écrire un statut arbitraire
--          (ex : 'completed' sur une résa encore pending).
--
-- Correctif : on restreint les valeurs de statut inscriptibles par le conducteur
-- aux transitions légitimes :
--   accepted  — acceptation d'une demande pending
--   refused   — refus d'une demande pending
--   cancelled — annulation (ex : trajet supprimé)
--   pending   — remise en attente (revert)
--   completed — marquage trajet effectué
--   no_show   — passager absent
--
-- Style idempotent : DROP IF EXISTS + CREATE.
-- NE PAS APPLIQUER manuellement — passer par la procédure de migration du projet.
-- =============================================================================

DROP POLICY IF EXISTS "conducteur traite résa" ON reservations;

CREATE POLICY "conducteur traite résa" ON reservations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM trajets_instances ti
      JOIN trajets t ON t.id = ti.trajet_id
      WHERE ti.id = reservations.trajet_instance_id
        AND t.conducteur_id = auth.uid()
    )
  )
  WITH CHECK (
    statut IN ('accepted', 'refused', 'cancelled', 'pending', 'completed', 'no_show')
    AND EXISTS (
      SELECT 1
      FROM trajets_instances ti
      JOIN trajets t ON t.id = ti.trajet_id
      WHERE ti.id = reservations.trajet_instance_id
        AND t.conducteur_id = auth.uid()
    )
  );
