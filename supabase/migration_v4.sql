-- ============================================================
-- Migration v4 — Heure de départ du conducteur (fenêtre 30 min)
-- À exécuter dans Supabase SQL Editor
-- ============================================================

-- 1) Nouvelle colonne sur trajets
alter table trajets
  add column if not exists heure_depart time not null default '08:00';

-- 2) Drop puis recreate la fonction (changement de return type)
drop function if exists trajets_compatibles(
  double precision, double precision, uuid, sens_reservation, date
);

create function trajets_compatibles(
  p_passager_lat float,
  p_passager_lng float,
  p_culte_id uuid,
  p_sens sens_reservation,
  p_date date
)
returns table (
  trajet_id uuid,
  trajet_instance_id uuid,
  conducteur_id uuid,
  conducteur_prenom text,
  depart_adresse text,
  heure_depart time,
  places_restantes int,
  detour_km numeric,
  score numeric,
  dans_zone boolean
) as $$
declare
  pos_passager geography;
begin
  pos_passager := st_makepoint(p_passager_lng, p_passager_lat)::geography;
  return query
  with instances as (
    select ti.id as instance_id, t.*
    from trajets t
    join trajets_instances ti on ti.trajet_id = t.id
    where t.actif = true
      and t.culte_id = p_culte_id
      and (t.sens::text = p_sens::text or t.sens = 'aller_retour')
      and ti.date = p_date
      and ti.annule_par_conducteur = false
  ),
  reservees as (
    select r.trajet_instance_id as ti_id, count(*) as occupees
    from reservations r
    where r.statut = 'accepted'
    group by r.trajet_instance_id
  )
  select
    i.id, i.instance_id, i.conducteur_id, p.prenom, i.depart_adresse,
    i.heure_depart,
    (i.places_total - coalesce(rv.occupees, 0))::int,
    round((st_distance(i.trajet_ligne, pos_passager) / 1000)::numeric, 2),
    round((1.0 / (1.0 + st_distance(i.trajet_ligne, pos_passager) / 1000))::numeric, 3),
    (st_distance(i.trajet_ligne, pos_passager) <= (i.rayon_detour_km * 1000))
  from instances i
  join profiles p on p.id = i.conducteur_id
  left join reservees rv on rv.ti_id = i.instance_id
  where (i.places_total - coalesce(rv.occupees, 0)) > 0
    and p.suspended = false
  order by dans_zone desc, st_distance(i.trajet_ligne, pos_passager) asc
  limit 20;
end;
$$ language plpgsql stable;
