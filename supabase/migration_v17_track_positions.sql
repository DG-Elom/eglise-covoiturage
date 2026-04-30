-- Migration v17: Table de positions pour live tracking public
-- Cette table stocke la dernière position connue du conducteur par trajet instance
-- afin que le lien public /track/<token> puisse être interrogé via HTTP polling
-- sans connexion Realtime (qui nécessite une auth Supabase).
--
-- Les positions sont écrites par la Edge Function ou via RLS depuis le client conducteur.
-- TTL implicite : les lignes sont nettoyées automatiquement après 6h via CRON ou
-- par une prochaine migration. Pour l'instant, le conducteur peut écrire sa position
-- et n'importe qui ayant un token valide peut lire.

create table if not exists track_positions (
  trajet_instance_id  uuid        not null references trajets_instances(id) on delete cascade,
  conducteur_id       uuid        not null references auth.users(id) on delete cascade,
  lat                 double precision not null,
  lng                 double precision not null,
  updated_at          timestamptz not null default now(),
  primary key (trajet_instance_id)
);

-- Index pour lecture rapide par trajet instance
create index if not exists track_positions_updated_at_idx
  on track_positions (updated_at desc);

-- RLS
alter table track_positions enable row level security;

-- Le conducteur peut écrire (upsert) sa propre position
create policy "conducteur peut upsert sa position"
  on track_positions
  for all
  using (auth.uid() = conducteur_id)
  with check (auth.uid() = conducteur_id);

-- Lecture publique (pas d'auth requise) pour le lien de suivi
-- La vérification du droit d'accès est faite au niveau API via le JWT track-token
create policy "lecture publique positions"
  on track_positions
  for select
  using (true);

-- Commentaire: Nettoyage recommandé via pg_cron ou trigger
-- delete from track_positions where updated_at < now() - interval '6 hours';
