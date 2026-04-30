-- ============================================================
-- Migration v18 — Auto-création de réservations depuis les abonnements
-- Objets créés :
--   1. Fonction apply_subscription_to_instance(uuid, uuid) → uuid
--   2. Trigger trg_subscription_autores sur trajets_instances AFTER INSERT
-- Prérequis : v16 (subscriptions), v1+ (reservations, trajets_instances)
-- Idempotent : create or replace function, drop trigger if exists
-- ============================================================

-- ============================================================
-- 1. FONCTION apply_subscription_to_instance
--    Insère une réservation pending pour un abonnement + instance donnés.
--    Idempotente via ON CONFLICT DO NOTHING.
--    Retourne l'id de la résa créée, ou NULL si conflit.
-- ============================================================

create or replace function apply_subscription_to_instance(
  p_subscription_id uuid,
  p_instance_id     uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub         subscriptions%rowtype;
  v_instance    trajets_instances%rowtype;
  v_resa_id     uuid;
begin
  -- Récupère l'abonnement
  select * into v_sub
  from subscriptions
  where id = p_subscription_id;

  if not found then
    return null;
  end if;

  -- Ne traite que les abonnements actifs
  if not v_sub.actif then
    return null;
  end if;

  -- Récupère l'instance pour vérifier qu'elle correspond bien au trajet
  select * into v_instance
  from trajets_instances
  where id = p_instance_id
    and trajet_id = v_sub.trajet_id;

  if not found then
    return null;
  end if;

  -- Instance annulée par conducteur → pas de résa auto
  if v_instance.annule_par_conducteur then
    return null;
  end if;

  -- Insert avec gestion du conflit (passager_id, trajet_instance_id, sens)
  -- Si la résa existe déjà (peu importe son statut), on ne recrée pas.
  insert into reservations (
    passager_id,
    trajet_instance_id,
    sens,
    statut,
    pickup_adresse,
    pickup_position
  )
  values (
    v_sub.passager_id,
    p_instance_id,
    v_sub.sens,
    'pending',
    v_sub.pickup_adresse,
    v_sub.pickup_position
  )
  on conflict (passager_id, trajet_instance_id, sens) do nothing
  returning id into v_resa_id;

  return v_resa_id;
end;
$$;


-- ============================================================
-- 2. TRIGGER sur trajets_instances AFTER INSERT
--    Pour chaque nouvelle instance, parcourt les abonnements actifs
--    du trajet et appelle apply_subscription_to_instance.
-- ============================================================

create or replace function trg_fn_subscription_autores()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub subscriptions%rowtype;
begin
  for v_sub in
    select *
    from subscriptions
    where trajet_id = new.trajet_id
      and actif = true
  loop
    perform apply_subscription_to_instance(v_sub.id, new.id);
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_subscription_autores on trajets_instances;
create trigger trg_subscription_autores
  after insert on trajets_instances
  for each row
  execute function trg_fn_subscription_autores();


-- ============================================================
-- 3. BACKFILL (optionnel)
--    Pour les instances futures déjà existantes, crée les réservations
--    manquantes pour chaque abonnement actif.
--
--    À exécuter manuellement après déploiement si nécessaire.
--    Décommenter le bloc ci-dessous pour l'appliquer.
-- ============================================================

-- do $$
-- declare
--   v_sub  subscriptions%rowtype;
--   v_inst trajets_instances%rowtype;
-- begin
--   for v_sub in select * from subscriptions where actif = true loop
--     for v_inst in
--       select ti.*
--       from trajets_instances ti
--       where ti.trajet_id = v_sub.trajet_id
--         and ti.date >= current_date
--         and ti.annule_par_conducteur = false
--         and not exists (
--           select 1 from reservations r
--           where r.passager_id          = v_sub.passager_id
--             and r.trajet_instance_id   = ti.id
--             and r.sens                 = v_sub.sens
--         )
--     loop
--       perform apply_subscription_to_instance(v_sub.id, v_inst.id);
--     end loop;
--   end loop;
-- end;
-- $$;
