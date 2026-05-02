type ValidateResult =
  | { ok: true; reason?: undefined }
  | { ok: false; reason: "pickup_position_null_island" | "pickup_position_out_of_bounds" };

/**
 * Validates that a GPS pickup position is usable.
 * Rejects coordinates near [0,0] (null island bug) and out-of-bounds values.
 */
export function validatePickupPosition({
  lat,
  lng,
}: {
  lat: number;
  lng: number;
}): ValidateResult {
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { ok: false, reason: "pickup_position_out_of_bounds" };
  }

  const NULL_ISLAND_THRESHOLD = 0.01;
  if (
    Math.abs(lat) <= NULL_ISLAND_THRESHOLD &&
    Math.abs(lng) <= NULL_ISLAND_THRESHOLD
  ) {
    return { ok: false, reason: "pickup_position_null_island" };
  }

  return { ok: true };
}
