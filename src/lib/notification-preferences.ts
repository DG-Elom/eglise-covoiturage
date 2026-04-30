export type NotifKind =
  | "reminder_2h"
  | "imminent_departure"
  | "new_request"
  | "decision"
  | "trajet_cancelled"
  | "new_message"
  | "thanks_received"
  | "weekly_summary_admin"
  | "engagement";

export type NotifPrefs = {
  reminder_2h: boolean;
  imminent_departure: boolean;
  new_request: boolean;
  decision: boolean;
  trajet_cancelled: boolean;
  new_message: boolean;
  thanks_received: boolean;
  weekly_summary_admin: boolean;
  engagement_relance: boolean;
};

const KIND_TO_COLUMN: Record<NotifKind, keyof NotifPrefs> = {
  reminder_2h: "reminder_2h",
  imminent_departure: "imminent_departure",
  new_request: "new_request",
  decision: "decision",
  trajet_cancelled: "trajet_cancelled",
  new_message: "new_message",
  thanks_received: "thanks_received",
  weekly_summary_admin: "weekly_summary_admin",
  engagement: "engagement_relance",
};

export function shouldSendPush(
  prefs: Partial<NotifPrefs> | null,
  kind: NotifKind,
): boolean {
  if (prefs === null) return true;
  const col = KIND_TO_COLUMN[kind];
  const v = prefs[col];
  return v === undefined ? true : v;
}
