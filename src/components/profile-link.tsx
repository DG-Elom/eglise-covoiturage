import Link from "next/link";
import { cn } from "@/lib/utils";

type Props = {
  userId: string;
  /**
   * Rend les enfants cliquables vers `/u/[id]` quand `true` (typiquement :
   * l'utilisateur courant est admin). Sinon, rend les enfants tels quels.
   */
  enabled?: boolean;
  className?: string;
  children: React.ReactNode;
};

/**
 * Enveloppe un nom / avatar pour mener au profil public quand l'accès est
 * autorisé. Permet à un admin de rebondir vers le profil de n'importe qui,
 * depuis n'importe quelle surface, sans exposer le lien aux autres membres.
 */
export function ProfileLink({ userId, enabled = false, className, children }: Props) {
  if (!enabled) return <>{children}</>;
  return (
    <Link
      href={`/u/${userId}`}
      title="Voir le profil (admin)"
      className={cn(
        "rounded-lg outline-none transition hover:opacity-80 focus-visible:ring-2 focus-visible:ring-emerald-500",
        className,
      )}
    >
      {children}
    </Link>
  );
}
