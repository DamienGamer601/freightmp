"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchMe,
  logout as logoutRequest,
  type MeResponse,
} from "@/lib/auth";

export interface UseAuthResult {
  /** Profil connecté, ou `null` si non authentifié. */
  user: MeResponse | null;
  /** `true` pendant la résolution initiale ou un `refetch()`. */
  loading: boolean;
  /** Message d'erreur éventuel (résolution échouée). */
  error: string | null;
  /** Relance la récupération du profil courant. */
  refetch: () => Promise<void>;
  /** Déconnecte l'utilisateur puis réinitialise l'état local. */
  logout: () => Promise<void>;
}

/**
 * Hook d'état d'authentification. Au montage (navigateur uniquement,
 * `fetchMe` gère la garde SSR), récupère le profil courant.
 */
export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await fetchMe();
      setUser(me);
    } catch {
      setUser(null);
      setError("Impossible de charger votre profil.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
    setError(null);
    await refetch();
  }, [refetch]);

  return { user, loading, error, refetch, logout };
}
