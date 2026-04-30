export interface WeeklyRawData {
  trajetsEffectues: number;
  passagersTransportes: number;
  nouveauxInscrits: number;
  messagesEchanges: number;
  kmCumules: number;
}

export interface WeeklyStats extends WeeklyRawData {
  co2EconomiseKg: number;
}

export function computeWeeklyStats(raw: WeeklyRawData): WeeklyStats {
  const co2 = Math.round(raw.kmCumules * 0.12 * raw.passagersTransportes * 100) / 100;
  return { ...raw, co2EconomiseKg: co2 };
}
