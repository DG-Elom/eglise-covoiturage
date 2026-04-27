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

export function Avatar({
  photoUrl,
  prenom,
  nom,
  size = "md",
  className = "",
}: {
  photoUrl?: string | null;
  prenom?: string | null;
  nom?: string | null;
  size?: Size;
  className?: string;
}) {
  const sizeCls = SIZE_CLASS[size];
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={`${prenom ?? ""} ${nom ?? ""}`.trim() || "Avatar"}
        className={`${sizeCls} rounded-full object-cover bg-slate-100 ${className}`}
      />
    );
  }
  return (
    <div
      className={`${sizeCls} rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-medium ${className}`}
    >
      {initiales(prenom, nom)}
    </div>
  );
}
