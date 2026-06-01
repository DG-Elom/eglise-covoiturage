import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildReferralLink, isAmbassadeur } from "@/lib/referral";
import { ensureReferralCode, countReferralsJoined } from "@/lib/referral-server";

export const runtime = "nodejs";

// GET /api/referral — renvoie le code de parrainage de l'utilisateur connecté,
// son lien d'invitation, le nombre de parrainages aboutis et le statut Ambassadeur.
export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "non_authentifie" }, { status: 401 });
  }

  // Garantit l'existence d'un code (génère/persiste à la volée si absent).
  const code = await ensureReferralCode(supabase, user.id);
  if (!code) {
    return NextResponse.json({ error: "code_unavailable" }, { status: 500 });
  }

  const parrainagesReussis = await countReferralsJoined(supabase, user.id);

  return NextResponse.json({
    code,
    link: buildReferralLink(code),
    parrainages_reussis: parrainagesReussis,
    ambassadeur: isAmbassadeur(parrainagesReussis),
  });
}
