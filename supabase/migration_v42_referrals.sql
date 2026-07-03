-- ============================================================
-- Migration v42 — Parrainage / invitation (acquisition)
-- Idempotente : IF NOT EXISTS + DROP POLICY IF EXISTS
-- ============================================================

-- 1. Colonne referral_code sur profiles (code public unique)
alter table profiles
  add column if not exists referral_code text;

-- Backfill : génère un code lisible (sans O/0/I/1/L) pour les profils existants.
-- Boucle pour garantir l'unicité même en cas de collision improbable.
do $$
declare
  r record;
  new_code text;
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  i int;
begin
  for r in select id from profiles where referral_code is null loop
    loop
      new_code := '';
      for i in 1..8 loop
        new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
      end loop;
      exit when not exists (select 1 from profiles where referral_code = new_code);
    end loop;
    update profiles set referral_code = new_code where id = r.id;
  end loop;
end $$;

-- Contrainte d'unicité (idempotente via index unique nommé)
create unique index if not exists idx_profiles_referral_code
  on profiles(referral_code);

-- 2. Table referrals
create table if not exists referrals (
  id uuid primary key default uuid_generate_v4(),
  referrer_id uuid not null references profiles(id) on delete cascade,
  invited_user_id uuid references profiles(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'joined')),
  created_at timestamptz not null default now()
);

create index if not exists idx_referrals_referrer on referrals(referrer_id);
create index if not exists idx_referrals_invited on referrals(invited_user_id);

-- Un inscrit ne peut être rattaché qu'à un seul parrain (anti-double-rattachement).
create unique index if not exists idx_referrals_invited_unique
  on referrals(invited_user_id)
  where invited_user_id is not null;

-- 3. RLS
alter table referrals enable row level security;

-- Le parrain lit ses propres referrals
drop policy if exists "referrals: parrain lit les siens" on referrals;
create policy "referrals: parrain lit les siens" on referrals
  for select using (referrer_id = auth.uid());

-- L'admin lit tout
drop policy if exists "referrals: admin lit tout" on referrals;
create policy "referrals: admin lit tout" on referrals
  for select using (is_admin());

-- Inserts / updates via service-role uniquement (rattachement côté serveur).
-- Aucune policy INSERT/UPDATE pour les utilisateurs : RLS bloque par défaut.
