-- ============================================================
-- Migration v40 — Weekly Digest : contrainte engagement_log + cron
-- Idempotente (DROP IF EXISTS / IF NOT EXISTS).
-- ============================================================

-- 1) Élargit la contrainte check pour accepter les kinds dynamiques weekly_digest_<YYYY>W<ww>
--    On conserve les 6 kinds existants ET on autorise tout kind commençant par 'weekly_digest_'.

alter table engagement_log drop constraint if exists engagement_log_kind_check;

alter table engagement_log add constraint engagement_log_kind_check
  check (
    kind in (
      'engage_d2',
      'engage_d7',
      'engage_d14',
      'engage_conducteur_d2',
      'engage_conducteur_d7',
      'engage_conducteur_d14'
    )
    or kind like 'weekly_digest_%'
  );

-- ============================================================
-- 2) Extensions (déjà installées par v7, on s'assure qu'elles existent)
-- ============================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ============================================================
-- 3) Cron chaque jeudi 16h00 UTC (≈ 18h Paris l'été, 17h l'hiver — DST non géré par pg_cron).
--    Déclenche l'Edge Function `weekly-digest`.
--
--    ⚠ LAISSER COMMENTÉ — à activer au déploiement en prod après `supabase functions deploy weekly-digest`.
--
--    REMPLACER :
--      <PROJECT_REF>        → ex: ulfpjbhmiddpmsuwpedm
--      <SERVICE_ROLE_KEY>   → clé service_role du projet (Supabase Dashboard → Settings → API)
--
--    Copiez le bloc ci-dessous, substituez les placeholders, puis exécutez-le
--    séparément dans le SQL Editor de Supabase.
-- ============================================================

/*
select cron.schedule(
  'weekly-digest-thursday',
  '0 16 * * 4',  -- chaque jeudi 16h00 UTC (≈ 18h00 Paris heure d'été, 17h00 heure d'hiver)
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/weekly-digest',
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
-- select cron.unschedule('weekly-digest-thursday');

-- ============================================================
-- 4) Purge (optionnelle) — engagement_log grossit de 1 ligne/user/semaine.
--    Négligeable à l'échelle actuelle (~52 lignes/user/an). À planifier si volume :
--    delete from engagement_log
--      where kind like 'weekly_digest_%' and sent_at < now() - interval '6 months';
-- ============================================================
