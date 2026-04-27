-- ============================================================
-- Migration v7 — Rappels J-2h (reminders_log + cron pg_net)
-- À exécuter dans Supabase SQL Editor
-- ============================================================

-- 1) Table d'idempotence des rappels envoyés
create table if not exists reminders_log (
  id uuid primary key default uuid_generate_v4(),
  trajet_instance_id uuid references trajets_instances(id) on delete cascade,
  recipient_id uuid references profiles(id) on delete cascade,
  kind text not null,
  sent_at timestamptz not null default now(),
  unique (trajet_instance_id, recipient_id, kind)
);

create index if not exists idx_reminders_log_instance on reminders_log(trajet_instance_id);
create index if not exists idx_reminders_log_recipient on reminders_log(recipient_id);

alter table reminders_log enable row level security;

-- Lecture admin uniquement (table interne service-role)
create policy "admin lit reminders_log" on reminders_log for select using (is_admin());
-- Aucune policy d'insert/update/delete : service-role bypass RLS, les clients normaux n'écrivent pas.

-- ============================================================
-- 2) Extensions cron + pg_net
-- ============================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ============================================================
-- 3) Cron toutes les 15 min — À EXÉCUTER APRÈS le déploiement
--    de la fonction Edge `reminders` (cf. REMINDERS.md, étape 6).
--
--    REMPLACER :
--      <PROJECT_REF>        → ex: ulfpjbhmiddpmsuwpedm
--      <SERVICE_ROLE_KEY>   → clé service_role du projet (Supabase Dashboard → Settings → API)
--
--    Le bloc ci-dessous est commenté volontairement : copiez-le,
--    substituez les placeholders, puis exécutez-le seul dans le SQL Editor.
-- ============================================================

/*
select cron.schedule(
  'reminders-every-15min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
*/

-- Pour désinstaller le cron :
-- select cron.unschedule('reminders-every-15min');
