import { createClient } from "@/lib/supabase/server";

export type Viewer = {
  userId: string | null;
  isAdmin: boolean;
};

/**
 * Utilisateur courant + drapeau admin, en un seul endroit.
 * Centralise le check `is_admin` jusqu'ici dupliqué dans chaque page/route.
 */
export async function getViewer(): Promise<Viewer> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { userId: null, isAdmin: false };

  const { data } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  return { userId: user.id, isAdmin: !!data?.is_admin };
}
