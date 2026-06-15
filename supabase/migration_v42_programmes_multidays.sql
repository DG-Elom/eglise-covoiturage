-- ============================================================
-- Migration v42 — Programmes multi-jours et événements datés
-- IDEMPOTENTE : peut être relancée sans risque
-- ============================================================
--
-- MODÈLE :
--   Un programme est SOIT :
--     (A) Récurrent  : jours_semaine non vide, date_debut/fin NULL
--     (B) Événement  : date_debut + date_fin non NULL (>= date_debut),
--                      jours_semaine vide
--
--   LEGACY : jour_semaine reste nullable.
--     Récurrent → jour_semaine = jours_semaine[1] (1er élément)
--     Événement → jour_semaine = NULL
--   Les ~18 sites non migrés continuent d'utiliser jour_semaine.
--
-- ROLLBACK :
--   1. drop table / alter pour enlever les nouvelles colonnes
--   2. alter table cultes alter column jour_semaine set not null
--   3. Remettre la fonction generer_trajets_instances() originale
--   4. Remettre generer_instances_pour_trajet() originale
-- ============================================================

-- ─── 1. Rendre jour_semaine nullable (pour le cas événement) ─────────────────

alter table cultes
  alter column jour_semaine drop not null;

-- ─── 2. Ajouter jours_semaine smallint[] ────────────────────────────────────

alter table cultes
  add column if not exists jours_semaine smallint[] not null default '{}';

-- Check : chaque élément entre 0 et 6
drop constraint if exists cultes_jours_semaine_values on cultes;
-- PostgreSQL n'a pas de "add constraint if not exists" portable, on drop d'abord
alter table cultes
  drop constraint if exists cultes_jours_semaine_values;
alter table cultes
  add constraint cultes_jours_semaine_values
  check (
    (select bool_and(v between 0 and 6) from unnest(jours_semaine) v)
    or array_length(jours_semaine, 1) is null
  );

-- ─── 3. Ajouter date_debut et date_fin ──────────────────────────────────────

alter table cultes
  add column if not exists date_debut date,
  add column if not exists date_fin   date;

-- ─── 4. Contrainte XOR récurrent / événement ────────────────────────────────
-- Un programme DOIT être soit récurrent soit événement (pas les deux, pas ni l'un ni l'autre).
-- Exception : les lignes existantes auront jours_semaine vide au moment du backfill,
-- donc on applique la contrainte APRÈS le backfill.

alter table cultes
  drop constraint if exists cultes_type_xor;

-- ─── 5. Backfill : remplir jours_semaine à partir de jour_semaine existant ───

update cultes
set    jours_semaine = array[jour_semaine]
where  array_length(jours_semaine, 1) is null
  and  jour_semaine is not null;

-- ─── 6. Ajout de la contrainte XOR maintenant que le backfill est fait ───────

alter table cultes
  add constraint cultes_type_xor check (
    -- Cas A : récurrent (jours_semaine non vide, pas de dates)
    (
      array_length(jours_semaine, 1) > 0
      and date_debut is null
      and date_fin   is null
    )
    or
    -- Cas B : événement (dates non nulles, jours vide)
    (
      array_length(jours_semaine, 1) is null
      and date_debut is not null
      and date_fin   is not null
      and date_fin >= date_debut
    )
  );

-- ─── 7. Redéfinition de generer_trajets_instances() ─────────────────────────
-- Récurrents : fenêtre 30 jours comme avant, sur tous les jours de jours_semaine
-- Événements : toute la plage [date_debut, date_fin] >= current_date

create or replace function generer_trajets_instances()
returns void
language plpgsql
as $$
begin
  -- Programmes récurrents
  insert into trajets_instances (trajet_id, date)
  select t.id, d::date
  from   trajets t
  join   cultes  c on c.id = t.culte_id
  cross  join generate_series(
    current_date,
    current_date + interval '30 days',
    '1 day'
  ) d
  where  t.actif = true
    and  array_length(c.jours_semaine, 1) > 0          -- récurrent
    and  extract(dow from d) = any(c.jours_semaine::int[])
  on conflict (trajet_id, date) do nothing;

  -- Programmes événements
  insert into trajets_instances (trajet_id, date)
  select t.id, d::date
  from   trajets t
  join   cultes  c on c.id = t.culte_id
  cross  join generate_series(c.date_debut, c.date_fin, '1 day') d
  where  t.actif = true
    and  c.date_debut is not null
    and  c.date_fin   is not null
    and  d::date >= current_date
  on conflict (trajet_id, date) do nothing;
end;
$$;

-- ─── 8. Redéfinition du trigger de création de trajet ───────────────────────

create or replace function generer_instances_pour_trajet()
returns trigger
language plpgsql
security definer
as $$
begin
  if (
    select array_length(jours_semaine, 1) > 0
    from   cultes
    where  id = new.culte_id
  ) then
    -- Récurrent : 30 jours
    insert into trajets_instances (trajet_id, date)
    select new.id, d::date
    from   cultes c
    cross  join generate_series(
      current_date,
      current_date + interval '30 days',
      '1 day'
    ) d
    where  c.id = new.culte_id
      and  extract(dow from d) = any(c.jours_semaine::int[])
    on conflict (trajet_id, date) do nothing;
  else
    -- Événement : toute la plage >= today
    insert into trajets_instances (trajet_id, date)
    select new.id, d::date
    from   cultes c
    cross  join generate_series(c.date_debut, c.date_fin, '1 day') d
    where  c.id = new.culte_id
      and  c.date_debut is not null
      and  d::date >= current_date
    on conflict (trajet_id, date) do nothing;
  end if;

  return new;
end;
$$;

-- Le trigger lui-même n'a pas besoin d'être recrée (même nom, même table)
-- mais on le recrée pour être idempotent.
drop trigger if exists trg_generer_instances_on_insert on trajets;
create trigger trg_generer_instances_on_insert
  after insert on trajets
  for each row execute function generer_instances_pour_trajet();
