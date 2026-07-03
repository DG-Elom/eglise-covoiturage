"use client";

import { cn } from "@/lib/utils";

type ToggleProps = {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  /** Libellé accessible quand le toggle n'a pas de texte associé via aria-labelledby. */
  "aria-label"?: string;
};

/**
 * Interrupteur on/off accessible (role="switch").
 *
 * Le centrage du thumb repose sur `inline-flex items-center` (pas sur un
 * `absolute top-0.5` fragile) : track 24px, thumb 20px → 2px de marge haut/bas
 * garantie. Le déplacement horizontal est borné à 2px → 22px pour des marges
 * symétriques dans un track de 44px.
 */
export function Toggle({ checked, onChange, disabled, ...rest }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900",
        "disabled:cursor-not-allowed disabled:opacity-60",
        checked ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600",
      )}
      {...rest}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none inline-block size-5 rounded-full bg-white shadow transition-transform duration-200 ease-in-out",
          checked ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
