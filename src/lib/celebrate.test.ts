import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { celebrateAcceptance } from "./celebrate";
import * as notifSound from "./notification-sound";

describe("celebrateAcceptance", () => {
  let playNotifSoundSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    playNotifSoundSpy = vi.spyOn(notifSound, "playNotifSound").mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("ne throw pas quand confetti est indisponible (window.confetti absent)", async () => {
    const originalConfetti = (window as unknown as Record<string, unknown>).confetti;
    delete (window as unknown as Record<string, unknown>).confetti;

    await expect(celebrateAcceptance()).resolves.toBeUndefined();

    if (originalConfetti !== undefined) {
      (window as unknown as Record<string, unknown>).confetti = originalConfetti;
    }
  });

  it("appelle playNotifSound avec 'decision'", async () => {
    await celebrateAcceptance();
    expect(playNotifSoundSpy).toHaveBeenCalledWith("decision");
  });

  it("ne throw pas quand confetti est disponible mais retourne une promesse rejetée", async () => {
    const confettiMock = vi.fn().mockRejectedValue(new Error("canvas error"));
    (window as unknown as Record<string, unknown>).confetti = confettiMock;

    await expect(celebrateAcceptance()).resolves.toBeUndefined();

    delete (window as unknown as Record<string, unknown>).confetti;
  });

  it("appelle confetti plusieurs fois pour les bursts staggerés", async () => {
    vi.useFakeTimers();
    const confettiMock = vi.fn().mockResolvedValue(undefined);
    (window as unknown as Record<string, unknown>).confetti = confettiMock;

    const promise = celebrateAcceptance();
    await vi.runAllTimersAsync();
    await promise;

    expect(confettiMock.mock.calls.length).toBeGreaterThanOrEqual(2);

    delete (window as unknown as Record<string, unknown>).confetti;
    vi.useRealTimers();
  });
});
