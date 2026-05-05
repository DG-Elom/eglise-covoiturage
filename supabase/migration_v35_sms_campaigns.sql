-- ============================================================
-- Migration v35 — Campagnes SMS admin (générées par IA)
-- Idempotente
-- ============================================================

create table if not exists sms_campaigns (
  id uuid primary key default uuid_generate_v4(),
  auteur_id uuid not null references profiles(id) on delete restrict,
  target_filter text not null,
  target_label text,
  prompt_admin text,
  ton text,
  message text not null,
  n_destinataires int not null default 0,
  n_envoyes int not null default 0,
  n_skipped int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_sms_campaigns_auteur on sms_campaigns(auteur_id);
create index if not exists idx_sms_campaigns_created_at on sms_campaigns(created_at desc);

alter table sms_campaigns enable row level security;

drop policy if exists "admin lit sms_campaigns" on sms_campaigns;
create policy "admin lit sms_campaigns" on sms_campaigns for select using (is_admin());
-- Inserts via service-role uniquement
