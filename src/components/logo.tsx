type Size = "sm" | "md" | "lg";

const SIZE_PX: Record<Size, number> = { sm: 28, md: 40, lg: 64 };

export function Logo({
  size = "md",
  withText = false,
  className = "",
}: {
  size?: Size;
  withText?: boolean;
  className?: string;
}) {
  const px = SIZE_PX[size];
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        width={px}
        height={px}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <defs>
          <linearGradient
            id="logo-bg"
            x1="0"
            y1="0"
            x2="64"
            y2="64"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#34d399" />
            <stop offset="1" stopColor="#047857" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="14" fill="url(#logo-bg)" />
        <path
          d="M18 30 Q20 22 26 22 L38 22 Q44 22 46 30"
          stroke="white"
          strokeWidth="2.8"
          strokeLinecap="round"
          fill="none"
        />
        <rect x="14" y="30" width="36" height="14" rx="4" fill="white" />
        <circle cx="24" cy="37" r="2.6" fill="#059669" />
        <circle cx="40" cy="37" r="2.6" fill="#059669" />
        <circle cx="22" cy="46" r="3.5" fill="#0f172a" />
        <circle cx="42" cy="46" r="3.5" fill="#0f172a" />
      </svg>
      {withText && (
        <span className="font-semibold tracking-tight">
          Covoiturage <span className="text-emerald-700">Église</span>
        </span>
      )}
    </span>
  );
}
