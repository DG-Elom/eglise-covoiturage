import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingCarousel } from "./carousel";

export default async function WelcomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("prenom, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/onboarding");

  return <OnboardingCarousel prenom={profile.prenom} role={profile.role} />;
}
