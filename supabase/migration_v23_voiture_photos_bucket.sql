-- Migration v23 — Bucket Storage pour les photos de voiture
-- Idempotente : on conflict do nothing + drop policy if exists

-- 1. Création du bucket (public : les URLs sont accessibles sans auth)
insert into storage.buckets (id, name, public)
values ('voiture-photos', 'voiture-photos', true)
on conflict (id) do nothing;

-- 2. Politique lecture publique
drop policy if exists "voiture-photos: lecture publique" on storage.objects;
create policy "voiture-photos: lecture publique"
  on storage.objects for select
  using (bucket_id = 'voiture-photos');

-- 3. Politique upload : chaque utilisateur dans son propre sous-dossier
drop policy if exists "voiture-photos: upload propriétaire" on storage.objects;
create policy "voiture-photos: upload propriétaire"
  on storage.objects for insert
  with check (
    bucket_id = 'voiture-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- 4. Politique update : même condition
drop policy if exists "voiture-photos: update propriétaire" on storage.objects;
create policy "voiture-photos: update propriétaire"
  on storage.objects for update
  using (
    bucket_id = 'voiture-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- 5. Politique delete : même condition
drop policy if exists "voiture-photos: delete propriétaire" on storage.objects;
create policy "voiture-photos: delete propriétaire"
  on storage.objects for delete
  using (
    bucket_id = 'voiture-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
