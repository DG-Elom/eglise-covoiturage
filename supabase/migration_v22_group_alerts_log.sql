-- ============================================================
-- Migration v22 — table group_alerts_log
-- Idempotence pour la feature co-voit groupé auto (#12).
-- Prérequis : v16 (profiles)
-- Idempotent : create table if not exists, drop policy if exists
-- ============================================================

create table if not exists group_alerts_log (
  id           uuid        primary key default uuid_generate_v4(),
  conducteur_id uuid        not null references profiles(id) on delete cascade,
  cluster_key  text        not null,
  sent_at      timestamptz not null default now(),
  unique (conducteur_id, cluster_key)
);

create index if not exists idx_group_alerts_conducteur
  on group_alerts_log(conducteur_id);

create index if not exists idx_group_alerts_cluster
  on group_alerts_log(cluster_key);

alter table group_alerts_log enable row level security;

-- Table technique : admin only
drop policy if exists "group_alerts_log admin" on group_alerts_log;
create policy "group_alerts_log admin" on group_alerts_log
  for all
  using  (is_admin())
  with check (is_admin());

-- ============================================================
-- Activation du cron pg_cron (à exécuter manuellement dans Supabase SQL Editor
-- après avoir activé l'extension pg_cron depuis le dashboard Supabase) :
--
--   select cron.schedule(
--     'group-pickup-alert',
--     '*/30 * * * *',
--     $$
--       select net.http_post(
--         url     := current_setting('app.supabase_url') || '/functions/v1/group-pickup-alert',
--         headers := jsonb_build_object(
--           'Content-Type',  'application/json',
--           'Authorization', 'Bearer ' || current_setting('app.service_role_key')
--         ),
--         body    := '{}'::jsonb
--       );
--     $$
--   );
--
-- Pour vérifier : select * from cron.job;
-- Pour désactiver : select cron.unschedule('group-pickup-alert');
-- ============================================================
