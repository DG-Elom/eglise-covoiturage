-- Migration v14b : remplace la policy v14 récursive par une fonction
-- SECURITY DEFINER qui évite la récursion RLS sur reservations.

create or replace function user_has_accepted_on_instance(p_instance uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from reservations
    where trajet_instance_id = p_instance
      and passager_id = auth.uid()
      and statut = 'accepted'
  );
$$;

drop policy if exists "passager voit co-passagers" on reservations;
create policy "passager voit co-passagers" on reservations
  for select using (
    statut = 'accepted'
    and user_has_accepted_on_instance(trajet_instance_id)
  );
