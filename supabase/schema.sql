-- ============================================================
-- Covoiturage Église — Schéma Supabase complet
-- À exécuter dans Supabase SQL Editor
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "postgis";
create extension if not exists "pg_trgm";

-- ============ Enums ============
create type role_user as enum ('conducteur', 'passager', 'les_deux');
create type sens_trajet as enum ('aller', 'retour', 'aller_retour');
create type sens_reservation as enum ('aller', 'retour');
create type statut_reservation as enum (
  'pending', 'accepted', 'refused',
  'cancelled', 'completed', 'no_show'
);
create type statut_signalement as enum ('ouvert', 'en_cours', 'traite', 'rejete');

-- ============ Profils ============
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nom text not null,
  prenom text not null,
  telephone text not null,
  photo_url text,
  role role_user not null default 'passager',
  voiture_modele text,
  voiture_couleur text,
  voiture_plaque text,
  charte_acceptee_at timestamptz not null,
  is_admin boolean not null default false,
  suspended boolean not null default false,
  suspended_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_profiles_role on profiles(role) where suspended = false;

-- ============ Église & cultes ============
create table eglise (
  id uuid primary key default uuid_generate_v4(),
  nom text not null,
  adresse text not null,
  position geography(point, 4326) not null
);

create table cultes (
  id uuid primary key default uuid_generate_v4(),
  libelle text not null,
  jour_semaine smallint not null check (jour_semaine between 0 and 6),
  heure time not null,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============ Trajets récurrents ============
create table trajets (
  id uuid primary key default uuid_generate_v4(),
  conducteur_id uuid not null references profiles(id) on delete cascade,
  culte_id uuid not null references cultes(id) on delete restrict,
  depart_adresse text not null,
  depart_position geography(point, 4326) not null,
  trajet_ligne geography(linestring, 4326),
  sens sens_trajet not null,
  places_total smallint not null check (places_total between 1 and 8),
  rayon_detour_km numeric(3,1) not null default 1.5
    check (rayon_detour_km between 0.1 and 5.0),
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_trajets_culte on trajets(culte_id) where actif;
create index idx_trajets_conducteur on trajets(conducteur_id);
create index idx_trajets_geo on trajets using gist(trajet_ligne);
create index idx_trajets_depart on trajets using gist(depart_position);

-- ============ Instances datées ============
create table trajets_instances (
  id uuid primary key default uuid_generate_v4(),
  trajet_id uuid not null references trajets(id) on delete cascade,
  date date not null,
  annule_par_conducteur boolean not null default false,
  motif_annulation text,
  created_at timestamptz not null default now(),
  unique (trajet_id, date)
);
create index idx_instances_date on trajets_instances(date);

-- ============ Réservations ============
create table reservations (
  id uuid primary key default uuid_generate_v4(),
  passager_id uuid not null references profiles(id) on delete cascade,
  trajet_instance_id uuid not null references trajets_instances(id) on delete cascade,
  sens sens_reservation not null,
  statut statut_reservation not null default 'pending',
  pickup_adresse text not null,
  pickup_position geography(point, 4326) not null,
  motif_refus text,
  demande_le timestamptz not null default now(),
  traitee_le timestamptz,
  cancelled_le timestamptz,
  unique (passager_id, trajet_instance_id, sens)
);
create index idx_reservations_passager on reservations(passager_id);
create index idx_reservations_instance on reservations(trajet_instance_id);
create index idx_reservations_statut on reservations(statut);

-- ============ Messagerie ============
create table messages (
  id uuid primary key default uuid_generate_v4(),
  reservation_id uuid references reservations(id) on delete cascade,
  expediteur_id uuid not null references profiles(id) on delete cascade,
  destinataire_id uuid not null references profiles(id) on delete cascade,
  contenu text not null check (length(contenu) <= 2000),
  lu boolean not null default false,
  envoye_le timestamptz not null default now()
);
create index idx_messages_destinataire on messages(destinataire_id, lu) where lu = false;
create index idx_messages_reservation on messages(reservation_id);

-- ============ Signalements ============
create table signalements (
  id uuid primary key default uuid_generate_v4(),
  auteur_id uuid not null references profiles(id) on delete cascade,
  cible_id uuid not null references profiles(id) on delete cascade,
  reservation_id uuid references reservations(id) on delete set null,
  motif text not null,
  description text,
  statut statut_signalement not null default 'ouvert',
  ia_gravite smallint check (ia_gravite between 1 and 5),
  ia_action_suggeree text,
  traite_par uuid references profiles(id),
  traite_le timestamptz,
  created_at timestamptz not null default now()
);
create index idx_signalements_statut on signalements(statut);

-- ============ Audit admin ============
create table admin_actions (
  id uuid primary key default uuid_generate_v4(),
  admin_id uuid not null references profiles(id),
  action text not null,
  cible_type text,
  cible_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ============ Triggers ============
create or replace function update_trajet_ligne()
returns trigger as $$
declare
  eglise_pos geography;
begin
  select position into eglise_pos from eglise limit 1;
  new.trajet_ligne := st_makeline(
    new.depart_position::geometry,
    eglise_pos::geometry
  )::geography;
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger trg_trajet_ligne
before insert or update of depart_position on trajets
for each row execute function update_trajet_ligne();

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger trg_profiles_updated before update on profiles
for each row execute function set_updated_at();

-- ============ Matching géo ============
create or replace function trajets_compatibles(
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
  places_restantes int,
  detour_km numeric,
  score numeric
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
    where r.statut in ('accepted', 'pending')
    group by r.trajet_instance_id
  )
  select
    i.id,
    i.instance_id,
    i.conducteur_id,
    p.prenom,
    i.depart_adresse,
    (i.places_total - coalesce(rv.occupees, 0))::int,
    round((st_distance(i.trajet_ligne, pos_passager) / 1000)::numeric, 2),
    round((1.0 / (1.0 + st_distance(i.trajet_ligne, pos_passager) / 1000))::numeric, 3)
  from instances i
  join profiles p on p.id = i.conducteur_id
  left join reservees rv on rv.ti_id = i.instance_id
  where st_distance(i.trajet_ligne, pos_passager) <= (i.rayon_detour_km * 1000)
    and (i.places_total - coalesce(rv.occupees, 0)) > 0
    and p.suspended = false
  order by score desc;
end;
$$ language plpgsql stable;

-- ============ RLS ============
alter table profiles enable row level security;
alter table trajets enable row level security;
alter table trajets_instances enable row level security;
alter table reservations enable row level security;
alter table messages enable row level security;
alter table signalements enable row level security;
alter table admin_actions enable row level security;

create or replace function is_admin() returns boolean as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$ language sql stable security definer;

-- profiles
create policy "profils visibles" on profiles for select
  using (suspended = false or auth.uid() = id or is_admin());
create policy "auto-update" on profiles for update using (auth.uid() = id);
create policy "auto-insert" on profiles for insert with check (auth.uid() = id);
create policy "admin tout" on profiles for all using (is_admin());

-- trajets
create policy "trajets actifs visibles" on trajets for select
  using (actif = true or conducteur_id = auth.uid() or is_admin());
create policy "conducteur gère" on trajets for all using (conducteur_id = auth.uid());

-- instances
create policy "instances visibles" on trajets_instances for select using (true);
create policy "conducteur gère instances" on trajets_instances for all using (
  exists (select 1 from trajets t where t.id = trajet_id and t.conducteur_id = auth.uid())
);

-- reservations
create policy "passager voit ses résa" on reservations for select using (passager_id = auth.uid());
create policy "conducteur voit résa de ses trajets" on reservations for select using (
  exists (
    select 1 from trajets_instances ti
    join trajets t on t.id = ti.trajet_id
    where ti.id = reservations.trajet_instance_id and t.conducteur_id = auth.uid()
  )
);
create policy "passager crée résa" on reservations for insert with check (passager_id = auth.uid());
create policy "passager update résa" on reservations for update using (passager_id = auth.uid());
create policy "conducteur traite résa" on reservations for update using (
  exists (
    select 1 from trajets_instances ti
    join trajets t on t.id = ti.trajet_id
    where ti.id = reservations.trajet_instance_id and t.conducteur_id = auth.uid()
  )
);

-- messages
create policy "lecture msg perso" on messages for select
  using (expediteur_id = auth.uid() or destinataire_id = auth.uid());
create policy "envoi msg" on messages for insert with check (expediteur_id = auth.uid());
create policy "marquer lu" on messages for update using (destinataire_id = auth.uid());

-- signalements
create policy "auteur voit ses signalements" on signalements for select
  using (auteur_id = auth.uid() or is_admin());
create policy "création signalement" on signalements for insert with check (auteur_id = auth.uid());
create policy "admin traite signalements" on signalements for update using (is_admin());

-- admin_actions
create policy "admin only" on admin_actions for all using (is_admin());

-- ============ Storage ============
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict do nothing;

create policy "avatars publics" on storage.objects for select using (bucket_id = 'avatars');
create policy "upload avatar perso" on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "update avatar perso" on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

-- ============ Génération auto des instances ============
create or replace function generer_trajets_instances()
returns void as $$
begin
  insert into trajets_instances (trajet_id, date)
  select t.id, d::date
  from trajets t
  join cultes c on c.id = t.culte_id
  cross join generate_series(current_date, current_date + interval '30 days', '1 day') d
  where t.actif = true
    and extract(dow from d) = c.jour_semaine
  on conflict (trajet_id, date) do nothing;
end;
$$ language plpgsql;

-- ============ Seed initial ============
insert into eglise (nom, adresse, position) values (
  'ICC Metz',
  '7 rue de l''Abbé Grégoire, 57050 Metz',
  st_makepoint(6.175955, 49.146943)::geography
);

insert into cultes (libelle, jour_semaine, heure) values
  ('Culte du dimanche matin', 0, '09:00'),
  ('Réunion de prière mercredi', 3, '19:00'),
  ('Étude biblique vendredi', 5, '19:00');
