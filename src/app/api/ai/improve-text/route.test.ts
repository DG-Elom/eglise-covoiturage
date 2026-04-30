import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGenerateContent = vi.fn().mockResolvedValue({
  text: "Texte reformulé par Gemini",
});

// Mock @google/genai
vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn(function () {
    return {
      models: {
        generateContent: mockGenerateContent,
      },
    };
  }),
}));

// Mock Supabase
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-123" } },
      }),
    },
  }),
}));

const makeRequest = (body: unknown, method = "POST") =>
  new NextRequest("http://localhost/api/ai/improve-text", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /api/ai/improve-text (Gemini)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "test-key";
  });

  it("retourne 401 si non authentifié", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ text: "test", context: "bio" }));
    expect(res.status).toBe(401);
  });

  it("retourne 400 si texte vide", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ text: "", context: "bio" }));
    expect(res.status).toBe(400);
  });

  it("retourne 400 si contexte invalide", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ text: "Bonjour", context: "invalid" }));
    expect(res.status).toBe(400);
  });

  it("retourne 200 avec improved text depuis Gemini", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ text: "je conduis le dimanche", context: "bio" }));
    expect(res.status).toBe(200);
    const json = await res.json() as { improved: string };
    expect(json.improved).toBe("Texte reformulé par Gemini");
  });

  it("retourne 429 après 3 requêtes pour le même user", async () => {
    const { POST } = await import("./route");
    const body = { text: "test valid", context: "bio" };
    await POST(makeRequest(body));
    await POST(makeRequest(body));
    await POST(makeRequest(body));
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(429);
  });
});
