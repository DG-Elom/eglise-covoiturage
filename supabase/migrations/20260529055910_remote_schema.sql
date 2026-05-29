


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."role_user" AS ENUM (
    'conducteur',
    'passager',
    'les_deux'
);


ALTER TYPE "public"."role_user" OWNER TO "postgres";


CREATE TYPE "public"."sens_reservation" AS ENUM (
    'aller',
    'retour'
);


ALTER TYPE "public"."sens_reservation" OWNER TO "postgres";


CREATE TYPE "public"."sens_trajet" AS ENUM (
    'aller',
    'retour',
    'aller_retour'
);


ALTER TYPE "public"."sens_trajet" OWNER TO "postgres";


CREATE TYPE "public"."statut_reservation" AS ENUM (
    'pending',
    'accepted',
    'refused',
    'cancelled',
    'completed',
    'no_show'
);


ALTER TYPE "public"."statut_reservation" OWNER TO "postgres";


CREATE TYPE "public"."statut_signalement" AS ENUM (
    'ouvert',
    'en_cours',
    'traite',
    'rejete'
);


ALTER TYPE "public"."statut_signalement" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_subscription_to_instance"("p_subscription_id" "uuid", "p_instance_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."apply_subscription_to_instance"("p_subscription_id" "uuid", "p_instance_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_refuse_when_full"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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


ALTER FUNCTION "public"."auto_refuse_when_full"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_instance_capacity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if instance_places_restantes(NEW.trajet_instance_id) <= 0 then
    raise exception 'instance_full' using errcode = 'P0001';
  end if;
  return NEW;
end;
$$;


ALTER FUNCTION "public"."check_instance_capacity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_instance_capacity_on_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."check_instance_capacity_on_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generer_trajets_instances"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  insert into trajets_instances (trajet_id, date)
  select t.id, d::date
  from trajets t
  join cultes c on c.id = t.culte_id
  cross join generate_series(current_date, current_date + interval '30 days', '1 day') d
  where t.actif = true
    and extract(dow from d) = c.jour_semaine
  on conflict (trajet_id, date) do nothing;
end;
$$;


ALTER FUNCTION "public"."generer_trajets_instances"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_reservation_statut_transition"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."guard_reservation_statut_transition"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."instance_places_restantes"("p_instance_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE
    AS $$
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


ALTER FUNCTION "public"."instance_places_restantes"("p_instance_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_empty_seat"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_in_window boolean;
begin
  if not (OLD.statut = 'accepted' and NEW.statut = 'cancelled') then
    return NEW;
  end if;
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
  if not v_in_window then return NEW; end if;
  perform net.http_post(
    url     := 'http://127.0.0.1:54321/functions/v1/empty-seat-alert',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer REDACTED_NOT_A_REAL_KEY'
    ),
    body    := jsonb_build_object(
      'trajet_instance_id', NEW.trajet_instance_id,
      'sens', NEW.sens::text
    )
  );
  return NEW;
end;
$$;


ALTER FUNCTION "public"."notify_empty_seat"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_demandes_passager_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin new.updated_at = now(); return new; end;
$$;


ALTER FUNCTION "public"."set_demandes_passager_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trajet_detour_moyen_km"("p_trajet_id" "uuid") RETURNS numeric
    LANGUAGE "sql" STABLE
    AS $$
  select round(
    avg(st_distance(t.trajet_ligne, r.pickup_position) / 1000.0)::numeric,
    2
  )
  from trajets t
  join trajets_instances ti on ti.trajet_id = t.id
  join reservations r on r.trajet_instance_id = ti.id
  where t.id = p_trajet_id
    and t.trajet_ligne is not null
    and r.pickup_position is not null
    and r.statut in ('accepted', 'completed');
$$;


ALTER FUNCTION "public"."trajet_detour_moyen_km"("p_trajet_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trajets_compatibles"("p_passager_lat" double precision, "p_passager_lng" double precision, "p_culte_id" "uuid", "p_sens" "public"."sens_reservation", "p_date" "date") RETURNS TABLE("trajet_id" "uuid", "trajet_instance_id" "uuid", "conducteur_id" "uuid", "conducteur_prenom" "text", "conducteur_photo_url" "text", "depart_adresse" "text", "heure_depart" time without time zone, "places_restantes" integer, "places_total" integer, "detour_km" numeric, "score" numeric, "dans_zone" boolean)
    LANGUAGE "plpgsql" STABLE
    AS $$
declare
  pos_passager geography;
begin
  pos_passager := st_makepoint(p_passager_lng, p_passager_lat)::geography;
  return query
  with instances as (
    select ti.id as instance_id, t.*
    from trajets t
    join trajets_instances ti on ti.trajet_id = t.id
    where t.actif = true
      and t.culte_id = p_culte_id
      and (t.sens::text = p_sens::text or t.sens = 'aller_retour')
      and ti.date = p_date
      and ti.annule_par_conducteur = false
  ),
  reservees as (
    select r.trajet_instance_id as ti_id, count(*) as occupees
    from reservations r
    where r.statut in ('accepted', 'pending')
    group by r.trajet_instance_id
  )
  select
    i.id,
    i.instance_id,
    i.conducteur_id,
    p.prenom,
    p.photo_url,
    i.depart_adresse,
    i.heure_depart,
    (i.places_total - coalesce(rv.occupees, 0))::int,
    i.places_total::int,
    round((st_distance(i.trajet_ligne, pos_passager) / 1000)::numeric, 2),
    round((1.0 / (1.0 + st_distance(i.trajet_ligne, pos_passager) / 1000))::numeric, 3),
    (st_distance(i.trajet_ligne, pos_passager) <= (i.rayon_detour_km * 1000))
  from instances i
  join profiles p on p.id = i.conducteur_id
  left join reservees rv on rv.ti_id = i.instance_id
  where (i.places_total - coalesce(rv.occupees, 0)) > 0
    and p.suspended = false
  order by dans_zone desc, st_distance(i.trajet_ligne, pos_passager) asc
  limit 20;
end;
$$;


ALTER FUNCTION "public"."trajets_compatibles"("p_passager_lat" double precision, "p_passager_lng" double precision, "p_culte_id" "uuid", "p_sens" "public"."sens_reservation", "p_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_fn_subscription_autores"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."trg_fn_subscription_autores"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_trajet_ligne"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  eglise_pos geography;
begin
  if new.trajet_ligne is null then
    select position into eglise_pos from eglise limit 1;
    new.trajet_ligne := st_makeline(
      new.depart_position::geometry,
      eglise_pos::geometry
    )::geography;
  end if;
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_trajet_ligne"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_accepted_on_instance"("p_instance" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from reservations
    where trajet_instance_id = p_instance
      and passager_id = auth.uid()
      and statut = 'accepted'
  );
$$;


ALTER FUNCTION "public"."user_has_accepted_on_instance"("p_instance" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admin_actions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "admin_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "cible_type" "text",
    "cible_id" "uuid",
    "details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bug_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auteur_id" "uuid" NOT NULL,
    "description" "text" NOT NULL,
    "categorie" "text" DEFAULT 'autre'::"text" NOT NULL,
    "page_url" "text",
    "user_agent" "text",
    "statut" "text" DEFAULT 'ouvert'::"text" NOT NULL,
    "note_admin" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bug_reports_categorie_check" CHECK (("categorie" = ANY (ARRAY['crash'::"text", 'affichage'::"text", 'fonctionnalite'::"text", 'performance'::"text", 'autre'::"text"]))),
    CONSTRAINT "bug_reports_statut_check" CHECK (("statut" = ANY (ARRAY['ouvert'::"text", 'en_cours'::"text", 'resolu'::"text", 'ferme'::"text"])))
);


ALTER TABLE "public"."bug_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cultes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "libelle" "text" NOT NULL,
    "jour_semaine" smallint NOT NULL,
    "heure" time without time zone NOT NULL,
    "actif" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cultes_jour_semaine_check" CHECK ((("jour_semaine" >= 0) AND ("jour_semaine" <= 6)))
);


ALTER TABLE "public"."cultes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."demandes_passager" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "passager_id" "uuid" NOT NULL,
    "culte_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "sens" "text" NOT NULL,
    "pickup_adresse" "text" NOT NULL,
    "pickup_position" "public"."geography"(Point,4326) NOT NULL,
    "notes" "text",
    "statut" "text" DEFAULT 'active'::"text" NOT NULL,
    "matched_trajet_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "demandes_passager_sens_check" CHECK (("sens" = ANY (ARRAY['aller'::"text", 'retour'::"text"]))),
    CONSTRAINT "demandes_passager_statut_check" CHECK (("statut" = ANY (ARRAY['active'::"text", 'matched'::"text", 'annulee'::"text"])))
);


ALTER TABLE "public"."demandes_passager" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."eglise" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "nom" "text" NOT NULL,
    "adresse" "text" NOT NULL,
    "position" "public"."geography"(Point,4326) NOT NULL
);


ALTER TABLE "public"."eglise" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."engagement_log" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "engagement_log_kind_check" CHECK (("kind" = ANY (ARRAY['engage_d2'::"text", 'engage_d7'::"text", 'engage_d14'::"text", 'engage_conducteur_d2'::"text", 'engage_conducteur_d7'::"text", 'engage_conducteur_d14'::"text"])))
);


ALTER TABLE "public"."engagement_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_alerts_log" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "conducteur_id" "uuid" NOT NULL,
    "cluster_key" "text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."group_alerts_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "reservation_id" "uuid",
    "expediteur_id" "uuid" NOT NULL,
    "destinataire_id" "uuid" NOT NULL,
    "contenu" "text" NOT NULL,
    "lu" boolean DEFAULT false NOT NULL,
    "envoye_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "messages_contenu_check" CHECK (("length"("contenu") <= 2000))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_preferences" (
    "user_id" "uuid" NOT NULL,
    "reminder_2h" boolean DEFAULT true NOT NULL,
    "imminent_departure" boolean DEFAULT true NOT NULL,
    "new_request" boolean DEFAULT true NOT NULL,
    "decision" boolean DEFAULT true NOT NULL,
    "trajet_cancelled" boolean DEFAULT true NOT NULL,
    "new_message" boolean DEFAULT true NOT NULL,
    "thanks_received" boolean DEFAULT true NOT NULL,
    "weekly_summary_admin" boolean DEFAULT true NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "engagement_relance" boolean DEFAULT true NOT NULL,
    "sms_enabled" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."notification_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "nom" "text" NOT NULL,
    "prenom" "text" NOT NULL,
    "telephone" "text" NOT NULL,
    "photo_url" "text",
    "role" "public"."role_user" DEFAULT 'passager'::"public"."role_user" NOT NULL,
    "voiture_modele" "text",
    "voiture_couleur" "text",
    "voiture_plaque" "text",
    "charte_acceptee_at" timestamp with time zone NOT NULL,
    "is_admin" boolean DEFAULT false NOT NULL,
    "suspended" boolean DEFAULT false NOT NULL,
    "suspended_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "available_now" boolean DEFAULT false NOT NULL,
    "available_until" timestamp with time zone,
    "emergency_contact_name" "text",
    "emergency_contact_phone" "text",
    "voiture_photo_url" "text",
    "bio" "text",
    CONSTRAINT "profiles_bio_length" CHECK ((("bio" IS NULL) OR ("length"("bio") <= 280)))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reservations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "passager_id" "uuid" NOT NULL,
    "trajet_instance_id" "uuid" NOT NULL,
    "sens" "public"."sens_reservation" NOT NULL,
    "statut" "public"."statut_reservation" DEFAULT 'pending'::"public"."statut_reservation" NOT NULL,
    "pickup_adresse" "text" NOT NULL,
    "pickup_position" "public"."geography"(Point,4326) NOT NULL,
    "motif_refus" "text",
    "demande_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "traitee_le" timestamp with time zone,
    "cancelled_le" timestamp with time zone
);


ALTER TABLE "public"."reservations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trajets" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "conducteur_id" "uuid" NOT NULL,
    "culte_id" "uuid" NOT NULL,
    "depart_adresse" "text" NOT NULL,
    "depart_position" "public"."geography"(Point,4326) NOT NULL,
    "trajet_ligne" "public"."geography"(LineString,4326),
    "sens" "public"."sens_trajet" NOT NULL,
    "places_total" smallint NOT NULL,
    "rayon_detour_km" numeric(3,1) DEFAULT 1.5 NOT NULL,
    "actif" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "heure_depart" time without time zone DEFAULT '08:00:00'::time without time zone NOT NULL,
    CONSTRAINT "trajets_places_total_check" CHECK ((("places_total" >= 1) AND ("places_total" <= 8))),
    CONSTRAINT "trajets_rayon_detour_km_check" CHECK ((("rayon_detour_km" >= 0.5) AND ("rayon_detour_km" <= 10.0)))
);


ALTER TABLE "public"."trajets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trajets_instances" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "trajet_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "annule_par_conducteur" boolean DEFAULT false NOT NULL,
    "motif_annulation" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."trajets_instances" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."profiles_safe" WITH ("security_invoker"='true') AS
 SELECT "id",
    "nom",
    "prenom",
    "photo_url",
    "role",
    "voiture_modele",
    "voiture_couleur",
    "voiture_plaque",
    "available_now",
    "available_until",
    "charte_acceptee_at",
    "is_admin",
    "suspended",
    "bio",
    "created_at",
    "updated_at",
        CASE
            WHEN ("id" = "auth"."uid"()) THEN "telephone"
            WHEN "public"."is_admin"() THEN "telephone"
            WHEN (EXISTS ( SELECT 1
               FROM (("public"."reservations" "r"
                 JOIN "public"."trajets_instances" "ti" ON (("ti"."id" = "r"."trajet_instance_id")))
                 JOIN "public"."trajets" "t" ON (("t"."id" = "ti"."trajet_id")))
              WHERE (("r"."statut" = 'accepted'::"public"."statut_reservation") AND ((("r"."passager_id" = "auth"."uid"()) AND ("t"."conducteur_id" = "p"."id")) OR (("t"."conducteur_id" = "auth"."uid"()) AND ("r"."passager_id" = "p"."id")))))) THEN "telephone"
            ELSE NULL::"text"
        END AS "telephone",
        CASE
            WHEN (("id" = "auth"."uid"()) OR "public"."is_admin"()) THEN "emergency_contact_name"
            ELSE NULL::"text"
        END AS "emergency_contact_name",
        CASE
            WHEN (("id" = "auth"."uid"()) OR "public"."is_admin"()) THEN "emergency_contact_phone"
            ELSE NULL::"text"
        END AS "emergency_contact_phone"
   FROM "public"."profiles" "p";


ALTER VIEW "public"."profiles_safe" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reminders_log" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "trajet_instance_id" "uuid",
    "recipient_id" "uuid",
    "kind" "text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."reminders_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saved_places" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "icon" "text" DEFAULT 'pin'::"text",
    "adresse" "text" NOT NULL,
    "position" "public"."geography"(Point,4326) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "lat" double precision GENERATED ALWAYS AS ("public"."st_y"(("position")::"public"."geometry")) STORED,
    "lng" double precision GENERATED ALWAYS AS ("public"."st_x"(("position")::"public"."geometry")) STORED
);


ALTER TABLE "public"."saved_places" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."signalements" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "auteur_id" "uuid" NOT NULL,
    "cible_id" "uuid" NOT NULL,
    "reservation_id" "uuid",
    "motif" "text" NOT NULL,
    "description" "text",
    "statut" "public"."statut_signalement" DEFAULT 'ouvert'::"public"."statut_signalement" NOT NULL,
    "ia_gravite" smallint,
    "ia_action_suggeree" "text",
    "traite_par" "uuid",
    "traite_le" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "signalements_ia_gravite_check" CHECK ((("ia_gravite" >= 1) AND ("ia_gravite" <= 5)))
);


ALTER TABLE "public"."signalements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sms_campaigns" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "auteur_id" "uuid" NOT NULL,
    "target_filter" "text" NOT NULL,
    "target_label" "text",
    "prompt_admin" "text",
    "ton" "text",
    "message" "text" NOT NULL,
    "n_destinataires" integer DEFAULT 0 NOT NULL,
    "n_envoyes" integer DEFAULT 0 NOT NULL,
    "n_skipped" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sms_campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sms_log" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "kind" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "dedup_key" "text" NOT NULL,
    "provider" "text" DEFAULT 'brevo'::"text" NOT NULL,
    "provider_message_id" "text",
    "status" "text" DEFAULT 'sent'::"text" NOT NULL,
    "error" "text",
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sms_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "passager_id" "uuid" NOT NULL,
    "trajet_id" "uuid" NOT NULL,
    "sens" "public"."sens_reservation" NOT NULL,
    "pickup_adresse" "text" NOT NULL,
    "pickup_position" "public"."geography"(Point,4326) NOT NULL,
    "actif" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."thanks" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "auteur_id" "uuid" NOT NULL,
    "destinataire_id" "uuid" NOT NULL,
    "reservation_id" "uuid",
    "message" "text" NOT NULL,
    "is_public" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "thanks_message_check" CHECK ((("length"("message") >= 1) AND ("length"("message") <= 500)))
);


ALTER TABLE "public"."thanks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."track_positions" (
    "trajet_instance_id" "uuid" NOT NULL,
    "conducteur_id" "uuid" NOT NULL,
    "lat" double precision NOT NULL,
    "lng" double precision NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."track_positions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_ratings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reservation_id" "uuid" NOT NULL,
    "rater_id" "uuid" NOT NULL,
    "rated_id" "uuid" NOT NULL,
    "stars" smallint NOT NULL,
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "trip_ratings_comment_check" CHECK (("length"("comment") <= 500)),
    CONSTRAINT "trip_ratings_stars_check" CHECK ((("stars" >= 1) AND ("stars" <= 5)))
);


ALTER TABLE "public"."trip_ratings" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."user_stats" WITH ("security_invoker"='true') AS
 SELECT "p"."id" AS "user_id",
    "count"(DISTINCT
        CASE
            WHEN (("ti"."date" < CURRENT_DATE) AND ("r_cond"."statut" = ANY (ARRAY['accepted'::"public"."statut_reservation", 'completed'::"public"."statut_reservation"]))) THEN "ti"."id"
            ELSE NULL::"uuid"
        END) AS "total_trajets_conducteur",
    "count"(
        CASE
            WHEN ("r_cond"."statut" = ANY (ARRAY['accepted'::"public"."statut_reservation", 'completed'::"public"."statut_reservation"])) THEN 1
            ELSE NULL::integer
        END) AS "total_passagers_transportes",
    "count"(
        CASE
            WHEN ("r_pass"."statut" = 'completed'::"public"."statut_reservation") THEN 1
            ELSE NULL::integer
        END) AS "total_trajets_passager",
    COALESCE("sum"(
        CASE
            WHEN (("ti30"."date" >= (CURRENT_DATE - '30 days'::interval)) AND ("ti30"."date" < CURRENT_DATE)) THEN ("t30"."places_total")::integer
            ELSE 0
        END), (0)::bigint) AS "places_offertes_30j",
    "round"("avg"("tr"."stars"), 2) AS "note_moyenne",
    "count"(DISTINCT
        CASE
            WHEN (("date_trunc"('month'::"text", ("ti"."date")::timestamp with time zone) = "date_trunc"('month'::"text", (CURRENT_DATE)::timestamp with time zone)) AND ("r_cond"."statut" = ANY (ARRAY['accepted'::"public"."statut_reservation", 'completed'::"public"."statut_reservation", 'pending'::"public"."statut_reservation"]))) THEN "ti"."id"
            ELSE NULL::"uuid"
        END) AS "mois_courant_trajets"
   FROM ((((((("public"."profiles" "p"
     LEFT JOIN "public"."trajets" "t_cond" ON (("t_cond"."conducteur_id" = "p"."id")))
     LEFT JOIN "public"."trajets_instances" "ti" ON (("ti"."trajet_id" = "t_cond"."id")))
     LEFT JOIN "public"."reservations" "r_cond" ON (("r_cond"."trajet_instance_id" = "ti"."id")))
     LEFT JOIN "public"."reservations" "r_pass" ON (("r_pass"."passager_id" = "p"."id")))
     LEFT JOIN "public"."trajets_instances" "ti30" ON ((("ti30"."trajet_id" = "t_cond"."id") AND ("ti30"."date" >= (CURRENT_DATE - '30 days'::interval)) AND ("ti30"."date" < CURRENT_DATE))))
     LEFT JOIN "public"."trajets" "t30" ON (("t30"."id" = "ti30"."trajet_id")))
     LEFT JOIN "public"."trip_ratings" "tr" ON (("tr"."rated_id" = "p"."id")))
  GROUP BY "p"."id";


ALTER VIEW "public"."user_stats" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."user_top_score" WITH ("security_invoker"='true') AS
 WITH "mois" AS (
         SELECT "date_trunc"('month'::"text", (CURRENT_DATE)::timestamp with time zone) AS "debut",
            ("date_trunc"('month'::"text", (CURRENT_DATE)::timestamp with time zone) + '1 mon'::interval) AS "fin"
        ), "trajets_mois" AS (
         SELECT "t"."conducteur_id",
            "count"(DISTINCT "t"."id") AS "nb_trajets_proposes"
           FROM ("public"."trajets" "t"
             CROSS JOIN "mois")
          WHERE (("t"."created_at" >= "mois"."debut") AND ("t"."created_at" < "mois"."fin"))
          GROUP BY "t"."conducteur_id"
        ), "demandes_recues" AS (
         SELECT "t"."conducteur_id",
            "count"(*) AS "nb_demandes",
            "sum"(
                CASE
                    WHEN ("r"."statut" = 'accepted'::"public"."statut_reservation") THEN 1
                    ELSE 0
                END) AS "nb_acceptees",
            "sum"(
                CASE
                    WHEN ("r"."statut" = ANY (ARRAY['accepted'::"public"."statut_reservation", 'completed'::"public"."statut_reservation"])) THEN 1
                    ELSE 0
                END) AS "nb_passagers_ok"
           FROM ((("public"."reservations" "r"
             JOIN "public"."trajets_instances" "ti" ON (("ti"."id" = "r"."trajet_instance_id")))
             JOIN "public"."trajets" "t" ON (("t"."id" = "ti"."trajet_id")))
             CROSS JOIN "mois")
          WHERE (("r"."demande_le" >= "mois"."debut") AND ("r"."demande_le" < "mois"."fin"))
          GROUP BY "t"."conducteur_id"
        ), "detour" AS (
         SELECT "t"."conducteur_id",
            COALESCE("sum"(("public"."st_distance"("t"."trajet_ligne", "r"."pickup_position") / (1000.0)::double precision)), (0)::double precision) AS "km_detour"
           FROM ((("public"."reservations" "r"
             JOIN "public"."trajets_instances" "ti" ON (("ti"."id" = "r"."trajet_instance_id")))
             JOIN "public"."trajets" "t" ON (("t"."id" = "ti"."trajet_id")))
             CROSS JOIN "mois")
          WHERE (("r"."statut" = ANY (ARRAY['accepted'::"public"."statut_reservation", 'completed'::"public"."statut_reservation"])) AND ("r"."demande_le" >= "mois"."debut") AND ("r"."demande_le" < "mois"."fin") AND ("t"."trajet_ligne" IS NOT NULL))
          GROUP BY "t"."conducteur_id"
        ), "reactivite" AS (
         SELECT "t"."conducteur_id",
            "percentile_cont"((0.5)::double precision) WITHIN GROUP (ORDER BY (((EXTRACT(epoch FROM ("r"."traitee_le" - "r"."demande_le")) / (60)::numeric))::double precision)) AS "median_minutes_reponse"
           FROM ((("public"."reservations" "r"
             JOIN "public"."trajets_instances" "ti" ON (("ti"."id" = "r"."trajet_instance_id")))
             JOIN "public"."trajets" "t" ON (("t"."id" = "ti"."trajet_id")))
             CROSS JOIN "mois")
          WHERE (("r"."traitee_le" IS NOT NULL) AND ("r"."demande_le" >= "mois"."debut") AND ("r"."demande_le" < "mois"."fin"))
          GROUP BY "t"."conducteur_id"
        )
 SELECT "p"."id" AS "user_id",
    COALESCE("tm"."nb_trajets_proposes", (0)::bigint) AS "trajets_proposes",
    COALESCE("dr"."nb_demandes", (0)::bigint) AS "demandes_recues",
    COALESCE("dr"."nb_acceptees", (0)::bigint) AS "demandes_acceptees",
    COALESCE("dr"."nb_passagers_ok", (0)::bigint) AS "passagers_transportes",
    (COALESCE("d"."km_detour", (0)::double precision))::numeric(10,2) AS "km_detour_consenti",
    "re"."median_minutes_reponse",
        CASE
            WHEN (COALESCE("dr"."nb_demandes", (0)::bigint) = 0) THEN NULL::double precision
            ELSE ((COALESCE("dr"."nb_acceptees", (0)::bigint))::double precision / ("dr"."nb_demandes")::double precision)
        END AS "taux_acceptation"
   FROM (((("public"."profiles" "p"
     LEFT JOIN "trajets_mois" "tm" ON (("tm"."conducteur_id" = "p"."id")))
     LEFT JOIN "demandes_recues" "dr" ON (("dr"."conducteur_id" = "p"."id")))
     LEFT JOIN "detour" "d" ON (("d"."conducteur_id" = "p"."id")))
     LEFT JOIN "reactivite" "re" ON (("re"."conducteur_id" = "p"."id")))
  WHERE (("p"."suspended" = false) AND ("p"."role" = ANY (ARRAY['conducteur'::"public"."role_user", 'les_deux'::"public"."role_user"])));


ALTER VIEW "public"."user_top_score" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_actions"
    ADD CONSTRAINT "admin_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bug_reports"
    ADD CONSTRAINT "bug_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cultes"
    ADD CONSTRAINT "cultes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."demandes_passager"
    ADD CONSTRAINT "demandes_passager_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."eglise"
    ADD CONSTRAINT "eglise_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."engagement_log"
    ADD CONSTRAINT "engagement_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."engagement_log"
    ADD CONSTRAINT "engagement_log_user_id_kind_key" UNIQUE ("user_id", "kind");



ALTER TABLE ONLY "public"."group_alerts_log"
    ADD CONSTRAINT "group_alerts_log_conducteur_id_cluster_key_key" UNIQUE ("conducteur_id", "cluster_key");



ALTER TABLE ONLY "public"."group_alerts_log"
    ADD CONSTRAINT "group_alerts_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_endpoint_key" UNIQUE ("user_id", "endpoint");



ALTER TABLE ONLY "public"."reminders_log"
    ADD CONSTRAINT "reminders_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reminders_log"
    ADD CONSTRAINT "reminders_log_trajet_instance_id_recipient_id_kind_key" UNIQUE ("trajet_instance_id", "recipient_id", "kind");



ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_passager_id_trajet_instance_id_sens_key" UNIQUE ("passager_id", "trajet_instance_id", "sens");



ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_places"
    ADD CONSTRAINT "saved_places_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."signalements"
    ADD CONSTRAINT "signalements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sms_campaigns"
    ADD CONSTRAINT "sms_campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sms_log"
    ADD CONSTRAINT "sms_log_dedup_key_key" UNIQUE ("dedup_key");



ALTER TABLE ONLY "public"."sms_log"
    ADD CONSTRAINT "sms_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_passager_id_trajet_id_sens_key" UNIQUE ("passager_id", "trajet_id", "sens");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."thanks"
    ADD CONSTRAINT "thanks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."track_positions"
    ADD CONSTRAINT "track_positions_pkey" PRIMARY KEY ("trajet_instance_id");



ALTER TABLE ONLY "public"."trajets_instances"
    ADD CONSTRAINT "trajets_instances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trajets_instances"
    ADD CONSTRAINT "trajets_instances_trajet_id_date_key" UNIQUE ("trajet_id", "date");



ALTER TABLE ONLY "public"."trajets"
    ADD CONSTRAINT "trajets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_ratings"
    ADD CONSTRAINT "trip_ratings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_ratings"
    ADD CONSTRAINT "trip_ratings_reservation_id_rater_id_key" UNIQUE ("reservation_id", "rater_id");



CREATE INDEX "idx_bug_reports_auteur" ON "public"."bug_reports" USING "btree" ("auteur_id");



CREATE INDEX "idx_bug_reports_created_at" ON "public"."bug_reports" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_bug_reports_statut" ON "public"."bug_reports" USING "btree" ("statut");



CREATE INDEX "idx_demandes_passager_active_date" ON "public"."demandes_passager" USING "btree" ("date") WHERE ("statut" = 'active'::"text");



CREATE INDEX "idx_demandes_passager_passager" ON "public"."demandes_passager" USING "btree" ("passager_id");



CREATE INDEX "idx_demandes_passager_position" ON "public"."demandes_passager" USING "gist" ("pickup_position");



CREATE INDEX "idx_engagement_log_user" ON "public"."engagement_log" USING "btree" ("user_id", "sent_at" DESC);



CREATE INDEX "idx_group_alerts_cluster" ON "public"."group_alerts_log" USING "btree" ("cluster_key");



CREATE INDEX "idx_group_alerts_conducteur" ON "public"."group_alerts_log" USING "btree" ("conducteur_id");



CREATE INDEX "idx_instances_date" ON "public"."trajets_instances" USING "btree" ("date");



CREATE INDEX "idx_messages_destinataire" ON "public"."messages" USING "btree" ("destinataire_id", "lu") WHERE ("lu" = false);



CREATE INDEX "idx_messages_reservation" ON "public"."messages" USING "btree" ("reservation_id");



CREATE INDEX "idx_profiles_role" ON "public"."profiles" USING "btree" ("role") WHERE ("suspended" = false);



CREATE INDEX "idx_push_subscriptions_user" ON "public"."push_subscriptions" USING "btree" ("user_id");



CREATE INDEX "idx_reminders_log_instance" ON "public"."reminders_log" USING "btree" ("trajet_instance_id");



CREATE INDEX "idx_reminders_log_recipient" ON "public"."reminders_log" USING "btree" ("recipient_id");



CREATE INDEX "idx_reservations_instance" ON "public"."reservations" USING "btree" ("trajet_instance_id");



CREATE INDEX "idx_reservations_passager" ON "public"."reservations" USING "btree" ("passager_id");



CREATE INDEX "idx_reservations_statut" ON "public"."reservations" USING "btree" ("statut");



CREATE INDEX "idx_saved_places_lat_lng" ON "public"."saved_places" USING "btree" ("lat", "lng");



CREATE INDEX "idx_saved_places_user" ON "public"."saved_places" USING "btree" ("user_id");



CREATE INDEX "idx_signalements_statut" ON "public"."signalements" USING "btree" ("statut");



CREATE INDEX "idx_sms_campaigns_auteur" ON "public"."sms_campaigns" USING "btree" ("auteur_id");



CREATE INDEX "idx_sms_campaigns_created_at" ON "public"."sms_campaigns" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_sms_log_kind" ON "public"."sms_log" USING "btree" ("kind");



CREATE INDEX "idx_sms_log_sent_at" ON "public"."sms_log" USING "btree" ("sent_at" DESC);



CREATE INDEX "idx_sms_log_user" ON "public"."sms_log" USING "btree" ("user_id");



CREATE INDEX "idx_subscriptions_trajet_actif" ON "public"."subscriptions" USING "btree" ("trajet_id") WHERE ("actif" = true);



CREATE INDEX "idx_thanks_destinataire" ON "public"."thanks" USING "btree" ("destinataire_id", "created_at" DESC);



CREATE INDEX "idx_trajets_conducteur" ON "public"."trajets" USING "btree" ("conducteur_id");



CREATE INDEX "idx_trajets_culte" ON "public"."trajets" USING "btree" ("culte_id") WHERE "actif";



CREATE INDEX "idx_trajets_depart" ON "public"."trajets" USING "gist" ("depart_position");



CREATE INDEX "idx_trajets_geo" ON "public"."trajets" USING "gist" ("trajet_ligne");



CREATE INDEX "idx_trip_ratings_rated" ON "public"."trip_ratings" USING "btree" ("rated_id");



CREATE INDEX "track_positions_updated_at_idx" ON "public"."track_positions" USING "btree" ("updated_at" DESC);



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."notification_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_auto_refuse_when_full" AFTER UPDATE OF "statut" ON "public"."reservations" FOR EACH ROW EXECUTE FUNCTION "public"."auto_refuse_when_full"();



CREATE OR REPLACE TRIGGER "trg_check_instance_capacity" BEFORE INSERT ON "public"."reservations" FOR EACH ROW WHEN (("new"."statut" = ANY (ARRAY['pending'::"public"."statut_reservation", 'accepted'::"public"."statut_reservation"]))) EXECUTE FUNCTION "public"."check_instance_capacity"();



CREATE OR REPLACE TRIGGER "trg_check_instance_capacity_update" BEFORE UPDATE OF "statut" ON "public"."reservations" FOR EACH ROW EXECUTE FUNCTION "public"."check_instance_capacity_on_update"();



CREATE OR REPLACE TRIGGER "trg_demandes_passager_updated_at" BEFORE UPDATE ON "public"."demandes_passager" FOR EACH ROW EXECUTE FUNCTION "public"."set_demandes_passager_updated_at"();



CREATE OR REPLACE TRIGGER "trg_empty_seat_alert" AFTER UPDATE OF "statut" ON "public"."reservations" FOR EACH ROW WHEN ((("old"."statut" = 'accepted'::"public"."statut_reservation") AND ("new"."statut" = 'cancelled'::"public"."statut_reservation"))) EXECUTE FUNCTION "public"."notify_empty_seat"();



CREATE OR REPLACE TRIGGER "trg_guard_statut_transition" BEFORE UPDATE OF "statut" ON "public"."reservations" FOR EACH ROW EXECUTE FUNCTION "public"."guard_reservation_statut_transition"();



CREATE OR REPLACE TRIGGER "trg_profiles_updated" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_subscription_autores" AFTER INSERT ON "public"."trajets_instances" FOR EACH ROW EXECUTE FUNCTION "public"."trg_fn_subscription_autores"();



CREATE OR REPLACE TRIGGER "trg_trajet_ligne" BEFORE INSERT OR UPDATE OF "depart_position" ON "public"."trajets" FOR EACH ROW EXECUTE FUNCTION "public"."update_trajet_ligne"();



ALTER TABLE ONLY "public"."admin_actions"
    ADD CONSTRAINT "admin_actions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."bug_reports"
    ADD CONSTRAINT "bug_reports_auteur_id_fkey" FOREIGN KEY ("auteur_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."demandes_passager"
    ADD CONSTRAINT "demandes_passager_culte_id_fkey" FOREIGN KEY ("culte_id") REFERENCES "public"."cultes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."demandes_passager"
    ADD CONSTRAINT "demandes_passager_matched_trajet_id_fkey" FOREIGN KEY ("matched_trajet_id") REFERENCES "public"."trajets"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."demandes_passager"
    ADD CONSTRAINT "demandes_passager_passager_id_fkey" FOREIGN KEY ("passager_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."engagement_log"
    ADD CONSTRAINT "engagement_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_alerts_log"
    ADD CONSTRAINT "group_alerts_log_conducteur_id_fkey" FOREIGN KEY ("conducteur_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_destinataire_id_fkey" FOREIGN KEY ("destinataire_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_expediteur_id_fkey" FOREIGN KEY ("expediteur_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reminders_log"
    ADD CONSTRAINT "reminders_log_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reminders_log"
    ADD CONSTRAINT "reminders_log_trajet_instance_id_fkey" FOREIGN KEY ("trajet_instance_id") REFERENCES "public"."trajets_instances"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_passager_id_fkey" FOREIGN KEY ("passager_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_trajet_instance_id_fkey" FOREIGN KEY ("trajet_instance_id") REFERENCES "public"."trajets_instances"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_places"
    ADD CONSTRAINT "saved_places_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."signalements"
    ADD CONSTRAINT "signalements_auteur_id_fkey" FOREIGN KEY ("auteur_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."signalements"
    ADD CONSTRAINT "signalements_cible_id_fkey" FOREIGN KEY ("cible_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."signalements"
    ADD CONSTRAINT "signalements_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."signalements"
    ADD CONSTRAINT "signalements_traite_par_fkey" FOREIGN KEY ("traite_par") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."sms_campaigns"
    ADD CONSTRAINT "sms_campaigns_auteur_id_fkey" FOREIGN KEY ("auteur_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."sms_log"
    ADD CONSTRAINT "sms_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_passager_id_fkey" FOREIGN KEY ("passager_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_trajet_id_fkey" FOREIGN KEY ("trajet_id") REFERENCES "public"."trajets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."thanks"
    ADD CONSTRAINT "thanks_auteur_id_fkey" FOREIGN KEY ("auteur_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."thanks"
    ADD CONSTRAINT "thanks_destinataire_id_fkey" FOREIGN KEY ("destinataire_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."thanks"
    ADD CONSTRAINT "thanks_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."track_positions"
    ADD CONSTRAINT "track_positions_conducteur_id_fkey" FOREIGN KEY ("conducteur_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."track_positions"
    ADD CONSTRAINT "track_positions_trajet_instance_id_fkey" FOREIGN KEY ("trajet_instance_id") REFERENCES "public"."trajets_instances"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trajets"
    ADD CONSTRAINT "trajets_conducteur_id_fkey" FOREIGN KEY ("conducteur_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trajets"
    ADD CONSTRAINT "trajets_culte_id_fkey" FOREIGN KEY ("culte_id") REFERENCES "public"."cultes"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."trajets_instances"
    ADD CONSTRAINT "trajets_instances_trajet_id_fkey" FOREIGN KEY ("trajet_id") REFERENCES "public"."trajets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_ratings"
    ADD CONSTRAINT "trip_ratings_rated_id_fkey" FOREIGN KEY ("rated_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_ratings"
    ADD CONSTRAINT "trip_ratings_rater_id_fkey" FOREIGN KEY ("rater_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_ratings"
    ADD CONSTRAINT "trip_ratings_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE CASCADE;



CREATE POLICY "admin gère cultes" ON "public"."cultes" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin gère eglise" ON "public"."eglise" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin gère instances" ON "public"."trajets_instances" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin gère messages" ON "public"."messages" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin gère réservations" ON "public"."reservations" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin gère trajets" ON "public"."trajets" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin lit reminders_log" ON "public"."reminders_log" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admin lit sms_campaigns" ON "public"."sms_campaigns" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admin lit sms_log" ON "public"."sms_log" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admin only" ON "public"."admin_actions" USING ("public"."is_admin"());



CREATE POLICY "admin tout" ON "public"."profiles" USING ("public"."is_admin"());



CREATE POLICY "admin traite signalements" ON "public"."signalements" FOR UPDATE USING ("public"."is_admin"());



CREATE POLICY "admin update bug reports" ON "public"."bug_reports" FOR UPDATE USING ("public"."is_admin"());



CREATE POLICY "admin voit tous les messages" ON "public"."messages" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admin voit toutes les réservations" ON "public"."reservations" FOR SELECT USING ("public"."is_admin"());



ALTER TABLE "public"."admin_actions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "auteur supprime ses thanks" ON "public"."thanks" FOR DELETE USING (("auteur_id" = "auth"."uid"()));



CREATE POLICY "auteur voit ses signalements" ON "public"."signalements" FOR SELECT USING ((("auteur_id" = "auth"."uid"()) OR "public"."is_admin"()));



CREATE POLICY "auto-insert" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "auto-update" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."bug_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conducteur gère" ON "public"."trajets" USING (("conducteur_id" = "auth"."uid"()));



CREATE POLICY "conducteur gère instances" ON "public"."trajets_instances" USING ((EXISTS ( SELECT 1
   FROM "public"."trajets" "t"
  WHERE (("t"."id" = "trajets_instances"."trajet_id") AND ("t"."conducteur_id" = "auth"."uid"())))));



CREATE POLICY "conducteur peut upsert sa position" ON "public"."track_positions" USING (("auth"."uid"() = "conducteur_id")) WITH CHECK (("auth"."uid"() = "conducteur_id"));



CREATE POLICY "conducteur traite résa" ON "public"."reservations" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."trajets_instances" "ti"
     JOIN "public"."trajets" "t" ON (("t"."id" = "ti"."trajet_id")))
  WHERE (("ti"."id" = "reservations"."trajet_instance_id") AND ("t"."conducteur_id" = "auth"."uid"())))));



CREATE POLICY "conducteur voit résa de ses trajets" ON "public"."reservations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."trajets_instances" "ti"
     JOIN "public"."trajets" "t" ON (("t"."id" = "ti"."trajet_id")))
  WHERE (("ti"."id" = "reservations"."trajet_instance_id") AND ("t"."conducteur_id" = "auth"."uid"())))));



CREATE POLICY "création signalement" ON "public"."signalements" FOR INSERT WITH CHECK (("auteur_id" = "auth"."uid"()));



ALTER TABLE "public"."cultes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cultes lisibles" ON "public"."cultes" FOR SELECT USING (true);



ALTER TABLE "public"."demandes_passager" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "demandes_passager admin" ON "public"."demandes_passager" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "demandes_passager owner" ON "public"."demandes_passager" USING (("passager_id" = "auth"."uid"())) WITH CHECK (("passager_id" = "auth"."uid"()));



CREATE POLICY "demandes_passager visible aux conducteurs" ON "public"."demandes_passager" FOR SELECT USING ((("statut" = 'active'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['conducteur'::"public"."role_user", 'les_deux'::"public"."role_user"])))))));



ALTER TABLE "public"."eglise" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "eglise lisible" ON "public"."eglise" FOR SELECT USING (true);



ALTER TABLE "public"."engagement_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "engagement_log: admin only" ON "public"."engagement_log" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "envoi msg" ON "public"."messages" FOR INSERT WITH CHECK (("expediteur_id" = "auth"."uid"()));



ALTER TABLE "public"."group_alerts_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "group_alerts_log admin" ON "public"."group_alerts_log" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "instances visibles authentifiées" ON "public"."trajets_instances" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "lecture msg perso" ON "public"."messages" FOR SELECT USING ((("expediteur_id" = "auth"."uid"()) OR ("destinataire_id" = "auth"."uid"())));



CREATE POLICY "lecture publique positions" ON "public"."track_positions" FOR SELECT USING (true);



CREATE POLICY "marquer lu" ON "public"."messages" FOR UPDATE USING (("destinataire_id" = "auth"."uid"()));



ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notif_prefs: insertion propriétaire" ON "public"."notification_preferences" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "notif_prefs: lecture propriétaire" ON "public"."notification_preferences" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "notif_prefs: modification propriétaire" ON "public"."notification_preferences" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "notif_prefs: suppression propriétaire" ON "public"."notification_preferences" FOR DELETE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."notification_preferences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "passager crée résa" ON "public"."reservations" FOR INSERT WITH CHECK (("passager_id" = "auth"."uid"()));



CREATE POLICY "passager update résa" ON "public"."reservations" FOR UPDATE USING (("passager_id" = "auth"."uid"())) WITH CHECK ((("passager_id" = "auth"."uid"()) AND ("statut" = ANY (ARRAY['pending'::"public"."statut_reservation", 'cancelled'::"public"."statut_reservation"]))));



CREATE POLICY "passager voit co-passagers" ON "public"."reservations" FOR SELECT USING ((("statut" = 'accepted'::"public"."statut_reservation") AND "public"."user_has_accepted_on_instance"("trajet_instance_id")));



CREATE POLICY "passager voit ses résa" ON "public"."reservations" FOR SELECT USING (("passager_id" = "auth"."uid"()));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profils visibles authentifiés" ON "public"."profiles" FOR SELECT USING ((("auth"."uid"() IS NOT NULL) AND (("suspended" = false) OR ("auth"."uid"() = "id") OR "public"."is_admin"())));



ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reminders_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reservations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."saved_places" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "saved_places admin" ON "public"."saved_places" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "saved_places owner" ON "public"."saved_places" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."signalements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sms_campaigns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sms_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subscription admin" ON "public"."subscriptions" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "subscription conducteur lit" ON "public"."subscriptions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."trajets" "t"
  WHERE (("t"."id" = "subscriptions"."trajet_id") AND ("t"."conducteur_id" = "auth"."uid"())))));



CREATE POLICY "subscription passager" ON "public"."subscriptions" USING (("passager_id" = "auth"."uid"())) WITH CHECK (("passager_id" = "auth"."uid"()));



ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."thanks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "thanks admin" ON "public"."thanks" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "thanks insertion" ON "public"."thanks" FOR INSERT WITH CHECK ((("auteur_id" = "auth"."uid"()) AND (("reservation_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."reservations" "r"
  WHERE (("r"."id" = "thanks"."reservation_id") AND ("r"."statut" = 'completed'::"public"."statut_reservation") AND (("r"."passager_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM ("public"."trajets_instances" "ti"
             JOIN "public"."trajets" "t" ON (("t"."id" = "ti"."trajet_id")))
          WHERE (("ti"."id" = "r"."trajet_instance_id") AND ("t"."conducteur_id" = "auth"."uid"()))))) AND (("r"."passager_id" = "thanks"."destinataire_id") OR (EXISTS ( SELECT 1
           FROM ("public"."trajets_instances" "ti"
             JOIN "public"."trajets" "t" ON (("t"."id" = "ti"."trajet_id")))
          WHERE (("ti"."id" = "r"."trajet_instance_id") AND ("t"."conducteur_id" = "thanks"."destinataire_id")))))))))));



CREATE POLICY "thanks prives visibles" ON "public"."thanks" FOR SELECT USING ((("is_public" = false) AND (("auteur_id" = "auth"."uid"()) OR ("destinataire_id" = "auth"."uid"()))));



CREATE POLICY "thanks publics visibles" ON "public"."thanks" FOR SELECT USING (("is_public" = true));



ALTER TABLE "public"."track_positions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trajets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trajets actifs visibles authentifiés" ON "public"."trajets" FOR SELECT USING ((("auth"."uid"() IS NOT NULL) AND (("actif" = true) OR ("conducteur_id" = "auth"."uid"()) OR "public"."is_admin"())));



ALTER TABLE "public"."trajets_instances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trip_ratings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trip_ratings admin" ON "public"."trip_ratings" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "trip_ratings public lit" ON "public"."trip_ratings" FOR SELECT USING (true);



CREATE POLICY "trip_ratings rated lit" ON "public"."trip_ratings" FOR SELECT USING (("rated_id" = "auth"."uid"()));



CREATE POLICY "trip_ratings rater" ON "public"."trip_ratings" USING (("rater_id" = "auth"."uid"())) WITH CHECK (("rater_id" = "auth"."uid"()));



CREATE POLICY "user insère ses push_subscriptions" ON "public"."push_subscriptions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "user lit ses push_subscriptions" ON "public"."push_subscriptions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user met à jour ses push_subscriptions" ON "public"."push_subscriptions" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "user supprime ses push_subscriptions" ON "public"."push_subscriptions" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "users insert own bug reports" ON "public"."bug_reports" FOR INSERT WITH CHECK (("auth"."uid"() = "auteur_id"));



CREATE POLICY "users select own or admin all" ON "public"."bug_reports" FOR SELECT USING ((("auth"."uid"() = "auteur_id") OR "public"."is_admin"()));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_subscription_to_instance"("p_subscription_id" "uuid", "p_instance_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."apply_subscription_to_instance"("p_subscription_id" "uuid", "p_instance_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_subscription_to_instance"("p_subscription_id" "uuid", "p_instance_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_refuse_when_full"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_refuse_when_full"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_refuse_when_full"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_instance_capacity"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_instance_capacity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_instance_capacity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_instance_capacity_on_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_instance_capacity_on_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_instance_capacity_on_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generer_trajets_instances"() TO "anon";
GRANT ALL ON FUNCTION "public"."generer_trajets_instances"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generer_trajets_instances"() TO "service_role";



GRANT ALL ON FUNCTION "public"."guard_reservation_statut_transition"() TO "anon";
GRANT ALL ON FUNCTION "public"."guard_reservation_statut_transition"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_reservation_statut_transition"() TO "service_role";



GRANT ALL ON FUNCTION "public"."instance_places_restantes"("p_instance_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."instance_places_restantes"("p_instance_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."instance_places_restantes"("p_instance_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_empty_seat"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_empty_seat"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_empty_seat"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_demandes_passager_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_demandes_passager_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_demandes_passager_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trajet_detour_moyen_km"("p_trajet_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."trajet_detour_moyen_km"("p_trajet_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."trajet_detour_moyen_km"("p_trajet_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."trajets_compatibles"("p_passager_lat" double precision, "p_passager_lng" double precision, "p_culte_id" "uuid", "p_sens" "public"."sens_reservation", "p_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."trajets_compatibles"("p_passager_lat" double precision, "p_passager_lng" double precision, "p_culte_id" "uuid", "p_sens" "public"."sens_reservation", "p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."trajets_compatibles"("p_passager_lat" double precision, "p_passager_lng" double precision, "p_culte_id" "uuid", "p_sens" "public"."sens_reservation", "p_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_fn_subscription_autores"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_fn_subscription_autores"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_fn_subscription_autores"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_trajet_ligne"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_trajet_ligne"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_trajet_ligne"() TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_accepted_on_instance"("p_instance" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_accepted_on_instance"("p_instance" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_accepted_on_instance"("p_instance" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."admin_actions" TO "anon";
GRANT ALL ON TABLE "public"."admin_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_actions" TO "service_role";



GRANT ALL ON TABLE "public"."bug_reports" TO "anon";
GRANT ALL ON TABLE "public"."bug_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."bug_reports" TO "service_role";



GRANT ALL ON TABLE "public"."cultes" TO "anon";
GRANT ALL ON TABLE "public"."cultes" TO "authenticated";
GRANT ALL ON TABLE "public"."cultes" TO "service_role";



GRANT ALL ON TABLE "public"."demandes_passager" TO "anon";
GRANT ALL ON TABLE "public"."demandes_passager" TO "authenticated";
GRANT ALL ON TABLE "public"."demandes_passager" TO "service_role";



GRANT ALL ON TABLE "public"."eglise" TO "anon";
GRANT ALL ON TABLE "public"."eglise" TO "authenticated";
GRANT ALL ON TABLE "public"."eglise" TO "service_role";



GRANT ALL ON TABLE "public"."engagement_log" TO "anon";
GRANT ALL ON TABLE "public"."engagement_log" TO "authenticated";
GRANT ALL ON TABLE "public"."engagement_log" TO "service_role";



GRANT ALL ON TABLE "public"."group_alerts_log" TO "anon";
GRANT ALL ON TABLE "public"."group_alerts_log" TO "authenticated";
GRANT ALL ON TABLE "public"."group_alerts_log" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."notification_preferences" TO "anon";
GRANT ALL ON TABLE "public"."notification_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."reservations" TO "anon";
GRANT ALL ON TABLE "public"."reservations" TO "authenticated";
GRANT ALL ON TABLE "public"."reservations" TO "service_role";



GRANT ALL ON TABLE "public"."trajets" TO "anon";
GRANT ALL ON TABLE "public"."trajets" TO "authenticated";
GRANT ALL ON TABLE "public"."trajets" TO "service_role";



GRANT ALL ON TABLE "public"."trajets_instances" TO "anon";
GRANT ALL ON TABLE "public"."trajets_instances" TO "authenticated";
GRANT ALL ON TABLE "public"."trajets_instances" TO "service_role";



GRANT ALL ON TABLE "public"."profiles_safe" TO "anon";
GRANT ALL ON TABLE "public"."profiles_safe" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles_safe" TO "service_role";



GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."reminders_log" TO "anon";
GRANT ALL ON TABLE "public"."reminders_log" TO "authenticated";
GRANT ALL ON TABLE "public"."reminders_log" TO "service_role";



GRANT ALL ON TABLE "public"."saved_places" TO "anon";
GRANT ALL ON TABLE "public"."saved_places" TO "authenticated";
GRANT ALL ON TABLE "public"."saved_places" TO "service_role";



GRANT ALL ON TABLE "public"."signalements" TO "anon";
GRANT ALL ON TABLE "public"."signalements" TO "authenticated";
GRANT ALL ON TABLE "public"."signalements" TO "service_role";



GRANT ALL ON TABLE "public"."sms_campaigns" TO "anon";
GRANT ALL ON TABLE "public"."sms_campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."sms_campaigns" TO "service_role";



GRANT ALL ON TABLE "public"."sms_log" TO "anon";
GRANT ALL ON TABLE "public"."sms_log" TO "authenticated";
GRANT ALL ON TABLE "public"."sms_log" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."thanks" TO "anon";
GRANT ALL ON TABLE "public"."thanks" TO "authenticated";
GRANT ALL ON TABLE "public"."thanks" TO "service_role";



GRANT ALL ON TABLE "public"."track_positions" TO "anon";
GRANT ALL ON TABLE "public"."track_positions" TO "authenticated";
GRANT ALL ON TABLE "public"."track_positions" TO "service_role";



GRANT ALL ON TABLE "public"."trip_ratings" TO "anon";
GRANT ALL ON TABLE "public"."trip_ratings" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_ratings" TO "service_role";



GRANT ALL ON TABLE "public"."user_stats" TO "anon";
GRANT ALL ON TABLE "public"."user_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."user_stats" TO "service_role";



GRANT ALL ON TABLE "public"."user_top_score" TO "anon";
GRANT ALL ON TABLE "public"."user_top_score" TO "authenticated";
GRANT ALL ON TABLE "public"."user_top_score" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







