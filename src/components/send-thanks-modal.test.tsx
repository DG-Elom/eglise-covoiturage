// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { submitThanks } from "./send-thanks-modal.logic";

describe("submitThanks", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = fetchMock;
  });

  it("envoie POST /api/thanks avec les bons paramètres", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: "t-1" }), { status: 201 }),
    );

    const result = await submitThanks({
      destinataireId: "user-456",
      reservationId: "res-123",
      message: "Merci beaucoup !",
      isPublic: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/thanks",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinataire_id: "user-456",
          reservation_id: "res-123",
          message: "Merci beaucoup !",
          is_public: true,
        }),
      }),
    );
    expect(result).toEqual({ ok: true, id: "t-1" });
  });

  it("retourne ok=false si le serveur répond 400", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "message_too_short" }), { status: 400 }),
    );

    const result = await submitThanks({
      destinataireId: "user-456",
      reservationId: null,
      message: "",
      isPublic: false,
    });

    expect(result).toEqual({ ok: false, error: "message_too_short" });
  });

  it("retourne ok=false si fetch lance une exception réseau", async () => {
    fetchMock.mockRejectedValue(new Error("Network error"));

    const result = await submitThanks({
      destinataireId: "user-456",
      reservationId: null,
      message: "Test",
      isPublic: true,
    });

    expect(result).toEqual({ ok: false, error: "network_error" });
  });
});
