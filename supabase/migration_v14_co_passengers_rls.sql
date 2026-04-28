-- Migration v14 : un passager accepté peut voir les co-passagers acceptés
-- du même trajet_instance (pour afficher l'itinéraire avec tous les pickups).

drop policy if exists "passager voit co-passagers" on reservations;
create policy "passager voit co-passagers" on reservations
  for select using (
    statut = 'accepted'
    and exists (
      select 1 from reservations r2
      where r2.trajet_instance_id = reservations.trajet_instance_id
        and r2.passager_id = auth.uid()
        and r2.statut = 'accepted'
    )
  );
