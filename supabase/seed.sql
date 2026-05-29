-- Seed deterministe pour les tests e2e (Supabase local uniquement)
-- Appliqué par `supabase db reset`
-- UUIDs fixes pour pouvoir les référencer dans les tests

-- Bypass RLS et FK triggers durant le seed
SET session_replication_role = replica;
SET search_path TO public, extensions;

-- ─── Nettoyage (idempotent) ───────────────────────────────────────────────────
DELETE FROM public.reservations        WHERE passager_id IN (
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'b0000000-0000-0000-0000-000000000002'::uuid
);
DELETE FROM public.trajets_instances   WHERE trajet_id = 'c0000000-0000-0000-0000-000000000003'::uuid;
DELETE FROM public.trajets             WHERE id        = 'c0000000-0000-0000-0000-000000000003'::uuid;
DELETE FROM public.profiles            WHERE id IN (
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'b0000000-0000-0000-0000-000000000002'::uuid
);
DELETE FROM auth.identities            WHERE user_id IN (
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'b0000000-0000-0000-0000-000000000002'::uuid
);
DELETE FROM auth.users                 WHERE id IN (
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'b0000000-0000-0000-0000-000000000002'::uuid
);
DELETE FROM public.cultes              WHERE id        = 'd0000000-0000-0000-0000-000000000004'::uuid;
DELETE FROM public.eglise              WHERE id        = 'e0000000-0000-0000-0000-000000000005'::uuid;

-- ─── Eglise ───────────────────────────────────────────────────────────────────
INSERT INTO public.eglise (id, nom, adresse, position)
VALUES (
  'e0000000-0000-0000-0000-000000000005',
  'ICC Metz',
  '1 Rue de la Paix, 57000 Metz',
  public.ST_GeogFromText('SRID=4326;POINT(6.1757 49.1193)')
);

-- ─── Culte (dimanche = jour_semaine 0) ────────────────────────────────────────
INSERT INTO public.cultes (id, libelle, jour_semaine, heure, actif)
VALUES (
  'd0000000-0000-0000-0000-000000000004',
  'Culte du dimanche',
  0,
  '10:00:00',
  true
);

-- ─── Users auth ───────────────────────────────────────────────────────────────
-- Passager
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  role,
  aud,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change_token_current,
  email_change,
  phone_change,
  phone_change_token,
  reauthentication_token,
  is_sso_user,
  is_anonymous
) VALUES (
  'a0000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'passager.e2e@test.local',
  '',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"email":"passager.e2e@test.local"}',
  now(),
  now(),
  'authenticated',
  'authenticated',
  '', '', '', '', '', '', '', '',
  false, false
);

-- Conducteur
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  role,
  aud,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change_token_current,
  email_change,
  phone_change,
  phone_change_token,
  reauthentication_token,
  is_sso_user,
  is_anonymous
) VALUES (
  'b0000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'conducteur.e2e@test.local',
  '',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"email":"conducteur.e2e@test.local"}',
  now(),
  now(),
  'authenticated',
  'authenticated',
  '', '', '', '', '', '', '', '',
  false, false
);

-- ─── Identities (requis pour signInWithOtp) ───────────────────────────────────
INSERT INTO auth.identities (
  id,
  user_id,
  provider,
  provider_id,
  identity_data,
  created_at,
  updated_at,
  last_sign_in_at
) VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'email',
  'a0000000-0000-0000-0000-000000000001',
  '{"sub":"a0000000-0000-0000-0000-000000000001","email":"passager.e2e@test.local","email_verified":true}',
  now(),
  now(),
  now()
);

INSERT INTO auth.identities (
  id,
  user_id,
  provider,
  provider_id,
  identity_data,
  created_at,
  updated_at,
  last_sign_in_at
) VALUES (
  'b0000000-0000-0000-0000-000000000002',
  'b0000000-0000-0000-0000-000000000002',
  'email',
  'b0000000-0000-0000-0000-000000000002',
  '{"sub":"b0000000-0000-0000-0000-000000000002","email":"conducteur.e2e@test.local","email_verified":true}',
  now(),
  now(),
  now()
);

-- ─── Profiles ─────────────────────────────────────────────────────────────────
INSERT INTO public.profiles (
  id, nom, prenom, telephone, role,
  charte_acceptee_at, is_admin, suspended,
  created_at, updated_at
) VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Passager', 'TestPassager', '0601010101',
  'passager',
  now(), false, false,
  now(), now()
);

INSERT INTO public.profiles (
  id, nom, prenom, telephone, role,
  charte_acceptee_at, is_admin, suspended,
  created_at, updated_at
) VALUES (
  'b0000000-0000-0000-0000-000000000002',
  'Conducteur', 'TestConducteur', '0602020202',
  'conducteur',
  now(), false, false,
  now(), now()
);

-- ─── Trajet (conducteur, culte dimanche, Metz centre) ─────────────────────────
-- depart_position : appartement fictif à ~1 km de l'église
-- rayon_detour_km = 5.0 → passager dans cette zone sera dans_zone=true
INSERT INTO public.trajets (
  id,
  conducteur_id,
  culte_id,
  depart_adresse,
  depart_position,
  trajet_ligne,
  sens,
  places_total,
  rayon_detour_km,
  actif,
  heure_depart
) VALUES (
  'c0000000-0000-0000-0000-000000000003',
  'b0000000-0000-0000-0000-000000000002',
  'd0000000-0000-0000-0000-000000000004',
  '10 Rue Serpenoise, 57000 Metz',
  public.ST_GeogFromText('SRID=4326;POINT(6.1760 49.1180)'),
  -- trajet_ligne calculée manuellement (bypass du trigger update_trajet_ligne)
  -- ligne : domicile conducteur (6.1760 49.1180) → église (6.1757 49.1193)
  public.ST_MakeLine(
    public.ST_GeomFromText('POINT(6.1760 49.1180)', 4326),
    public.ST_GeomFromText('POINT(6.1757 49.1193)', 4326)
  )::public.geography,
  'aller',
  3,
  5.0,
  true,
  '09:30:00'
);

-- ─── Trajets instance (prochain dimanche futur) ───────────────────────────────
-- Calcule le prochain dimanche (dow=0) à partir d'aujourd'hui
-- On insert directement la date calculée dynamiquement
INSERT INTO public.trajets_instances (
  id,
  trajet_id,
  date,
  annule_par_conducteur
)
SELECT
  'f0000000-0000-0000-0000-000000000006'::uuid,
  'c0000000-0000-0000-0000-000000000003'::uuid,
  -- prochain dimanche (ou aujourd'hui si dimanche) >= aujourd'hui + 1 jour
  (current_date + ((7 - extract(dow from current_date)::int) % 7 + 7) % 7 * interval '1 day' + interval '7 days')::date,
  false;

-- Restore replication role
SET session_replication_role = DEFAULT;
