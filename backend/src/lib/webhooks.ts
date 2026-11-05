import { createHmac, randomBytes } from "node:crypto";
import { logger } from "./logger";

export interface WebhookPayload {
  event: string;
  data: unknown;
  timestamp: number;
}

/** Génère un secret de signature de webhook. */
export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("hex")}`;
}

/** Signe un corps de webhook (HMAC-SHA256, format `t=...,v1=...`). */
export function signWebhookPayload(secret: string, body: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

/** Vérifie une signature de webhook (utilisé côté intégrateur, et en test). */
export function verifyWebhookSignature(
  secret: string,
  body: string,
  header: string,
  toleranceSeconds = 300,
): boolean {
  const parts = Object.fromEntries(
    header.split(",").map((part) => part.split("=") as [string, string]),
  );
  const timestamp = Number(parts.t);
  if (!Number.isFinite(timestamp)) {
    return false;
  }
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > toleranceSeconds) {
    return false;
  }
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  return expected === parts.v1;
}

interface DeliverOptions {
  url: string;
  secret: string;
  event: string;
  data: unknown;
}

/**
 * Livre un événement à un webhook (fire-and-forget, avec timeout).
 * Retourne le statut HTTP ou `null` en cas d'échec réseau.
 */
export async function deliverWebhook(
  options: DeliverOptions,
): Promise<number | null> {
  const payload: WebhookPayload = {
    event: options.event,
    data: options.data,
    timestamp: Date.now(),
  };
  const body = JSON.stringify(payload);
  const signature = signWebhookPayload(options.secret, body);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(options.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "FreightMP-Webhooks/1.0",
        "X-FMP-Event": options.event,
        "X-FMP-Signature": signature,
      },
      body,
      signal: controller.signal,
    });
    return response.status;
  } catch (error) {
    logger.warn(
      `Webhook ${options.url} échoué : ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
