-- v44 : le refus automatique « trajet complet » ne compte plus que les places
-- réellement ACCEPTÉES.
--
-- Bug : auto_refuse_when_full() utilisait instance_places_restantes(), qui
-- décompte accepted + pending. Comme check_instance_capacity empêche déjà
-- d'avoir plus de résa actives (accepted + pending) que de places, la première
-- acceptation sur un trajet « plein de demandes » refusait toutes les autres
-- demandes en attente, alors qu'elles occupaient justement les places libres.
-- Ex. constaté le 19/11/26 : 3 places, 2 acceptées, 1 demande refusée
-- « trajet_complet_auto ».
--
-- instance_places_restantes() reste inchangée : elle sert aux gardes
-- d'insertion (on ne réserve pas une place déjà demandée par quelqu'un).

create or replace function public.auto_refuse_when_full()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_places int;
  v_acceptees int;
begin
  if NEW.statut = 'accepted' and OLD.statut <> 'accepted' then
    select t.places_total into v_places
    from trajets_instances ti
    join trajets t on t.id = ti.trajet_id
    where ti.id = NEW.trajet_instance_id;

    select count(*) into v_acceptees
    from reservations r
    where r.trajet_instance_id = NEW.trajet_instance_id
      and r.statut = 'accepted';

    if v_places is not null and v_acceptees >= v_places then
      update reservations
      set statut = 'refused',
          motif_refus = 'trajet_complet_auto',
          traitee_le = now()
      where trajet_instance_id = NEW.trajet_instance_id
        and statut = 'pending'
        and id <> NEW.id;
    end if;
  end if;
  return NEW;
end;
$$;
