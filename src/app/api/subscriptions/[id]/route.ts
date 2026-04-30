import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Vérifie que l'abonnement appartient bien à l'utilisateur
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id, passager_id")
    .eq("id", id)
    .eq("passager_id", user.id)
    .maybeSingle();

  if (!sub) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("subscriptions")
    .update({ actif: false })
    .eq("id", id)
    .eq("passager_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
