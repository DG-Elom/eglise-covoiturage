-- ============================================================
-- Migration v16 — Features Pack (Vague 2 foundations)
-- Objets créés :
--   1. profiles.voiture_photo_url  (colonne)
--   2. subscriptions               (table)
--   3. thanks                      (table)
--   4. user_stats                  (vue)
-- Prérequis : v13 (trip_ratings, profiles extensions)
-- Idempotent : if not exists, drop policy if exists, create or replace
-- ============================================================

-- ============================================================
-- 1. COLONNE voiture_photo_url sur profiles
-- ============================================================

alter table profiles
  add column if not exists voiture_photo_url text;


-- ============================================================
-- 2. TABLE subscriptions
--    Passager s'abonne à un trajet récurrent d'un conducteur.
--    Déclenche automatiquement une résa à chaque instance future.
-- ============================================================

create table if not exists subscriptions (
  id             uuid        primary key default uuid_generate_v4(),
  passager_id    uuid        not null references profiles(id) on delete cascade,
  trajet_id      uuid        not null references trajets(id) on delete cascade,
  sens           sens_reservation not null,
  pickup_adresse text        not null,
  pickup_position geography(point, 4326) not null,
  actif          boolean     not null default true,
  created_at     timestamptz not null default now(),
  unique (passager_id, trajet_id, sens)
);

create index if not exists idx_subscriptions_trajet_actif
  on subscriptions(trajet_id)
  where actif = true;

alter table subscriptions enable row level security;

-- Passager : voit et gère ses propres souscriptions
drop policy if exists "subscription passager" on subscriptions;
create policy "subscription passager" on subscriptions
  for all
  using  (passager_id = auth.uid())
  with check (passager_id = auth.uid());

-- Conducteur : voit les souscriptions de ses trajets (lecture seule)
drop policy if exists "subscription conducteur lit" on subscriptions;
create policy "subscription conducteur lit" on subscriptions
  for select
  using (
    exists (
      select 1 from trajets t
      where t.id = subscriptions.trajet_id
        and t.conducteur_id = auth.uid()
    )
  );

-- Admin
drop policy if exists "subscription admin" on subscriptions;
create policy "subscription admin" on subscriptions
  for all
  using  (is_admin())
  with check (is_admin());


-- ============================================================
-- 3. TABLE thanks
--    Mots de remerciement post-trajet (immuables, optionnellement publics).
-- ============================================================

create table if not exists thanks (
  id               uuid        primary key default uuid_generate_v4(),
  auteur_id        uuid        not null references profiles(id) on delete cascade,
  destinataire_id  uuid        not null references profiles(id) on delete cascade,
  reservation_id   uuid        references reservations(id) on delete set null,
  message          text        not null check (length(message) between 1 and 500),
  is_public        boolean     not null default true,
  created_at       timestamptz not null default now()
);

create index if not exists idx_thanks_destinataire
  on thanks(destinataire_id, created_at desc);

alter table thanks enable row level security;

-- Tous voient les messages publics
drop policy if exists "thanks publics visibles" on thanks;
create policy "thanks publics visibles" on thanks
  for select
  using (is_public = true);

-- Auteur et destinataire voient aussi les messages privés
drop policy if exists "thanks prives visibles" on thanks;
create policy "thanks prives visibles" on thanks
  for select
  using (
    is_public = false
    and (auteur_id = auth.uid() or destinataire_id = auth.uid())
  );

-- Insertion : auteur authentifié, la réservation (si fournie) doit être
-- completed et impliquer les deux parties
drop policy if exists "thanks insertion" on thanks;
create policy "thanks insertion" on thanks
  for insert
  with check (
    auteur_id = auth.uid()
    and (
      reservation_id is null
      or exists (
        select 1 from reservations r
        where r.id = thanks.reservation_id
          and r.statut = 'completed'
          and (r.passager_id = auth.uid() or exists (
            select 1 from trajets_instances ti
            join trajets t on t.id = ti.trajet_id
            where ti.id = r.trajet_instance_id
              and t.conducteur_id = auth.uid()
          ))
          and (r.passager_id = thanks.destinataire_id or exists (
            select 1 from trajets_instances ti
            join trajets t on t.id = ti.trajet_id
            where ti.id = r.trajet_instance_id
              and t.conducteur_id = thanks.destinataire_id
          ))
      )
    )
  );

-- Immuable : aucun update autorisé (pas de policy update = bloqué par défaut)

-- Admin
drop policy if exists "thanks admin" on thanks;
create policy "thanks admin" on thanks
  for all
  using  (is_admin())
  with check (is_admin());


-- ============================================================
-- 4. VUE user_stats
--    Agrège par profiles.id des métriques conducteur + passager.
--    security_invoker = true → la vue hérite du RLS de l'appelant.
--    Compatible Supabase / PostgREST.
-- ============================================================

create or replace view user_stats
  with (security_invoker = true)
as
select
  p.id                                                        as user_id,

  -- Nombre d'instances passées où cet utilisateur était conducteur
  -- et avait au moins 1 réservation accepted/completed
  count(distinct case
    when ti.date < current_date
      and r_cond.statut in ('accepted', 'completed')
    then ti.id
  end)::bigint                                                as total_trajets_conducteur,

  -- Somme des réservations accepted ou completed où il est conducteur
  count(case
    when r_cond.statut in ('accepted', 'completed')
    then 1
  end)::bigint                                                as total_passagers_transportes,

  -- Nombre de réservations completed où il est passager
  count(case
    when r_pass.statut = 'completed'
    then 1
  end)::bigint                                                as total_trajets_passager,

  -- Somme des places_total sur les instances des 30 derniers jours
  coalesce(sum(case
    when ti30.date >= current_date - interval '30 days'
      and ti30.date < current_date
    then t30.places_total
    else 0
  end), 0)::bigint                                            as places_offertes_30j,

  -- Note moyenne issue de trip_ratings (cible = cet utilisateur)
  round(avg(tr.stars)::numeric, 2)                           as note_moyenne,

  -- Nombre de trajets conducteur ce mois calendaire
  count(distinct case
    when date_trunc('month', ti.date::timestamptz) = date_trunc('month', current_date::timestamptz)
      and r_cond.statut in ('accepted', 'completed', 'pending')
    then ti.id
  end)::bigint                                                as mois_courant_trajets

from profiles p

-- Côté conducteur : instances liées aux trajets du conducteur
left join trajets t_cond
  on t_cond.conducteur_id = p.id
left join trajets_instances ti
  on ti.trajet_id = t_cond.id
left join reservations r_cond
  on r_cond.trajet_instance_id = ti.id

-- Côté passager : réservations où il est passager
left join reservations r_pass
  on r_pass.passager_id = p.id

-- 30 derniers jours (conducteur)
left join trajets_instances ti30
  on ti30.trajet_id = t_cond.id
  and ti30.date >= current_date - interval '30 days'
  and ti30.date < current_date
left join trajets t30
  on t30.id = ti30.trajet_id

-- Notes reçues
left join trip_ratings tr
  on tr.rated_id = p.id

group by p.id;
