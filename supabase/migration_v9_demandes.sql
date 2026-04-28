-- Migration v9 : table demandes_passager (offre/demande symétrique)
-- Permet aux passagers de publier leur demande quand aucun trajet ne matche.
-- Les conducteurs peuvent voir les demandes actives et créer un trajet pour répondre.

create table if not exists demandes_passager (
  id uuid primary key default gen_random_uuid(),
  passager_id uuid not null references profiles(id) on delete cascade,
  culte_id uuid not null references cultes(id) on delete cascade,
  date date not null,
  sens text not null check (sens in ('aller', 'retour')),
  pickup_adresse text not null,
  pickup_position geography(point) not null,
  notes text,
  statut text not null default 'active'
    check (statut in ('active', 'matched', 'annulee')),
  matched_trajet_id uuid references trajets(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_demandes_passager_position
  on demandes_passager using gist(pickup_position);
create index if not exists idx_demandes_passager_active_date
  on demandes_passager(date)
  where statut = 'active';
create index if not exists idx_demandes_passager_passager
  on demandes_passager(passager_id);

-- RLS
alter table demandes_passager enable row level security;

-- Le passager gère ses propres demandes
drop policy if exists "demandes_passager owner" on demandes_passager;
create policy "demandes_passager owner" on demandes_passager
  for all using (passager_id = auth.uid())
  with check (passager_id = auth.uid());

-- Tout utilisateur authentifié dont le rôle est conducteur ou les_deux peut LIRE les demandes actives
drop policy if exists "demandes_passager visible aux conducteurs" on demandes_passager;
create policy "demandes_passager visible aux conducteurs" on demandes_passager
  for select using (
    statut = 'active'
    and exists (
      select 1 from profiles
      where id = auth.uid() and role in ('conducteur', 'les_deux')
    )
  );

-- Admin tout
drop policy if exists "demandes_passager admin" on demandes_passager;
create policy "demandes_passager admin" on demandes_passager
  for all using (is_admin()) with check (is_admin());

-- Trigger updated_at
create or replace function set_demandes_passager_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_demandes_passager_updated_at on demandes_passager;
create trigger trg_demandes_passager_updated_at
  before update on demandes_passager
  for each row execute function set_demandes_passager_updated_at();
