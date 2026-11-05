import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  // Port fourni par la plateforme d'hébergement (Railway, Render, Heroku…).
  PORT: z.coerce.number().int().positive().optional(),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  JWT_ACCESS_EXPIRES: z.string().min(1).default("15m"),
  JWT_REFRESH_EXPIRES: z.string().min(1).default("30d"),
  FRONTEND_URL: z.string().url(),
  API_URL: z.string().url(),
  STEAM_API_KEY: z.string().default(""),
  STEAM_RETURN_URL: z.string().url(),
  DISCORD_CLIENT_ID: z.string().default(""),
  DISCORD_CLIENT_SECRET: z.string().default(""),
  DISCORD_RETURN_URL: z.string().url(),
  INTERNAL_API_KEY: z.string().min(1),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
});

const parsed = envSchema.parse(process.env);

export const env = {
  NODE_ENV: parsed.NODE_ENV,
  API_PORT: parsed.API_PORT,
  PORT: parsed.PORT,
  DATABASE_URL: parsed.DATABASE_URL,
  JWT_SECRET: parsed.JWT_SECRET,
  JWT_ACCESS_EXPIRES: parsed.JWT_ACCESS_EXPIRES,
  JWT_REFRESH_EXPIRES: parsed.JWT_REFRESH_EXPIRES,
  FRONTEND_URL: parsed.FRONTEND_URL,
  API_URL: parsed.API_URL,
  STEAM_API_KEY: parsed.STEAM_API_KEY,
  STEAM_RETURN_URL: parsed.STEAM_RETURN_URL,
  DISCORD_CLIENT_ID: parsed.DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET: parsed.DISCORD_CLIENT_SECRET,
  DISCORD_RETURN_URL: parsed.DISCORD_RETURN_URL,
  INTERNAL_API_KEY: parsed.INTERNAL_API_KEY,
  CORS_ORIGINS: parsed.CORS_ORIGINS,

  // Helpers
  // Priorité au port fourni par la plateforme (Railway/Render/Heroku).
  apiPort: parsed.PORT ?? parsed.API_PORT,
  isProduction: parsed.NODE_ENV === "production",
  databaseUrl: parsed.DATABASE_URL,
  jwtSecret: parsed.JWT_SECRET,
  jwtAccessExpires: parsed.JWT_ACCESS_EXPIRES,
  jwtRefreshExpires: parsed.JWT_REFRESH_EXPIRES,
  frontendUrl: parsed.FRONTEND_URL,
  apiUrl: parsed.API_URL,
  steamApiKey: parsed.STEAM_API_KEY,
  steamReturnUrl: parsed.STEAM_RETURN_URL,
  discordClientId: parsed.DISCORD_CLIENT_ID,
  discordClientSecret: parsed.DISCORD_CLIENT_SECRET,
  discordReturnUrl: parsed.DISCORD_RETURN_URL,
  internalApiKey: parsed.INTERNAL_API_KEY,
  corsOrigins: parsed.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};

export type Env = typeof env;
