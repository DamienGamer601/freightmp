import dotenv from 'dotenv';
import type { PlatformRole } from './api';

dotenv.config();

export interface Config {
  discordBotToken: string;
  discordGuildId: string;
  discordClientId: string;
  apiUrl: string;
  internalApiKey: string;
  roleAdminId: string;
  roleDevId: string;
  roleModeratorId: string;
  roleDriverId: string;
  roleSyncIntervalMinutes: number;
  registerCommands: boolean;
}

function env(name: string): string {
  return process.env[name] ?? '';
}

function parsePositiveInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

export const config: Config = {
  discordBotToken: env('DISCORD_BOT_TOKEN'),
  discordGuildId: env('DISCORD_GUILD_ID'),
  discordClientId: env('DISCORD_CLIENT_ID'),
  apiUrl: env('API_URL') || 'http://localhost:4000',
  internalApiKey: env('INTERNAL_API_KEY'),
  roleAdminId: env('ROLE_ADMIN_ID'),
  roleDevId: env('ROLE_DEV_ID'),
  roleModeratorId: env('ROLE_MODERATOR_ID'),
  roleDriverId: env('ROLE_DRIVER_ID'),
  roleSyncIntervalMinutes: parsePositiveInt(env('ROLE_SYNC_INTERVAL_MINUTES'), 15),
  registerCommands: env('REGISTER_COMMANDS').toLowerCase() !== 'false',
};

if (!config.discordBotToken) {
  throw new Error('DISCORD_BOT_TOKEN is required. Set it in your .env file.');
}

// Maps a FreightMP platform role to the configured Discord role id.
// Entries are only included when the corresponding role id has been set.
export const roleMap: Partial<Record<PlatformRole, string>> = {};
if (config.roleAdminId) roleMap.ADMIN = config.roleAdminId;
if (config.roleDevId) roleMap.DEV = config.roleDevId;
if (config.roleModeratorId) roleMap.MODERATOR = config.roleModeratorId;
if (config.roleDriverId) roleMap.DRIVER = config.roleDriverId;

export function configuredRoleIds(): string[] {
  return Object.values(roleMap);
}
