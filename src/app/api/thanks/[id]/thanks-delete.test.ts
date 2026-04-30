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

import { DELETE } from "./route";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

function makeDeleteRequest(id: string): NextRequest {
  return new NextRequest(`http://localhost/api/thanks/${id}`, {
    method: "DELETE",
  });
}

type MockDeleteChain = {
  eq: ReturnType<typeof vi.fn>;
};

function makeSupabaseMock(
  userId: string | null,
  deleteResult: { error: null | { message: string; code?: string } } = { error: null },
) {
  const deleteChain: MockDeleteChain = {
    eq: vi.fn().mockResolvedValue(deleteResult),
  };

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: userId ? { id: userId } : null } }),
    },
    from: vi.fn().mockReturnValue({
      delete: vi.fn().mockReturnValue(deleteChain),
    }),
  };
}

describe("DELETE /api/thanks/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne 401 si non authentifié", async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabaseMock(null) as never);

    const req = makeDeleteRequest("thanks-123");
    const res = await DELETE(req, { params: Promise.resolve({ id: "thanks-123" }) });
    expect(res.status).toBe(401);
  });

  it("retourne 204 si suppression réussie", async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabaseMock("user-123") as never);

    const req = makeDeleteRequest("thanks-abc");
    const res = await DELETE(req, { params: Promise.resolve({ id: "thanks-abc" }) });
    expect(res.status).toBe(204);
  });

  it("retourne 403 si RLS bloque la suppression (0 rows deleted)", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseMock("user-456", { error: { message: "RLS", code: "42501" } }) as never,
    );

    const req = makeDeleteRequest("thanks-abc");
    const res = await DELETE(req, { params: Promise.resolve({ id: "thanks-abc" }) });
    expect(res.status).toBe(403);
  });

  it("retourne 400 si id manquant dans les params", async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabaseMock("user-123") as never);

    const req = makeDeleteRequest("");
    const res = await DELETE(req, { params: Promise.resolve({ id: "" }) });
    expect(res.status).toBe(400);
  });
});
