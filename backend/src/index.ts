import http from "node:http";
import app from "./app";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { createWebSocketServer } from "./websocket/server";

const server = http.createServer(app);
createWebSocketServer(server);

server.listen(env.apiPort, () => {
  logger.info(`FreightMP API listening on port ${env.apiPort} (${env.NODE_ENV})`);
});

async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received, shutting down gracefully...`);

  server.close(async () => {
    try {
      await prisma.$disconnect();
      logger.info("HTTP server closed and Prisma disconnected");
      process.exit(0);
    } catch (error) {
      logger.error("Error during shutdown", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

  // Force-exit if graceful shutdown hangs.
  setTimeout(() => {
    logger.warn("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
