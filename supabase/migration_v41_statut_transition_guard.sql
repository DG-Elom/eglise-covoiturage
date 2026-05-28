-- v41 — Trigger : interdit toute sortie d'un état TERMINAL (completed / no_show)
--                pour les utilisateurs normaux. Remplace v40 (qui était une
--                tautologie : son WITH CHECK listait tous les statuts de l'enum).
--
-- Contexte : la RLS WITH CHECK ne peut PAS comparer l'ancien et le nouveau
-- statut (pas d'accès à OLD) — elle ne sait donc pas contrôler les TRANSITIONS.
-- Un conducteur (ou un update direct forgé) pouvait "rouvrir" une course déjà
-- terminée, ex. completed/no_show -> pending via revert, ou markFinal abusif.
-- Seul un trigger BEFORE UPDATE (qui voit OLD et NEW) peut l'empêcher.
--
-- Portée volontairement MINIMALE et sûre : on interdit uniquement les sorties
-- des états terminaux completed/no_show. Aucun flux applicatif légitime ne sort
-- de ces états (vérifié : markFinal y entre, revert exige 'accepted' en source,
-- re-demande part de cancelled/refused). On ne contraint PAS les autres
-- transitions, pour ne casser aucun parcours réel.
--
-- ⚠️ Le trigger s'applique à TOUTES les écritures (contrairement à la RLS que le
-- service_role bypasse). On exempte donc explicitement :
--   - le service_role (jobs, auto-cancel cross-instance de /api/reservations/[id]/accept)
--   - les admins (corrections manuelles via le back-office)

create or replace function guard_reservation_statut_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Exemptions : service_role (jobs/cross-instance) et admins.
  if auth.role() = 'service_role' then
    return new;
  end if;
  if coalesce(is_admin(), false) then
    return new;
  end if;

  -- États terminaux : aucune transition sortante côté utilisateur.
  -- `is distinct from` (et non `<>`) : laisse passer un update idempotent
  -- completed->completed (double-clic markFinal) sans lever d'exception.
  if old.statut in ('completed', 'no_show')
     and new.statut is distinct from old.statut then
    raise exception 'transition interdite depuis un etat terminal (%)', old.statut
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_statut_transition on reservations;
create trigger trg_guard_statut_transition
  before update of statut on reservations
  for each row
  execute function guard_reservation_statut_transition();
