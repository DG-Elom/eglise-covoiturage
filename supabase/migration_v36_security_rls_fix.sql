-- =============================================================================
-- Migration v36 — Security: fix RLS policies + profiles_safe view
-- Context: audit 2026-05-09 revealed anon read access to profiles (44 phones),
--          trajets (16 addresses), trajets_instances (39), user_stats (44).
--          This migration blocks anonymous access and creates a safe view
--          that masks sensitive fields based on relationship.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. profiles: require authentication for SELECT
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "profils visibles" ON profiles;

CREATE POLICY "profils visibles authentifiés" ON profiles
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (suspended = false OR auth.uid() = id OR is_admin())
  );

-- ---------------------------------------------------------------------------
-- 2. trajets: require authentication for SELECT
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "trajets actifs visibles" ON trajets;

CREATE POLICY "trajets actifs visibles authentifiés" ON trajets
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (actif = true OR conducteur_id = auth.uid() OR is_admin())
  );

-- ---------------------------------------------------------------------------
-- 3. trajets_instances: require authentication for SELECT
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "instances visibles" ON trajets_instances;

CREATE POLICY "instances visibles authentifiées" ON trajets_instances
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- 4. profiles_safe view — masks telephone & emergency contacts
--    telephone visible only if: own profile, admin, or accepted reservation
--    emergency contacts visible only if: own profile or admin
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW profiles_safe
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.nom,
  p.prenom,
  p.photo_url,
  p.role,
  p.voiture_modele,
  p.voiture_couleur,
  p.voiture_plaque,
  p.available_now,
  p.available_until,
  p.charte_acceptee_at,
  p.is_admin,
  p.suspended,
  p.bio,
  p.created_at,
  p.updated_at,
  -- telephone: own profile, admin, or accepted reservation together
  CASE
    WHEN p.id = auth.uid() THEN p.telephone
    WHEN is_admin() THEN p.telephone
    WHEN EXISTS (
      SELECT 1 FROM reservations r
      JOIN trajets_instances ti ON ti.id = r.trajet_instance_id
      JOIN trajets t ON t.id = ti.trajet_id
      WHERE r.statut = 'accepted'
      AND (
        (r.passager_id = auth.uid() AND t.conducteur_id = p.id)
        OR (t.conducteur_id = auth.uid() AND r.passager_id = p.id)
      )
    ) THEN p.telephone
    ELSE NULL
  END AS telephone,
  -- emergency contacts: own profile or admin only
  CASE
    WHEN p.id = auth.uid() OR is_admin() THEN p.emergency_contact_name
    ELSE NULL
  END AS emergency_contact_name,
  CASE
    WHEN p.id = auth.uid() OR is_admin() THEN p.emergency_contact_phone
    ELSE NULL
  END AS emergency_contact_phone
FROM profiles p;

COMMIT;
