-- Migration v24 — Préférences de notifications push par utilisateur
-- Idempotente : utilise IF NOT EXISTS et DROP POLICY IF EXISTS

-- 1. Table notification_preferences
create table if not exists notification_preferences (
  user_id uuid primary key references profiles(id) on delete cascade,
  reminder_2h boolean not null default true,
  imminent_departure boolean not null default true,
  new_request boolean not null default true,
  decision boolean not null default true,
  trajet_cancelled boolean not null default true,
  new_message boolean not null default true,
  thanks_received boolean not null default true,
  weekly_summary_admin boolean not null default true,
  updated_at timestamptz not null default now()
);

-- 2. Trigger updated_at (réutilise la fonction set_updated_at existante)
drop trigger if exists set_updated_at on notification_preferences;
create trigger set_updated_at
  before update on notification_preferences
  for each row execute function set_updated_at();

-- 3. RLS
alter table notification_preferences enable row level security;

drop policy if exists "notif_prefs: lecture propriétaire" on notification_preferences;
create policy "notif_prefs: lecture propriétaire"
  on notification_preferences for select
  using (auth.uid() = user_id);

drop policy if exists "notif_prefs: insertion propriétaire" on notification_preferences;
create policy "notif_prefs: insertion propriétaire"
  on notification_preferences for insert
  with check (auth.uid() = user_id);

drop policy if exists "notif_prefs: modification propriétaire" on notification_preferences;
create policy "notif_prefs: modification propriétaire"
  on notification_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "notif_prefs: suppression propriétaire" on notification_preferences;
create policy "notif_prefs: suppression propriétaire"
  on notification_preferences for delete
  using (auth.uid() = user_id);
