// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";

describe("track-token", () => {
  let signTrackToken: (payload: {
    reservationId: string;
    passagerId: string;
    expiresAt: Date;
  }) => Promise<string>;
  let verifyTrackToken: (
    token: string,
  ) => Promise<{ reservationId: string; passagerId: string } | null>;

  beforeAll(async () => {
    process.env.TRACK_TOKEN_SECRET =
      "test-secret-key-32bytes-padded-ok==";
    const mod = await import("./track-token");
    signTrackToken = mod.signTrackToken;
    verifyTrackToken = mod.verifyTrackToken;
  });

  it("round-trip: sign then verify returns the claims", async () => {
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);
    const token = await signTrackToken({
      reservationId: "res-123",
      passagerId: "user-456",
      expiresAt,
    });
    const result = await verifyTrackToken(token);
    expect(result).not.toBeNull();
    expect(result?.reservationId).toBe("res-123");
    expect(result?.passagerId).toBe("user-456");
  });

  it("expired token returns null", async () => {
    const expiresAt = new Date(Date.now() - 1000);
    const token = await signTrackToken({
      reservationId: "res-123",
      passagerId: "user-456",
      expiresAt,
    });
    const result = await verifyTrackToken(token);
    expect(result).toBeNull();
  });

  it("token with wrong signature returns null", async () => {
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);
    const token = await signTrackToken({
      reservationId: "res-123",
      passagerId: "user-456",
      expiresAt,
    });
    const parts = token.split(".");
    parts[2] = "invalidsignatureXXXXXXXXXXXXXXXXXXXXXXXXXXX";
    const tamperedToken = parts.join(".");
    const result = await verifyTrackToken(tamperedToken);
    expect(result).toBeNull();
  });

  it("corrupted token returns null", async () => {
    const result = await verifyTrackToken("not.a.jwt.at.all");
    expect(result).toBeNull();
  });
});
