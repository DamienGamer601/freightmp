"use client";

import { useState } from "react";
import { getLinkUrl, unlinkAccount } from "@/lib/auth";

interface LinkedAccountsProps {
  steamId: string | null;
  discordId: string | null;
  onChanged?: () => void;
}

interface ProviderRow {
  id: "steam" | "discord";
  label: string;
  linkedId: string | null;
  description: string;
}

export default function LinkedAccounts({
  steamId,
  discordId,
  onChanged,
}: LinkedAccountsProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(
    null,
  );

  const providers: ProviderRow[] = [
    {
      id: "steam",
      label: "Steam",
      linkedId: steamId,
      description: "Requis pour jouer en multijoueur et afficher votre profil Steam.",
    },
    {
      id: "discord",
      label: "Discord",
      linkedId: discordId,
      description: "Pour vous connecter et recevoir les notifications sur Discord.",
    },
  ];

  async function connect(provider: "steam" | "discord") {
    setBusy(provider);
    setMessage(null);
    try {
      const url = await getLinkUrl(provider);
      if (!url) {
        setMessage({ kind: "error", text: "Impossible de démarrer la liaison." });
        return;
      }
      window.location.href = url;
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(provider: "steam" | "discord") {
    setBusy(provider);
    setMessage(null);
    try {
      const error = await unlinkAccount(provider);
      if (error) {
        setMessage({ kind: "error", text: error });
        return;
      }
      setMessage({ kind: "ok", text: "Compte délié." });
      onChanged?.();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card p-6 backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Comptes liés</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Connectez Steam et Discord à votre profil FreightMP pour retrouver vos
            données partout.
          </p>
        </div>
        <span className="pill shrink-0">
          {[steamId, discordId].filter(Boolean).length}/2
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {providers.map((provider) => (
          <div
            key={provider.id}
            className="flex flex-col gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-lg">
                {provider.id === "steam" ? "🎮" : "💬"}
              </span>
              <div>
                <p className="font-medium text-white">
                  {provider.label}
                  {provider.linkedId ? (
                    <span className="ml-2 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                      Lié
                    </span>
                  ) : (
                    <span className="ml-2 rounded-full bg-zinc-500/10 px-2 py-0.5 text-xs font-semibold text-zinc-400">
                      Non lié
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {provider.linkedId
                    ? `ID : ${provider.linkedId}`
                    : provider.description}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              {provider.linkedId ? (
                <button
                  type="button"
                  onClick={() => disconnect(provider.id)}
                  disabled={busy === provider.id}
                  className="btn-ghost btn-sm disabled:opacity-50"
                >
                  {busy === provider.id ? "…" : "Délier"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => connect(provider.id)}
                  disabled={busy === provider.id}
                  className="btn-primary btn-sm disabled:opacity-50"
                >
                  {busy === provider.id ? "…" : `Connecter ${provider.label}`}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {message && (
        <p
          className={`mt-4 text-sm ${message.kind === "ok" ? "text-emerald-400" : "text-rouge-400"}`}
        >
          {message.text}
        </p>
      )}
    </section>
  );
}
