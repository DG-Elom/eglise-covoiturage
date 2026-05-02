-- Migration v29 — Garde-fou capacité : prevent overbooking + auto-refus + notifications
-- Idempotente : peut être relancée sans effet si déjà appliquée.
--
-- Test de validation SQL (voir scratchpad/CAPACITY-report.md pour le script complet) :
--   1. Créer une instance avec places_total = 1
--   2. Insérer 1 résa accepted  → OK
--   3. Insérer 1 résa pending   → DOIT lever instance_full (P0001)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Fonction utilitaire : places restantes sur une instance
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function instance_places_restantes(p_instance_id uuid)
returns int
language sql
stable
as $$
  select greatest(
    0,
    t.places_total - coalesce((
      select count(*) from reservations r
      where r.trajet_instance_id = p_instance_id
        and r.statut in ('accepted', 'pending')
    ), 0)
  )
  from trajets_instances ti
  join trajets t on t.id = ti.trajet_id
  where ti.id = p_instance_id;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Trigger BEFORE INSERT — refuse si instance pleine
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function check_instance_capacity()
returns trigger
language plpgsql
as $$
begin
  if instance_places_restantes(NEW.trajet_instance_id) <= 0 then
    raise exception 'instance_full' using errcode = 'P0001';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_check_instance_capacity on reservations;
create trigger trg_check_instance_capacity
  before insert on reservations
  for each row
  when (NEW.statut in ('pending', 'accepted'))
  execute function check_instance_capacity();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Trigger AFTER UPDATE — auto-refuse les pending quand l'instance devient pleine
--    après qu'une résa passe à accepted
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function auto_refuse_when_full()
returns trigger
language plpgsql
security definer
as $$
declare
  v_remaining int;
begin
  if NEW.statut = 'accepted' and OLD.statut <> 'accepted' then
    v_remaining := instance_places_restantes(NEW.trajet_instance_id);
    if v_remaining <= 0 then
      update reservations
      set statut = 'refused',
          motif_refus = 'trajet_complet_auto',
          traitee_le = now()
      where trajet_instance_id = NEW.trajet_instance_id
        and statut = 'pending'
        and id <> NEW.id;
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_auto_refuse_when_full on reservations;
create trigger trg_auto_refuse_when_full
  after update of statut on reservations
  for each row
  execute function auto_refuse_when_full();
