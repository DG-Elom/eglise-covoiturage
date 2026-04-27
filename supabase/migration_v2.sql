-- ============================================================
-- Migration v2 — Génération automatique des instances datées
-- À exécuter une fois dans Supabase SQL Editor
-- ============================================================

-- 1) RLS sur cultes et eglise (lecture publique)
alter table cultes enable row level security;
alter table eglise enable row level security;

drop policy if exists "cultes lisibles" on cultes;
create policy "cultes lisibles" on cultes for select using (true);

drop policy if exists "eglise lisible" on eglise;
create policy "eglise lisible" on eglise for select using (true);

-- 2) Trigger : à chaque création de trajet, on génère ses instances
--    pour les 30 prochains jours (jours du culte uniquement)
create or replace function generer_instances_pour_trajet()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into trajets_instances (trajet_id, date)
  select new.id, d::date
  from cultes c
  cross join generate_series(current_date, current_date + interval '30 days', '1 day') d
  where c.id = new.culte_id
    and extract(dow from d) = c.jour_semaine
  on conflict (trajet_id, date) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_generer_instances_on_insert on trajets;
create trigger trg_generer_instances_on_insert
after insert on trajets
for each row execute function generer_instances_pour_trajet();

-- 3) Backfill : génère les instances pour les trajets existants
do $$
declare
  t record;
begin
  for t in select id, culte_id from trajets where actif loop
    insert into trajets_instances (trajet_id, date)
    select t.id, d::date
    from cultes c
    cross join generate_series(current_date, current_date + interval '30 days', '1 day') d
    where c.id = t.culte_id
      and extract(dow from d) = c.jour_semaine
    on conflict (trajet_id, date) do nothing;
  end loop;
end $$;
