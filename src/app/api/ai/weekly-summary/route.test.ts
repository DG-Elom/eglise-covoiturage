import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGenerateContent = vi.fn().mockResolvedValue({
  text: "Cette semaine, 12 trajets effectués ! 🙏 Que Dieu vous bénisse.",
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

const makeAdminSupabase = (isAdmin = true) => ({
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-user-1" } } }),
  },
  from: vi.fn().mockImplementation((table: string) => {
    if (table === "profiles") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ count: 3, data: [], error: null }),
        single: vi.fn().mockResolvedValue({ data: { is_admin: isAdmin }, error: null }),
      };
    }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockResolvedValue({ count: 10, data: [], error: null }),
      in: vi.fn().mockReturnThis(),
    };
  }),
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

describe("GET /api/ai/weekly-summary (Gemini)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateContent.mockResolvedValue({
      text: "Cette semaine, 12 trajets effectués ! 🙏",
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

    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("retourne 403 si non admin", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValueOnce(
      makeAdminSupabase(false) as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("retourne 200 avec stats et message Gemini pour un admin", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      makeAdminSupabase(true) as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json() as { stats: unknown; message: string };
    expect(json.message).toContain("trajets");
    expect(json.stats).toBeDefined();
  });
});
