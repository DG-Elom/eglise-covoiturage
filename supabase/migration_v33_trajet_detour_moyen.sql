-- Migration v33 : fonction PostGIS pour le détour moyen par trajet
-- Idempotente (create or replace)
-- Retourne null si aucune réservation accepted/completed ou si les colonnes géo sont absentes.

create or replace function trajet_detour_moyen_km(p_trajet_id uuid)
returns numeric
language sql
stable
as $$
  select round(
    avg(st_distance(t.trajet_ligne, r.pickup_position) / 1000.0)::numeric,
    2
  )
  from trajets t
  join trajets_instances ti on ti.trajet_id = t.id
  join reservations r on r.trajet_instance_id = ti.id
  where t.id = p_trajet_id
    and t.trajet_ligne is not null
    and r.pickup_position is not null
    and r.statut in ('accepted', 'completed');
$$;

-- Test manuel (à exécuter contre un trajet réel en prod) :
-- select trajet_detour_moyen_km('<trajet_id_avec_resas_acceptees>');
-- Attendu : valeur numeric > 0 et < 100 (km), ou null si aucune résa accepted/completed avec pickup_position renseigné.
