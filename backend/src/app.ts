import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { rateLimiter } from "./middleware/rateLimit";
import authRoutes from "./routes/auth";
import meRoutes from "./routes/me";
import serversRoutes from "./routes/servers";
import playersRoutes from "./routes/players";
import profilesRoutes from "./routes/profiles";
import announcementsRoutes from "./routes/announcements";
import leaderboardRoutes from "./routes/leaderboard";
import notificationsRoutes from "./routes/notifications";
import friendsRoutes from "./routes/friends";
import messagesRoutes from "./routes/messages";
import eventsRoutes from "./routes/events";
import mpRoutes from "./routes/mp";
import vtcsRoutes from "./routes/vtcs";
import adminRoutes from "./routes/admin";
import telemetryRoutes from "./routes/telemetry";
import internalRoutes from "./routes/internal";
import keysRoutes from "./routes/keys";
import webhooksRoutes from "./routes/webhooks";
import publicRoutes from "./routes/public";
import { openApiSpec } from "./docs/openapi";

export function createApp(): Express {
  const app = express();

  // Derrière un reverse proxy (Railway, Render, Vercel…) : nécessaire pour que
  // `req.ip` reflète l'IP réelle du client (rate limiting par IP).
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  app.use(express.json());
  app.use("/api/v1/", rateLimiter);

  app.use((req, _res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
  });

  app.get("/api/v1/health", (_req, res) => {
    res.json({ status: "ok", service: "freightmp-api", time: new Date().toISOString() });
  });

  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/me", meRoutes);
  app.use("/api/v1/servers", serversRoutes);
  app.use("/api/v1/players", playersRoutes);
  app.use("/api/v1/profiles", profilesRoutes);
  app.use("/api/v1/announcements", announcementsRoutes);
  app.use("/api/v1/leaderboard", leaderboardRoutes);
  app.use("/api/v1/notifications", notificationsRoutes);
  app.use("/api/v1/friends", friendsRoutes);
  app.use("/api/v1/messages", messagesRoutes);
  app.use("/api/v1/events", eventsRoutes);
  app.use("/api/v1/mp", mpRoutes);
  app.use("/api/v1/vtcs", vtcsRoutes);
  app.use("/api/v1/admin", adminRoutes);
  app.use("/api/v1/telemetry", telemetryRoutes);
  app.use("/api/v1/internal", internalRoutes);
  app.use("/api/v1/keys", keysRoutes);
  app.use("/api/v1/webhooks", webhooksRoutes);
  app.use("/api/v1/public", publicRoutes);

  app.get("/api/v1/openapi.json", (_req, res) => {
    res.json(openApiSpec);
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();

export default app;
