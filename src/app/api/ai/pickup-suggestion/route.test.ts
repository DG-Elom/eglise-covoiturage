import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const MOCK_SUGGESTIONS = [
  { label: "Place de la République", raison: "Point central", lat: 49.12, lng: 6.17 },
];

const mockGenerateContent = vi.fn().mockResolvedValue({
  text: JSON.stringify({ suggestions: MOCK_SUGGESTIONS }),
});

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn(function () {
    return {
      models: {
        generateContent: mockGenerateContent,
      },
    };
  }),
}));

const mockSupabaseChain = {
  from: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "conducteur-123" } },
      }),
    },
    from: vi.fn().mockReturnThis(),
  }),
}));

const makeRequest = (body: unknown) =>
  new NextRequest("http://localhost/api/ai/pickup-suggestion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /api/ai/pickup-suggestion (Gemini)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({ suggestions: MOCK_SUGGESTIONS }),
    });
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
    const res = await POST(makeRequest({ trajetInstanceId: "uuid-1" }));
    expect(res.status).toBe(401);
  });

  it("retourne 400 si trajetInstanceId manquant", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "conducteur-123" } } }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const { POST } = await import("./route");
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("retourne des suggestions JSON depuis Gemini", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "conducteur-123" } } }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "trajets_instances") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "inst-1",
                trajet: {
                  conducteur_id: "conducteur-123",
                  depart_adresse: "1 rue Test, Metz",
                  depart_position: { type: "Point", coordinates: [6.17, 49.12] },
                },
              },
              error: null,
            }),
          };
        }
        if (table === "reservations") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  pickup_adresse: "12 rue de la Paix, Metz",
                  pickup_position: { type: "Point", coordinates: [6.175, 49.115] },
                },
              ],
              error: null,
            }),
          };
        }
        if (table === "eglise") {
          return {
            select: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                adresse: "Église ICC Metz",
                position: { type: "Point", coordinates: [6.18, 49.11] },
              },
              error: null,
            }),
          };
        }
        return mockSupabaseChain;
      }),
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ trajetInstanceId: "inst-1" }));
    expect(res.status).toBe(200);
    const json = await res.json() as { suggestions: typeof MOCK_SUGGESTIONS };
    expect(json.suggestions).toHaveLength(1);
    expect(json.suggestions[0].label).toBe("Place de la République");
  });
});
