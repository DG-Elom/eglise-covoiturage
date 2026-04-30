import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isSoundEnabled,
  playNotifSound,
  setSoundEnabled,
  STORAGE_KEY,
} from "./notification-sound";

describe("notification-sound — toggle", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("enabled par défaut quand le storage est vide", () => {
    expect(isSoundEnabled()).toBe(true);
  });

  it("setSoundEnabled(false) persiste et isSoundEnabled() reflète", () => {
    setSoundEnabled(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("false");
    expect(isSoundEnabled()).toBe(false);
  });

  it("setSoundEnabled(true) repasse à enabled", () => {
    setSoundEnabled(false);
    setSoundEnabled(true);
    expect(isSoundEnabled()).toBe(true);
  });
});

describe("notification-sound — playNotifSound", () => {
  let playSpy: ReturnType<typeof vi.fn>;

  let originalAudio: typeof Audio;

  beforeEach(() => {
    localStorage.clear();
    playSpy = vi.fn().mockResolvedValue(undefined);
    originalAudio = window.Audio;
    const AudioMock = vi.fn(function (this: { play: typeof playSpy; volume: number; currentTime: number }) {
      this.play = playSpy;
      this.volume = 0;
      this.currentTime = 0;
    });
    (window as unknown as { Audio: unknown }).Audio = AudioMock;
    (globalThis as unknown as { Audio: unknown }).Audio = AudioMock;
  });

  afterEach(() => {
    (window as unknown as { Audio: unknown }).Audio = originalAudio;
    (globalThis as unknown as { Audio: unknown }).Audio = originalAudio;
  });

  it("ne joue rien quand le son est désactivé", async () => {
    setSoundEnabled(false);
    await playNotifSound("message");
    expect(playSpy).not.toHaveBeenCalled();
  });

  it("joue un son quand activé", async () => {
    await playNotifSound("message");
    expect(playSpy).toHaveBeenCalledTimes(1);
  });

  it("ne throw pas si play() est rejetée (autoplay bloqué)", async () => {
    playSpy.mockRejectedValueOnce(new Error("NotAllowedError"));
    await expect(playNotifSound("notif")).resolves.toBeUndefined();
  });

  it("accepte plusieurs kinds sans throw", async () => {
    await playNotifSound("notif");
    await playNotifSound("message");
    await playNotifSound("request");
    await playNotifSound("decision");
    expect(playSpy).toHaveBeenCalledTimes(4);
  });
});
