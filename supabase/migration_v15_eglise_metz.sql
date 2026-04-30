-- ============================================================
-- v15 — Configuration de l'église ICC Metz (idempotent)
-- Aligne la table `eglise` sur la prod : nom, adresse, GPS Metz.
-- Remplace le seed initial "Mon Église / À configurer / Abidjan".
-- ============================================================

with cible as (
  select
    'ICC Metz'::text as nom,
    '7 rue de l''Abbé Grégoire, 57050 Metz'::text as adresse,
    st_makepoint(6.175955, 49.146943)::geography as position
)
insert into eglise (nom, adresse, position)
select nom, adresse, position from cible
where not exists (select 1 from eglise);

update eglise
set
  nom = 'ICC Metz',
  adresse = '7 rue de l''Abbé Grégoire, 57050 Metz',
  position = st_makepoint(6.175955, 49.146943)::geography
where nom = 'Mon Église' or adresse = 'À configurer';
