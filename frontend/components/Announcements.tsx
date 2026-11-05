"use client";

import { useEffect, useState } from "react";
import { fetchAnnouncements, type Announcement } from "@/lib/announcements";

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function Announcements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    let active = true;
    fetchAnnouncements()
      .then((data) => {
        if (active) setAnnouncements(data);
      })
      .catch(() => {
        /* section masquée si l'API ne répond pas */
      });
    return () => {
      active = false;
    };
  }, []);

  if (announcements.length === 0) {
    return null;
  }

  return (
    <section id="annonces" className="relative px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-rouge-400">
            Actualités
          </p>
          <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">
            Dernières annonces
          </h2>
          <p className="mt-3 text-zinc-400">
            Toutes les nouveautés du réseau FreightMP, directement depuis
            l&apos;équipe.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {announcements.map((announcement) => (
            <article
              key={announcement.id}
              className="flex flex-col rounded-2xl border border-white/5 bg-charbon-800/80 p-6 backdrop-blur"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full border border-rouge-500/30 bg-rouge-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rouge-400">
                  Annonce
                </span>
                <time className="text-xs text-zinc-500">
                  {formatDate(announcement.createdAt)}
                </time>
              </div>
              <h3 className="mt-3 text-lg font-semibold text-white">
                {announcement.title}
              </h3>
              <p className="mt-2 flex-1 whitespace-pre-line text-sm leading-relaxed text-zinc-400">
                {announcement.body}
              </p>
              <p className="mt-4 text-xs text-zinc-500">
                par{" "}
                <span className="font-medium text-zinc-300">
                  {announcement.authorUsername}
                </span>
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
