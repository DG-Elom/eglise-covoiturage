// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: () => {},
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/push", () => ({
  sendPushTo: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "./route";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

function makePostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/thanks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeSupabaseMock(userId: string | null, insertResult = { data: { id: "thanks-789" }, error: null }) {
  const insertChain = {
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(insertResult),
  };
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: userId ? { id: userId } : null } }),
    },
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue(insertChain),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: { prenom: "Alice" }, error: null }),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  };
}

describe("POST /api/thanks — validation message", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejette un message vide (400)", async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabaseMock("user-123") as never);

    const req = makePostRequest({
      destinataire_id: "user-456",
      message: "",
      is_public: true,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("message_too_short");
  });

  it("rejette un message de 501 caractères (400)", async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabaseMock("user-123") as never);

    const req = makePostRequest({
      destinataire_id: "user-456",
      message: "a".repeat(501),
      is_public: true,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("message_too_long");
  });

  it("accepte un message d'exactement 500 caractères (201)", async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabaseMock("user-123") as never);

    const req = makePostRequest({
      destinataire_id: "user-456",
      message: "a".repeat(500),
      is_public: true,
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const json = (await res.json()) as { id: string };
    expect(json.id).toBe("thanks-789");
  });

  it("accepte un message d'exactement 1 caractère (201)", async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabaseMock("user-123") as never);

    const req = makePostRequest({
      destinataire_id: "user-456",
      message: "A",
      is_public: false,
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it("retourne 401 si non authentifié", async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabaseMock(null) as never);

    const req = makePostRequest({
      destinataire_id: "user-456",
      message: "Merci",
      is_public: true,
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("retourne 400 si destinataire_id manquant", async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabaseMock("user-123") as never);

    const req = makePostRequest({
      message: "Merci !",
      is_public: true,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("destinataire_id_required");
  });
});
