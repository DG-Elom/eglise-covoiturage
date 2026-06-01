/**
 * Compat : la logique d'impact vit désormais dans `@/lib/impact` (partagée avec
 * la carte d'impact `/impact`). Ce module ré-exporte sous les anciens noms pour
 * ne rien casser.
 */
import {
  computeImpactStats,
  type ImpactRawData,
  type ImpactStats,
} from "@/lib/impact";

export type WeeklyRawData = ImpactRawData;
export type WeeklyStats = ImpactStats;

export const computeWeeklyStats = computeImpactStats;
