import UserMenu from "@/components/UserMenu";
import AdminNavLink from "@/components/AdminNavLink";
import NotificationBell from "@/components/NotificationBell";
import Link from "next/link";

const navLinks = [
  { label: "Accueil", href: "/" },
  { label: "Multijoueur", href: "/multiplayer" },
  { label: "Carte", href: "/map" },
  { label: "VTC", href: "/vtcs" },
  { label: "Classement", href: "/leaderboard" },
  { label: "Événements", href: "/events" },
];

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-charbon-950/60 backdrop-blur-2xl">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex items-center gap-2.5">
          <img
            src="/freightmp-logo.png"
            alt="FreightMP"
            className="h-10 w-10 rounded-xl object-contain transition-transform duration-300 group-hover:scale-105"
          />
          <span className="font-display text-lg font-bold tracking-tight text-white">
            Freight<span className="text-rouge-400">MP</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group relative rounded-lg px-3.5 py-2 text-sm font-medium text-zinc-400 transition-colors hover:text-white"
            >
              {link.label}
              <span className="absolute inset-x-3 -bottom-px h-px scale-x-0 bg-gradient-to-r from-transparent via-rouge-500 to-transparent transition-transform duration-300 group-hover:scale-x-100" />
            </Link>
          ))}
          <AdminNavLink />
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/messages"
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
            aria-label="Messagerie"
            title="Messagerie"
          >
            <ChatMark className="h-5 w-5" />
          </Link>
          <NotificationBell />
          <UserMenu />
        </div>
      </nav>
    </header>
  );
}

function ChatMark({ className }: { className?: string }) {
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
        d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025 2.25 2.25 0 0 0-.012-.135C4.11 17.72 3 15.09 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
      />
    </svg>
  );
}
