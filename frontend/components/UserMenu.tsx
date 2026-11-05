"use client";

import Link from "next/link";
import { getDiscordAuthUrl, getSteamAuthUrl } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import type { MeResponse } from "@/lib/auth";

/**
 * Menu d'authentification de la barre de navigation :
 * squelette pendant le chargement, boutons Steam/Discord si déconnecté,
 * avatar + pseudo + « Mon profil » + « Déconnexion » si connecté.
 */
export default function UserMenu() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-9 w-9 animate-pulse rounded-full bg-white/10" />
        <div className="hidden h-4 w-24 animate-pulse rounded-md bg-white/10 sm:block" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <a
          href={getSteamAuthUrl()}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-rouge-500/50 hover:bg-white/10 hover:text-white"
        >
          <SteamIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Steam</span>
        </a>
        <a
          href={getDiscordAuthUrl()}
          className="inline-flex items-center gap-2 rounded-lg bg-[#5865F2] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4752c4]"
        >
          <DiscordIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Discord</span>
        </a>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <Link
        href="/profile"
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5"
        title={user.username}
      >
        <Avatar user={user} />
        <span className="hidden max-w-[8rem] truncate text-sm font-medium text-zinc-200 sm:inline">
          {user.username}
        </span>
      </Link>

      <Link
        href="/dashboard"
        className="hidden rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white md:inline-flex"
      >
        Mon espace
      </Link>

      <Link
        href="/profile"
        className="hidden rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white md:inline-flex"
      >
        Mon profil
      </Link>

      <button
        type="button"
        onClick={() => void logout()}
        className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-rouge-500/50 hover:bg-white/10 hover:text-white"
      >
        <LogoutIcon className="h-4 w-4" />
        <span className="hidden sm:inline">Déconnexion</span>
      </button>
    </div>
  );
}

function Avatar({ user }: { user: MeResponse }) {
  if (user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatarUrl}
        alt={`Avatar de ${user.username}`}
        className="h-8 w-8 rounded-full object-cover ring-1 ring-white/10"
      />
    );
  }

  const initial = user.username.charAt(0).toUpperCase();
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-carbone-500 text-sm font-semibold text-white">
      {initial}
    </span>
  );
}

function SteamIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7.5 7.5h9a5.5 5.5 0 0 1 5.5 5.5v.5a2.5 2.5 0 0 1-2.5 2.5h-1.25a2.5 2.5 0 0 1-2.25-1.38l-.2-.4a2.5 2.5 0 0 0-2.24-1.32h-2.12a2.5 2.5 0 0 0-2.24 1.32l-.2.4A2.5 2.5 0 0 1 6.25 16H5a2.5 2.5 0 0 1-2.5-2.5V13a5.5 5.5 0 0 1 5-5.5Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10.5v3M6.5 12h3" />
      <circle cx="16" cy="11.5" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="18" cy="13.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M20.317 4.3698a19.7913 19.7913 0 0 0-4.8851-1.5152.0741.0741 0 0 0-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 0 0-.0785-.037 19.7363 19.7363 0 0 0-4.8852 1.515.0699.0699 0 0 0-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 0 0 .0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 0 0 .0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 0 0-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 0 1-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 0 1 .0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 0 1 .0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 0 1-.0066.1276 12.2986 12.2986 0 0 1-1.873.8914.0766.0766 0 0 0-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 0 0 .0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 0 0 .0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 0 0-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
    </svg>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 15l3-3-3-3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h12" />
    </svg>
  );
}
