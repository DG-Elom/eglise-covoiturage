-- Migration v19 : policy DELETE pour la table thanks
-- Seul l'auteur peut supprimer son propre thanks.

drop policy if exists "auteur supprime ses thanks" on thanks;
create policy "auteur supprime ses thanks" on thanks
  for delete
  using (auteur_id = auth.uid());
