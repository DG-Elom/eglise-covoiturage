import { playNotifSound } from "./notification-sound";

type ConfettiFn = (options: Record<string, unknown>) => Promise<void> | void;

function getConfetti(): ConfettiFn | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  if (typeof w.confetti === "function") return w.confetti as ConfettiFn;
  return null;
}

const BURST_COLORS = ["#10b981", "#f59e0b", "#0ea5e9"];

async function fireBurst(confetti: ConfettiFn, origin: { x: number; y: number }): Promise<void> {
  try {
    await confetti({
      particleCount: 60,
      spread: 70,
      origin,
      colors: BURST_COLORS,
      scalar: 1.1,
    });
  } catch {
    // canvas indisponible ou contexte suspendu
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function celebrateAcceptance(): Promise<void> {
  void playNotifSound("decision");

  const confetti = getConfetti();
  if (!confetti) return;

  await fireBurst(confetti, { x: 0.5, y: 0.6 });
  await delay(300);
  await fireBurst(confetti, { x: 0.35, y: 0.55 });
  await delay(300);
  await fireBurst(confetti, { x: 0.65, y: 0.55 });
}
