-- Migration v26 — Table d'idempotence pour les relances passagers inactifs
-- + colonne de préférence engagement_relance dans notification_preferences
-- Idempotente : IF NOT EXISTS + DROP POLICY IF EXISTS

-- 1. Table engagement_log
create table if not exists engagement_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null check (kind in ('engage_d2','engage_d7','engage_d14')),
  sent_at timestamptz not null default now(),
  unique (user_id, kind)
);

create index if not exists idx_engagement_log_user on engagement_log(user_id, sent_at desc);

alter table engagement_log enable row level security;

drop policy if exists "engagement_log: admin only" on engagement_log;
create policy "engagement_log: admin only" on engagement_log for all using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);

-- 2. Colonne engagement_relance dans notification_preferences (v26b)
-- Contrôle si le passager souhaite recevoir les relances d'activation (3 max, puis stop)
alter table notification_preferences
  add column if not exists engagement_relance boolean not null default true;
