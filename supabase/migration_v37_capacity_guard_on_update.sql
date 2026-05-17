-- Migration v37 — Étend le garde-fou capacité aux UPDATE qui ramènent une
-- réservation en pending/accepted (anti-bypass via re-demande).
--
-- Contexte : la migration v29 a posé un trigger BEFORE INSERT qui empêche
-- d'ajouter une réservation pending/accepted si l'instance est pleine. Mais
-- ce trigger ne se déclenche pas sur les UPDATE. Or l'API /api/reservations
-- (suite PR #7) peut faire un UPDATE pour "re-demander" une réservation
-- refused/cancelled → ce chemin contournait le trigger et permettait à un
-- conducteur déjà plein de recevoir de nouvelles demandes.
--
-- Test de validation :
--   1. Instance places_total = 1, 1 résa accepted (pleine)
--   2. Créer une 2e résa refused
--   3. UPDATE la 2e résa : statut = 'pending'   → DOIT lever instance_full
--   4. UPDATE une résa pending : pickup_adresse = 'X' → OK (pas de transition de statut)
--
-- Idempotente : peut être relancée sans effet si déjà appliquée.

create or replace function check_instance_capacity_on_update()
returns trigger
language plpgsql
as $$
begin
  -- Ne vérifie que les transitions qui font REDEVENIR une résa active
  -- (refused/cancelled/completed/no_show → pending/accepted). Les transitions
  -- entre pending↔accepted sont neutres pour le compte (toutes deux décomptées
  -- par instance_places_restantes).
  if NEW.statut in ('pending', 'accepted')
     and OLD.statut not in ('pending', 'accepted')
  then
    if instance_places_restantes(NEW.trajet_instance_id) <= 0 then
      raise exception 'instance_full' using errcode = 'P0001';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_check_instance_capacity_update on reservations;
create trigger trg_check_instance_capacity_update
  before update of statut on reservations
  for each row
  execute function check_instance_capacity_on_update();
