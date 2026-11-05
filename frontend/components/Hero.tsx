"use client";

import { useEffect, useState } from "react";
import {
  fetchServersStatus,
  getDiscordAuthUrl,
  getSteamAuthUrl,
} from "@/lib/api";

const steamUrl = getSteamAuthUrl();
const discordUrl = getDiscordAuthUrl();

export default function Hero() {
  const [totalOnline, setTotalOnline] = useState<number | null>(null);
  const [totalServers, setTotalServers] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const data = await fetchServersStatus();
        if (!active) return;
        setTotalOnline(data.totalOnline);
        setTotalServers(data.totalServers);
      } catch {
        // Le badge affichera un état neutre en cas d'indisponibilité.
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  return (
    <section id="accueil" className="relative overflow-hidden">
      {/* Fond : halo radial + grille */}
      <div className="pointer-events-none absolute inset-0 hero-glow" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-0 bg-grid bg-grid-mask"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-20 sm:px-6 sm:pt-28 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-rouge-500" />
            FR | Industries Corporation
          </p>

          <img
            src="/freightmp-logo.png"
            alt="FreightMP"
            className="mx-auto mt-8 h-28 w-28 object-contain drop-shadow-2xl sm:h-36 sm:w-36"
          />

          <h1 className="gradient-text mt-4 font-display text-5xl font-extrabold tracking-tight sm:text-7xl">
            Freight<span className="text-rouge-400">MP</span>
          </h1>

          <p className="mt-5 text-xl font-semibold text-zinc-100 sm:text-2xl">
            La plateforme multijoueur alternative pour{" "}
            <span className="text-rouge-400">ETS2</span> &{" "}
            <span className="text-rouge-400">ATS</span>.
          </p>

          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-zinc-400">
            Rejoignez des milliers de camionneurs virtuels sur un réseau dédié, stable et
            modéré. Convois synchronisés, télémetrie en temps réel et communauté active :
            FreightMP redéfinit le multijoueur du simulateur de camion.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href={steamUrl} className="btn-primary w-full sm:w-auto">
              <SteamIcon className="h-4 w-4" />
              Se connecter avec Steam
            </a>
            <a href={discordUrl} className="btn-ghost w-full sm:w-auto">
              <DiscordIcon className="h-4 w-4" />
              Se connecter avec Discord
            </a>
          </div>

          <div className="mt-6">
            <LiveCountBadge
              totalOnline={totalOnline}
              totalServers={totalServers}
            />
          </div>
        </div>

        {/* Bandeau de statistiques */}
        <div className="mx-auto mt-16 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat
            value={totalServers === null ? "—" : String(totalServers)}
            label="Serveurs dédiés"
          />
          <Stat
            value={totalOnline === null ? "—" : String(totalOnline)}
            label="Camionneurs en ligne"
          />
          <Stat value="1.51" label="Version ETS2" />
          <Stat value="24/7" label="Disponibilité" />
        </div>
      </div>
    </section>
  );
}

function LiveCountBadge({
  totalOnline,
  totalServers,
}: {
  totalOnline: number | null;
  totalServers: number | null;
}) {
  const hasData = totalOnline !== null && totalServers !== null;

  return (
    <div className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-charbon-800/80 px-4 py-2 text-sm">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
      </span>
      {hasData ? (
        <span className="text-zinc-300">
          <span className="font-semibold text-white">{totalOnline}</span> camionneurs en
          ligne · <span className="font-semibold text-white">{totalServers}</span>{" "}
          serveurs
        </span>
      ) : (
        <span className="text-zinc-400">Connexion au réseau…</span>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-charbon-800/60 px-4 py-5 text-center backdrop-blur">
      <div className="text-2xl font-bold text-white sm:text-3xl">{value}</div>
      <div className="mt-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </div>
    </div>
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
