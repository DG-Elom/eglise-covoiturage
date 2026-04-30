export const STORAGE_KEY = "notif-sound-enabled";

export type NotifKind = "notif" | "message" | "request" | "decision";

const SOUND_FILES: Record<NotifKind, string> = {
  notif: "/sounds/notif.mp3",
  message: "/sounds/message.mp3",
  request: "/sounds/notif.mp3",
  decision: "/sounds/notif.mp3",
};

const VOLUMES: Record<NotifKind, number> = {
  notif: 0.6,
  message: 0.4,
  request: 0.7,
  decision: 0.6,
};

export const isSoundEnabled = (): boolean => {
  if (typeof window === "undefined") return false;
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === null ? true : v === "true";
};

export const setSoundEnabled = (enabled: boolean): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
};

export const playNotifSound = async (kind: NotifKind): Promise<void> => {
  if (typeof window === "undefined") return;
  if (!isSoundEnabled()) return;
  try {
    const AudioCtor = (window as unknown as { Audio: typeof Audio }).Audio;
    const audio = new AudioCtor(SOUND_FILES[kind]);
    audio.volume = VOLUMES[kind];
    await audio.play();
  } catch {
    // Autoplay bloqué, fichier manquant, ou tab inactif : on n'interrompt pas le flux.
  }
};
