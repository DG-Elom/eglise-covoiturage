-- ============================================================
-- Migration v21 — Empty seat alert (trigger + pg_net)
-- Prérequis : v16 (subscriptions, thanks, user_stats)
--             extension pg_net activée dans Supabase
-- Idempotent : create or replace, drop if exists
-- ============================================================

-- pg_net est disponible en tant qu'extension Supabase (déjà activée par défaut).
-- Pas besoin de "create extension" ici car elle est gérée côté Supabase.

-- ============================================================
-- Fonction : notify_empty_seat
-- Appelée par le trigger AFTER UPDATE sur reservations.
-- Conditions vérifiées DANS le trigger (pas ici).
-- Invoque la Edge Function empty-seat-alert via pg_net.
-- ============================================================

create or replace function notify_empty_seat()
returns trigger
language plpgsql
security definer
as $$
declare
  v_function_url  text;
  v_service_role  text;
  v_trajet_instance_id uuid;
  v_sens          text;
  v_in_window     boolean;
begin
  -- Garde-fou : si la transition n'est pas accepted -> cancelled, on sort.
  if not (OLD.statut = 'accepted' and NEW.statut = 'cancelled') then
    return NEW;
  end if;

  -- Vérifie que le départ est dans la fenêtre [now, now+12h] (Europe/Paris)
  select exists (
    select 1
    from trajets_instances ti
    join trajets t on t.id = ti.trajet_id
    where ti.id = NEW.trajet_instance_id
      and (ti.date::date + t.heure_depart::time) at time zone 'Europe/Paris'
          < (now() at time zone 'Europe/Paris' + interval '12 hours')
      and (ti.date::date + t.heure_depart::time) at time zone 'Europe/Paris'
          > (now() at time zone 'Europe/Paris')
  ) into v_in_window;

  if not v_in_window then
    return NEW;
  end if;

  v_function_url := current_setting('app.supabase_url', true)
                    || '/functions/v1/empty-seat-alert';
  v_service_role := current_setting('app.service_role_key', true);

  v_trajet_instance_id := NEW.trajet_instance_id;
  v_sens               := NEW.sens::text;

  -- Appel asynchrone via pg_net (fire-and-forget)
  perform net.http_post(
    url     := v_function_url,
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_service_role
               ),
    body    := jsonb_build_object(
                 'trajet_instance_id', v_trajet_instance_id,
                 'sens',               v_sens
               )
  );

  return NEW;
end;
$$;

-- ============================================================
-- Trigger : trg_empty_seat_alert
-- Se déclenche AFTER UPDATE OF statut sur reservations,
-- uniquement si : OLD.statut = 'accepted' ET NEW.statut = 'cancelled'
-- ET l'instance de trajet démarre dans moins de 12h.
-- ============================================================

drop trigger if exists trg_empty_seat_alert on reservations;

create trigger trg_empty_seat_alert
after update of statut on reservations
for each row
when (OLD.statut = 'accepted' and NEW.statut = 'cancelled')
execute function notify_empty_seat();

-- ============================================================
-- Note d'activation
-- Les variables de configuration sont lues depuis postgresql.conf
-- via current_setting(). En Supabase, utiliser :
--
--   ALTER DATABASE postgres SET app.supabase_url = 'https://<ref>.supabase.co';
--   ALTER DATABASE postgres SET app.service_role_key = '<service-role-key>';
--
-- Ou passer les valeurs en dur dans la fonction (moins sécurisé).
-- ============================================================
