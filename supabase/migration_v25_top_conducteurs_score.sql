-- Migration v25 — Vue user_top_score pour le classement composite des conducteurs
-- Idempotente : create or replace view

create or replace view user_top_score with (security_invoker = true) as
with mois as (
  select
    date_trunc('month', current_date) as debut,
    (date_trunc('month', current_date) + interval '1 month') as fin
),
-- A. Trajets créés ce mois calendaire
trajets_mois as (
  select
    t.conducteur_id,
    count(distinct t.id) as nb_trajets_proposes
  from trajets t
  cross join mois
  where t.created_at >= mois.debut
    and t.created_at < mois.fin
  group by t.conducteur_id
),
-- C. Demandes reçues ce mois (tous statuts)
demandes_recues as (
  select
    t.conducteur_id,
    count(*)                                                                        as nb_demandes,
    sum(case when r.statut = 'accepted'                        then 1 else 0 end)  as nb_acceptees,
    sum(case when r.statut in ('accepted', 'completed')        then 1 else 0 end)  as nb_passagers_ok
  from reservations r
  join trajets_instances ti on ti.id = r.trajet_instance_id
  join trajets t            on t.id  = ti.trajet_id
  cross join mois
  where r.demande_le >= mois.debut
    and r.demande_le < mois.fin
  group by t.conducteur_id
),
-- B. Détour cumulé en km pour les réservations acceptées/complétées
detour as (
  select
    t.conducteur_id,
    coalesce(
      sum(st_distance(t.trajet_ligne, r.pickup_position) / 1000.0),
      0
    ) as km_detour
  from reservations r
  join trajets_instances ti on ti.id = r.trajet_instance_id
  join trajets t            on t.id  = ti.trajet_id
  cross join mois
  where r.statut in ('accepted', 'completed')
    and r.demande_le >= mois.debut
    and r.demande_le < mois.fin
    and t.trajet_ligne is not null
  group by t.conducteur_id
),
-- D. Réactivité : médiane en minutes entre demande_le et traitee_le
reactivite as (
  select
    t.conducteur_id,
    percentile_cont(0.5) within group (
      order by extract(epoch from (r.traitee_le - r.demande_le)) / 60
    ) as median_minutes_reponse
  from reservations r
  join trajets_instances ti on ti.id = r.trajet_instance_id
  join trajets t            on t.id  = ti.trajet_id
  cross join mois
  where r.traitee_le  is not null
    and r.demande_le >= mois.debut
    and r.demande_le < mois.fin
  group by t.conducteur_id
)
select
  p.id                                                         as user_id,
  coalesce(tm.nb_trajets_proposes, 0)                         as trajets_proposes,
  coalesce(dr.nb_demandes, 0)                                 as demandes_recues,
  coalesce(dr.nb_acceptees, 0)                                as demandes_acceptees,
  coalesce(dr.nb_passagers_ok, 0)                             as passagers_transportes,
  coalesce(d.km_detour, 0)::numeric(10, 2)                    as km_detour_consenti,
  re.median_minutes_reponse,
  case
    when coalesce(dr.nb_demandes, 0) = 0 then null
    else coalesce(dr.nb_acceptees, 0)::float / dr.nb_demandes::float
  end                                                          as taux_acceptation
from profiles p
left join trajets_mois    tm on tm.conducteur_id = p.id
left join demandes_recues dr on dr.conducteur_id = p.id
left join detour           d on d.conducteur_id  = p.id
left join reactivite      re on re.conducteur_id = p.id
where p.suspended = false
  and p.role in ('conducteur', 'les_deux');
