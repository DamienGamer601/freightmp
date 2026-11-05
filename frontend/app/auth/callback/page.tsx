"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

type CallbackState = "success" | "error";

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<CallbackShell state="success" />}>
      <AuthCallbackContent />
    </Suspense>
  );
}

function AuthCallbackContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const state: CallbackState = error ? "error" : "success";

  return <CallbackShell state={state} message={error ?? undefined} />;
}

function CallbackShell({
  state,
  message,
}: {
  state: CallbackState;
  message?: string;
}) {
  return (
    <section className="relative flex min-h-[70vh] items-center justify-center overflow-hidden px-4 py-20">
      <div className="pointer-events-none absolute inset-0 hero-glow" aria-hidden="true" />

      <div className="relative w-full max-w-md card p-8 text-center backdrop-blur">
        {state === "success" ? (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
              <CheckIcon className="h-6 w-6" />
            </div>
            <h1 className="mt-5 text-xl font-bold text-white">Connexion réussie</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Vous êtes maintenant connecté à FreightMP. Bonne route !
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/profile"
                className="inline-flex items-center justify-center rounded-xl bg-rouge-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-rouge-400"
              >
                Accéder à mon profil
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-zinc-100 transition-colors hover:bg-white/10"
              >
                Retour à l&apos;accueil
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rouge-500/15 text-rouge-400">
              <XIcon className="h-6 w-6" />
            </div>
            <h1 className="mt-5 text-xl font-bold text-white">Connexion impossible</h1>
            <p className="mt-2 text-sm text-zinc-400">
              {message ?? "Une erreur est survenue lors de l'authentification."}
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-zinc-100 transition-colors hover:bg-white/10"
            >
              Retour à l&apos;accueil
            </Link>
          </>
        )}
      </div>
    </section>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={className}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={className}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}
