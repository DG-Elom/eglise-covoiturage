import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingSlides } from "./onboarding-slides";

export default async function OnboardingIntroPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/onboarding");

  return <OnboardingSlides />;
}
