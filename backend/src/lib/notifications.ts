import { prisma } from "./prisma";

/**
 * Crée une notification pour un utilisateur.
 * Ne doit jamais faire échouer l'action métier.
 */
export async function notifyUser(input: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
}): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
      },
    });
  } catch {
    // Les notifications sont best-effort.
  }
}
