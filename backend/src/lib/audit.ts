import { prisma } from "./prisma";

/**
 * Enregistre une action d'administration dans le journal d'audit.
 * Ne doit jamais faire échouer l'action métier.
 */
export async function recordAudit(input: {
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: unknown;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        details: input.details ? JSON.stringify(input.details) : null,
      },
    });
  } catch {
    // L'audit ne doit jamais casser une action métier.
  }
}
