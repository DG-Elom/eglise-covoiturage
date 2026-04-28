-- Migration v11 : trigger trajet_ligne respecte la valeur fournie par le client
-- Avant : le trigger écrasait toujours trajet_ligne avec une LIGNE DROITE
--         depart -> eglise.
-- Après : si le client fournit une polyline (route Mapbox suivant les routes),
--         le trigger garde cette valeur. Fallback à la ligne droite si null.

create or replace function update_trajet_ligne()
returns trigger as $$
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
$$ language plpgsql;
