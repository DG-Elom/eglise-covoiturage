-- Migration v12 : admin RLS policies (CRUD complet sur toutes les tables)
-- Sans ces policies, l'admin ne peut pas gérer les trajets, instances,
-- réservations et messages des autres utilisateurs.

drop policy if exists "admin gère trajets" on trajets;
create policy "admin gère trajets" on trajets
  for all using (is_admin()) with check (is_admin());

drop policy if exists "admin gère instances" on trajets_instances;
create policy "admin gère instances" on trajets_instances
  for all using (is_admin()) with check (is_admin());

drop policy if exists "admin voit toutes les réservations" on reservations;
create policy "admin voit toutes les réservations" on reservations
  for select using (is_admin());

drop policy if exists "admin gère réservations" on reservations;
create policy "admin gère réservations" on reservations
  for all using (is_admin()) with check (is_admin());

drop policy if exists "admin voit tous les messages" on messages;
create policy "admin voit tous les messages" on messages
  for select using (is_admin());

drop policy if exists "admin gère messages" on messages;
create policy "admin gère messages" on messages
  for all using (is_admin()) with check (is_admin());
