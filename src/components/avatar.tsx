import Link from "next/link";

type Size = "xs" | "sm" | "md" | "lg";

const SIZE_CLASS: Record<Size, string> = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-16 text-base",
};

function initiales(prenom?: string | null, nom?: string | null): string {
  const p = prenom?.trim()?.[0] ?? "";
  const n = nom?.trim()?.[0] ?? "";
  return (p + n).toUpperCase() || "?";
}

/**
 * Avatar d'un membre. Avec `userId`, l'avatar mène au profil `/u/[id]`
 * (infos publiques pour tous, contact et activité en plus pour l'admin).
 * Ne pas passer `userId` quand l'avatar est déjà dans un lien ou un bouton.
 */
export function Avatar({
  userId,
  ...props
}: AvatarProps & { userId?: string | null }) {
  if (!userId) return <AvatarImage {...props} />;
  const nomComplet = `${props.prenom ?? ""} ${props.nom ?? ""}`.trim();
  return (
    <Link
      href={`/u/${userId}`}
      title={nomComplet ? `Voir le profil de ${nomComplet}` : "Voir le profil"}
      className="inline-flex shrink-0 rounded-full outline-none transition hover:opacity-80 focus-visible:ring-2 focus-visible:ring-emerald-500"
    >
      <AvatarImage {...props} />
    </Link>
  );
}

type AvatarProps = {
  photoUrl?: string | null;
  prenom?: string | null;
  nom?: string | null;
  size?: Size;
  className?: string;
};

function AvatarImage({
  photoUrl,
  prenom,
  nom,
  size = "md",
  className = "",
}: AvatarProps) {
  const sizeCls = SIZE_CLASS[size];
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={`${prenom ?? ""} ${nom ?? ""}`.trim() || "Avatar"}
        className={`${sizeCls} rounded-full object-cover bg-slate-100 ${className} dark:bg-slate-800`}
      />
    );
  }
  return (
    <div
      className={`${sizeCls} rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-medium ${className} dark:bg-emerald-900/40 dark:text-emerald-200`}
    >
      {initiales(prenom, nom)}
    </div>
  );
}
