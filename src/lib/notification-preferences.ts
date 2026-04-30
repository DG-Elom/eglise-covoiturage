export type NotifKind =
  | "reminder_2h"
  | "imminent_departure"
  | "new_request"
  | "decision"
  | "trajet_cancelled"
  | "new_message"
  | "thanks_received"
  | "weekly_summary_admin";

export type NotifPrefs = Record<NotifKind, boolean>;

export function shouldSendPush(prefs: NotifPrefs | null, kind: NotifKind): boolean {
  if (prefs === null) return true;
  return prefs[kind];
}
