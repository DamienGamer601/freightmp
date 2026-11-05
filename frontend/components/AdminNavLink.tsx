"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

/** Lien « Admin » affiché uniquement pour les administrateurs et modérateurs. */
export default function AdminNavLink() {
  const { user } = useAuth();

  if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
    return null;
  }

  return (
    <Link
      href="/admin"
      className="rounded-lg px-3 py-2 text-sm font-semibold text-rouge-400 transition-colors hover:bg-white/5 hover:text-rouge-300"
    >
      Admin
    </Link>
  );
}
