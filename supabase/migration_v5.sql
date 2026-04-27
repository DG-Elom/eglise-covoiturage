-- ============================================================
-- Migration v5 — Page admin : policies pour gérer les programmes
-- À exécuter dans Supabase SQL Editor
-- ============================================================

-- Cultes : seul l'admin peut créer/modifier/supprimer
drop policy if exists "admin g\u00e8re cultes" on cultes;
create policy "admin gère cultes" on cultes for all using (is_admin()) with check (is_admin());

-- Eglise : pareil
drop policy if exists "admin g\u00e8re eglise" on eglise;
create policy "admin gère eglise" on eglise for all using (is_admin()) with check (is_admin());

-- Pour rendre ton compte admin, exécute :
-- update profiles set is_admin = true where id = (select id from auth.users where email = 'TON_EMAIL@gmail.com');
