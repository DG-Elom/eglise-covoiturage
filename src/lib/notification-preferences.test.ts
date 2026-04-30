import { describe, it, expect } from "vitest";
import {
  shouldSendPush,
  type NotifKind,
  type NotifPrefs,
} from "./notification-preferences";

describe("shouldSendPush", () => {
  it("retourne true quand prefs est null (aucune customisation)", () => {
    const kinds: NotifKind[] = [
      "reminder_2h",
      "imminent_departure",
      "new_request",
      "decision",
      "trajet_cancelled",
      "new_message",
      "thanks_received",
      "weekly_summary_admin",
    ];
    for (const kind of kinds) {
      expect(shouldSendPush(null, kind)).toBe(true);
    }
  });

  it("retourne false quand le kind est désactivé dans les prefs", () => {
    const prefs: NotifPrefs = {
      reminder_2h: false,
      imminent_departure: true,
      new_request: true,
      decision: true,
      trajet_cancelled: true,
      new_message: true,
      thanks_received: true,
      weekly_summary_admin: true,
    };
    expect(shouldSendPush(prefs, "reminder_2h")).toBe(false);
  });

  it("retourne true quand le kind est activé dans les prefs", () => {
    const prefs: NotifPrefs = {
      reminder_2h: true,
      imminent_departure: false,
      new_request: true,
      decision: true,
      trajet_cancelled: true,
      new_message: true,
      thanks_received: true,
      weekly_summary_admin: true,
    };
    expect(shouldSendPush(prefs, "reminder_2h")).toBe(true);
  });

  it("retourne false pour imminent_departure quand désactivé", () => {
    const prefs: NotifPrefs = {
      reminder_2h: true,
      imminent_departure: false,
      new_request: true,
      decision: true,
      trajet_cancelled: true,
      new_message: true,
      thanks_received: true,
      weekly_summary_admin: true,
    };
    expect(shouldSendPush(prefs, "imminent_departure")).toBe(false);
  });

  it("retourne false pour weekly_summary_admin quand désactivé", () => {
    const prefs: NotifPrefs = {
      reminder_2h: true,
      imminent_departure: true,
      new_request: true,
      decision: true,
      trajet_cancelled: true,
      new_message: true,
      thanks_received: true,
      weekly_summary_admin: false,
    };
    expect(shouldSendPush(prefs, "weekly_summary_admin")).toBe(false);
  });

  it("retourne true pour tous les kinds quand tout est activé", () => {
    const allTrue: NotifPrefs = {
      reminder_2h: true,
      imminent_departure: true,
      new_request: true,
      decision: true,
      trajet_cancelled: true,
      new_message: true,
      thanks_received: true,
      weekly_summary_admin: true,
    };
    const kinds: NotifKind[] = [
      "reminder_2h",
      "imminent_departure",
      "new_request",
      "decision",
      "trajet_cancelled",
      "new_message",
      "thanks_received",
      "weekly_summary_admin",
    ];
    for (const kind of kinds) {
      expect(shouldSendPush(allTrue, kind)).toBe(true);
    }
  });
});
