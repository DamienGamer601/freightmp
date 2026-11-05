import { createHash, randomBytes } from "node:crypto";

export const API_KEY_PREFIX = "fmp_";

/** Hachage SHA-256 d'une clé API (on ne stocke jamais la clé en clair). */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export interface GeneratedApiKey {
  /** Clé en clair — à afficher une seule fois. */
  key: string;
  /** Préfixe affichable (ex. `fmp_ab12cd34`). */
  prefix: string;
  hash: string;
}

/** Génère une nouvelle clé API `fmp_<64 hex>`. */
export function generateApiKey(): GeneratedApiKey {
  const key = `${API_KEY_PREFIX}${randomBytes(32).toString("hex")}`;
  return {
    key,
    prefix: key.slice(0, 12),
    hash: hashApiKey(key),
  };
}

/** Vrai si la chaîne ressemble à une clé API FreightMP. */
export function looksLikeApiKey(value: string): boolean {
  return value.startsWith(API_KEY_PREFIX) && value.length > API_KEY_PREFIX.length + 16;
}
