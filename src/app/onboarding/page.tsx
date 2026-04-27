import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./form";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existing) redirect("/dashboard");

  const meta = user.user_metadata ?? {};
  const photoUrl =
    (meta.avatar_url as string | undefined) ??
    (meta.picture as string | undefined) ??
    null;
  const fullName =
    (meta.full_name as string | undefined) ?? (meta.name as string | undefined) ?? "";
  const [prefilledPrenom = "", ...rest] = fullName.split(" ");
  const prefilledNom = rest.join(" ");

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Bienvenue 👋</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Quelques infos pour finaliser ton inscription.
        </p>
      </div>
      <OnboardingForm
        userId={user.id}
        email={user.email ?? ""}
        defaultPhotoUrl={photoUrl}
        defaultPrenom={prefilledPrenom}
        defaultNom={prefilledNom}
      />
    </main>
  );
}
