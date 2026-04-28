import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BarChart3,
  Calendar,
  Car,
  Megaphone,
  ShieldCheck,
  Users,
  AlertOctagon,
  Building2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";

const NAV_ITEMS: Array<{ href: string; label: string; icon: typeof BarChart3 }> = [
  { href: "/admin", label: "Vue d'ensemble", icon: BarChart3 },
  { href: "/admin/profiles", label: "Profils", icon: Users },
  { href: "/admin/trajets", label: "Trajets", icon: Car },
  { href: "/admin/reservations", label: "Réservations", icon: Calendar },
  { href: "/admin/demandes", label: "Demandes", icon: Megaphone },
  { href: "/admin/cultes", label: "Cultes", icon: ShieldCheck },
  { href: "/admin/signalements", label: "Signalements", icon: AlertOctagon },
  { href: "/admin/eglise", label: "Église", icon: Building2 },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, prenom, nom, photo_url")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) redirect("/onboarding");
  if (!profile.is_admin) redirect("/dashboard");

  return (
    <>
      <AppHeader
        title="Administration"
        back={{ href: "/dashboard" }}
        user={{
          prenom: profile.prenom,
          nom: profile.nom,
          email: user.email,
          photoUrl: profile.photo_url,
        }}
        isAdmin
      />
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 md:flex-row">
        <nav className="md:w-56 shrink-0">
          <ul className="grid grid-cols-2 gap-1.5 md:grid-cols-1">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:border-emerald-300 hover:bg-emerald-50 transition dark:border-slate-700 dark:bg-slate-900 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/40"
                >
                  <Icon className="size-4 text-slate-500 dark:text-slate-400" />
                  <span className="truncate">{label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </>
  );
}
