"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { PushSubscribe } from "@/components/push-subscribe";
import { LogoutButton } from "@/app/dashboard/logout-button";

type HeaderUser = {
  prenom: string;
  nom?: string | null;
  email?: string | null;
  photoUrl?: string | null;
};

export function AppHeader({
  title,
  back,
  user,
  isAdmin = false,
}: {
  title?: string;
  back?: { href: string; label?: string };
  user: HeaderUser;
  isAdmin?: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {back ? (
            <Link
              href={back.href}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label={back.label ?? "Retour"}
            >
              <ArrowLeft className="size-4 shrink-0" />
              <span className="hidden sm:inline">
                {back.label ?? "Retour"}
              </span>
            </Link>
          ) : (
            <Link href="/dashboard" aria-label="Tableau de bord" className="shrink-0">
              <Logo size="sm" />
            </Link>
          )}
          {title && (
            <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
              {title}
            </h1>
          )}
        </div>
        <UserMenu user={user} isAdmin={isAdmin} />
      </div>
    </header>
  );
}

function UserMenu({ user, isAdmin }: { user: HeaderUser; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white p-1 pr-2 transition active:scale-95 transition-transform hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
      >
        <Avatar
          photoUrl={user.photoUrl ?? null}
          prenom={user.prenom}
          nom={user.nom ?? ""}
          size="sm"
        />
        <ChevronDown
          className={`size-3.5 text-slate-500 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
          onClick={(e) => {
            // close on item click but not on settings buttons
            const target = e.target as HTMLElement;
            if (target.closest("a[href]")) setOpen(false);
          }}
        >
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <Avatar
                photoUrl={user.photoUrl ?? null}
                prenom={user.prenom}
                nom={user.nom ?? ""}
                size="md"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {user.prenom}
                  {user.nom ? ` ${user.nom}` : ""}
                </p>
                {user.email && (
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {user.email}
                  </p>
                )}
              </div>
            </div>
          </div>

          <nav className="py-1">
            <MenuLink href="/profil" icon={<User className="size-4" />}>
              Mon profil
            </MenuLink>
            <MenuLink href="/calendrier" icon={<Calendar className="size-4" />}>
              Calendrier
            </MenuLink>
            <MenuLink href="/welcome" icon={<Sparkles className="size-4" />}>
              Découvrir l&apos;app
            </MenuLink>
            {isAdmin && (
              <MenuLink href="/admin" icon={<ShieldCheck className="size-4" />}>
                Administration
              </MenuLink>
            )}
          </nav>

          <div className="border-t border-slate-200 px-3 py-3 dark:border-slate-800">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Préférences
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <PushSubscribe />
              <ThemeToggle />
            </div>
          </div>

          <div className="border-t border-slate-200 p-3 dark:border-slate-800">
            <LogoutButton />
          </div>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      <span className="text-slate-500 dark:text-slate-400">{icon}</span>
      {children}
    </Link>
  );
}
