import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { Avatar } from "@/components/avatar";
import { Calendar } from "lucide-react";
import { ChatView, type ChatMessage } from "./chat-view";

type Props = { params: Promise<{ reservationId: string }> };

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default async function MessagesPage({ params }: Props) {
  const { reservationId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, prenom, nom, photo_url, is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) redirect("/onboarding");

  const { data: reservation } = await supabase
    .from("reservations")
    .select(
      `id, passager_id, statut,
       trajets_instances!inner (
         date,
         trajets!inner (
           conducteur_id,
           cultes (libelle)
         )
       ),
       passager:profiles!reservations_passager_id_fkey (
         id, prenom, nom, photo_url, telephone
       )`,
    )
    .eq("id", reservationId)
    .maybeSingle();

  if (!reservation) notFound();

  type ResShape = {
    id: string;
    passager_id: string;
    statut: string;
    trajets_instances: {
      date: string;
      trajets: {
        conducteur_id: string;
        cultes: { libelle: string } | { libelle: string }[] | null;
      };
    };
    passager: {
      id: string;
      prenom: string;
      nom: string;
      photo_url: string | null;
      telephone: string;
    } | null;
  };
  const r = reservation as unknown as ResShape;

  const conducteurId = r.trajets_instances.trajets.conducteur_id;
  const passagerId = r.passager_id;
  const isPassager = user.id === passagerId;
  const isConducteur = user.id === conducteurId;
  if (!isPassager && !isConducteur) notFound();

  const otherId = isPassager ? conducteurId : passagerId;
  let otherProfile = null as null | {
    id: string;
    prenom: string;
    nom: string;
    photo_url: string | null;
    telephone: string;
  };
  if (isConducteur) {
    otherProfile = r.passager;
  } else {
    const { data } = await supabase
      .from("profiles")
      .select("id, prenom, nom, photo_url, telephone")
      .eq("id", conducteurId)
      .maybeSingle();
    otherProfile = data;
  }
  if (!otherProfile) notFound();

  const { data: msgs } = await supabase
    .from("messages")
    .select("id, expediteur_id, contenu, envoye_le, lu")
    .eq("reservation_id", reservationId)
    .order("envoye_le", { ascending: true });
  const initialMessages = (msgs ?? []) as ChatMessage[];

  // Marquer comme lus les messages reçus
  if (initialMessages.some((m) => !m.lu && m.expediteur_id !== user.id)) {
    await supabase
      .from("messages")
      .update({ lu: true })
      .eq("reservation_id", reservationId)
      .eq("destinataire_id", user.id);
  }

  const culte = Array.isArray(r.trajets_instances.trajets.cultes)
    ? r.trajets_instances.trajets.cultes[0]
    : r.trajets_instances.trajets.cultes;

  return (
    <>
      <AppHeader
        title={otherProfile.prenom}
        back={{ href: "/dashboard" }}
        user={{
          prenom: profile.prenom,
          nom: profile.nom,
          email: user.email,
          photoUrl: profile.photo_url,
        }}
        isAdmin={!!profile.is_admin}
      />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-4 sm:px-6">
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <Avatar
            photoUrl={otherProfile.photo_url}
            prenom={otherProfile.prenom}
            nom={otherProfile.nom}
            size="md"
          />
          <div className="min-w-0">
            <p className="font-medium">
              {otherProfile.prenom} {otherProfile.nom}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
              <Calendar className="size-3" />
              {culte?.libelle ?? "Trajet"} · {formatDate(r.trajets_instances.date)}
            </p>
          </div>
        </div>

        <ChatView
          reservationId={reservationId}
          currentUserId={user.id}
          otherUserId={otherId}
          initialMessages={initialMessages}
        />
      </main>
    </>
  );
}
