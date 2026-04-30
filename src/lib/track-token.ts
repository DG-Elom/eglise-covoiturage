import { SignJWT, jwtVerify } from "jose";

type TrackTokenPayload = {
  reservationId: string;
  passagerId: string;
  expiresAt: Date;
};

type TrackTokenClaims = {
  reservationId: string;
  passagerId: string;
};

function getSecret(): Uint8Array {
  const secret = process.env.TRACK_TOKEN_SECRET;
  if (!secret) {
    throw new Error("TRACK_TOKEN_SECRET is not set");
  }
  return new Uint8Array(Buffer.from(secret, "utf-8"));
}

export async function signTrackToken({
  reservationId,
  passagerId,
  expiresAt,
}: TrackTokenPayload): Promise<string> {
  const secret = getSecret();
  return new SignJWT({ reservationId, passagerId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secret);
}

export async function verifyTrackToken(
  token: string,
): Promise<TrackTokenClaims | null> {
  try {
    const secret = getSecret();
    const { payload } = await jwtVerify(token, secret);
    const { reservationId, passagerId } = payload as Record<string, unknown>;
    if (typeof reservationId !== "string" || typeof passagerId !== "string") {
      return null;
    }
    return { reservationId, passagerId };
  } catch {
    return null;
  }
}
