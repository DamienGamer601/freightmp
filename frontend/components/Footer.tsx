import Link from "next/link";
import { getDiscordAuthUrl, getSteamAuthUrl } from "@/lib/api";

const navLinks = [
  { label: "Accueil", href: "/" },
  { label: "Fonctionnalités", href: "/#fonctionnalites" },
  { label: "Serveurs", href: "/#serveurs" },
];

export default function Footer() {
  const steamUrl = getSteamAuthUrl();
  const discordUrl = getDiscordAuthUrl();

  return (
    <footer id="communaute" className="relative border-t border-white/[0.06] bg-charbon-950">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rouge-500/50 to-transparent" />
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <a href="/" className="flex items-center gap-2.5">
              <img
                src="/freightmp-logo.png"
                alt="FreightMP"
                className="h-11 w-11 rounded-xl object-contain"
              />
              <span className="font-display text-lg font-bold tracking-tight text-white">
                Freight<span className="text-rouge-400">MP</span>
              </span>
            </a>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-zinc-500">
              La plateforme multijoueur alternative pour Euro Truck Simulator 2 et
              American Truck Simulator.
            </p>
            <div className="mt-5 flex gap-2">
              <a href={steamUrl} className="btn-ghost btn-sm">
                Steam
              </a>
              <a href={discordUrl} className="btn-ghost btn-sm">
                Discord
              </a>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
              Navigation
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-zinc-400 transition-colors hover:text-white"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
              Communauté
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <a href={discordUrl} className="text-zinc-400 transition-colors hover:text-white">
                  Serveur Discord
                </a>
              </li>
              <li>
                <a href={steamUrl} className="text-zinc-400 transition-colors hover:text-white">
                  Connexion Steam
                </a>
              </li>
              <li>
                <a
                  href="https://discord.com/api/oauth2/authorize"
                  className="text-zinc-400 transition-colors hover:text-white"
                >
                  Documentation API
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
              Légal
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link
                  href="/terms-of-service"
                  className="text-zinc-400 transition-colors hover:text-white"
                >
                  Conditions d’utilisation
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy-policy"
                  className="text-zinc-400 transition-colors hover:text-white"
                >
                  Politique de confidentialité
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-white/[0.06] pt-6 text-center">
          <p className="text-sm text-zinc-500">
            © FR | Industries Corporation. Tous droits réservés.
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-xs leading-relaxed text-zinc-600">
            FreightMP est un projet communautaire indépendant. Il n&apos;est ni affilié à,
            ni approuvé par SCS Software. Euro Truck Simulator 2 et American Truck
            Simulator sont des marques de SCS Software.
          </p>
        </div>
      </div>
    </footer>
  );
}

function TruckMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
    </svg>
  );
}
