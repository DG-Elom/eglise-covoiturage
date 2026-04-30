import { describe, it, expect, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
vi.mock("lucide-react", () => ({
  Car: () => null,
  Camera: () => null,
  Loader2: () => null,
  X: () => null,
  ZoomIn: () => null,
}));

import { validateVoiturePhoto } from "./voiture-photo-upload";

const MAX_BYTES = 3 * 1024 * 1024;

function makeFile(name: string, type: string, size: number): File {
  const buffer = new ArrayBuffer(size);
  return new File([buffer], name, { type });
}

describe("validateVoiturePhoto", () => {
  it("accepte un JPEG sous 3 Mo", () => {
    const file = makeFile("voiture.jpg", "image/jpeg", 1024);
    expect(validateVoiturePhoto(file)).toEqual({ ok: true });
  });

  it("accepte un PNG sous 3 Mo", () => {
    const file = makeFile("voiture.png", "image/png", 500 * 1024);
    expect(validateVoiturePhoto(file)).toEqual({ ok: true });
  });

  it("accepte un WebP sous 3 Mo", () => {
    const file = makeFile("voiture.webp", "image/webp", 2 * 1024 * 1024);
    expect(validateVoiturePhoto(file)).toEqual({ ok: true });
  });

  it("refuse un fichier au-dessus de 3 Mo", () => {
    const file = makeFile("voiture.jpg", "image/jpeg", MAX_BYTES + 1);
    const result = validateVoiturePhoto(file);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/3/);
  });

  it("refuse exactement 3 Mo + 1 octet", () => {
    const file = makeFile("voiture.jpg", "image/jpeg", MAX_BYTES + 1);
    const result = validateVoiturePhoto(file);
    expect(result.ok).toBe(false);
  });

  it("accepte exactement 3 Mo", () => {
    const file = makeFile("voiture.jpg", "image/jpeg", MAX_BYTES);
    expect(validateVoiturePhoto(file)).toEqual({ ok: true });
  });

  it("refuse un type MIME non supporté (image/gif)", () => {
    const file = makeFile("voiture.gif", "image/gif", 100 * 1024);
    const result = validateVoiturePhoto(file);
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("refuse un PDF déguisé en image", () => {
    const file = makeFile("voiture.pdf", "application/pdf", 100 * 1024);
    const result = validateVoiturePhoto(file);
    expect(result.ok).toBe(false);
  });

  it("retourne error undefined quand ok", () => {
    const file = makeFile("voiture.jpg", "image/jpeg", 1024);
    const result = validateVoiturePhoto(file);
    expect(result.error).toBeUndefined();
  });
});
