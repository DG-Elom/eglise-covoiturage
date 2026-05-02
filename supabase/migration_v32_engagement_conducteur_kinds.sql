-- Migration v32 : Élargit le check constraint engagement_log.kind
-- pour inclure les kinds conducteurs.
-- Idempotente.

alter table engagement_log drop constraint if exists engagement_log_kind_check;

alter table engagement_log add constraint engagement_log_kind_check
  check (kind in (
    'engage_d2',
    'engage_d7',
    'engage_d14',
    'engage_conducteur_d2',
    'engage_conducteur_d7',
    'engage_conducteur_d14'
  ));
