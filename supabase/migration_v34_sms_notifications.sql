-- ============================================================
-- Migration v34 — Notifications SMS (Brevo)
-- Idempotente : utilise IF NOT EXISTS et DROP POLICY IF EXISTS
-- ============================================================

-- 1) Préférence sms_enabled dans notification_preferences (opt-out)
alter table notification_preferences
  add column if not exists sms_enabled boolean not null default true;

-- 2) Table d'idempotence des SMS envoyés
-- dedup_key : clé fonctionnelle (ex: 'reminder_2h:<instance_id>:<recipient_id>')
-- permet de protéger les replays côté Edge Functions cron + retries.
create table if not exists sms_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade,
  kind text not null,
  phone text not null,
  dedup_key text not null,
  provider text not null default 'brevo',
  provider_message_id text,
  status text not null default 'sent',
  error text,
  sent_at timestamptz not null default now(),
  unique (dedup_key)
);

create index if not exists idx_sms_log_user on sms_log(user_id);
create index if not exists idx_sms_log_kind on sms_log(kind);
create index if not exists idx_sms_log_sent_at on sms_log(sent_at desc);

alter table sms_log enable row level security;

-- Lecture admin uniquement (table interne service-role)
drop policy if exists "admin lit sms_log" on sms_log;
create policy "admin lit sms_log" on sms_log for select using (is_admin());
-- Aucune policy d'insert/update/delete : service-role bypass RLS,
-- les clients normaux n'écrivent jamais dans cette table.
