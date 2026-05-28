-- v39 — Garde-fou : empêche un passager d'auto-accepter sa réservation.
--
-- Contexte : la policy "passager update résa" (schema.sql) autorisait l'UPDATE
-- sur les réservations dont passager_id = auth.uid(), MAIS sans clause WITH CHECK.
-- Sous Postgres, en l'absence de WITH CHECK sur un FOR UPDATE, la clause USING
-- sert de check sur la nouvelle ligne : elle valide seulement passager_id, jamais
-- la valeur de `statut`. Un passager pouvait donc, via le client Supabase direct,
-- exécuter `update({ statut: 'accepted' })` sur sa propre résa 'pending' et se
-- réserver une place sans l'accord du conducteur (le trigger v37 ne vérifie que
-- la capacité, pas l'identité de l'acteur).
--
-- Correctif : on ajoute un WITH CHECK qui restreint les statuts qu'un passager
-- peut écrire à ('pending', 'cancelled') — les seules transitions légitimes côté
-- passager (re-demande -> pending, annulation -> cancelled). Les transitions vers
-- accepted/refused/completed/no_show restent réservées au conducteur (policy
-- "conducteur traite résa") et à l'admin, qui passent par leurs propres policies.
-- Les opérations cross-instance (api/reservations/[id]/accept) utilisent le client
-- service_role, qui bypasse RLS : ce correctif ne les affecte pas.

drop policy if exists "passager update résa" on reservations;
create policy "passager update résa" on reservations
  for update
  using (passager_id = auth.uid())
  with check (
    passager_id = auth.uid()
    and statut in ('pending', 'cancelled')
  );
