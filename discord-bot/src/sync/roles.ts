import { Client } from 'discord.js';
import { getInternalRoles } from '../api';
import { configuredRoleIds, roleMap } from '../config';
import type { Config } from '../config';

export async function syncRoles(client: Client, config: Config): Promise<number> {
  const guild = client.guilds.cache.get(config.discordGuildId);
  if (!guild) {
    throw new Error(
      `Guild ${config.discordGuildId} not found. Make sure the bot is a member of the guild.`,
    );
  }

  const { users } = await getInternalRoles(config.apiUrl, config.internalApiKey);

  // NOTE: fetching the full member list requires the privileged Gateway intent
  // GUILD_MEMBERS. It must be enabled in the Discord Developer Portal under
  // "Bot" → "Privileged Gateway Intents" → "SERVER MEMBERS INTENT", otherwise
  // guild.members.fetch() only returns members that are already cached.
  await guild.members.fetch();

  const configuredIds = configuredRoleIds();
  let synced = 0;

  for (const user of users) {
    if (!user.discordId) {
      continue;
    }

    const member = guild.members.cache.get(user.discordId);
    if (!member) {
      // User is not a member of this guild; skip.
      continue;
    }

    const targetRoleId = roleMap[user.role];
    if (!targetRoleId) {
      // No Discord role is configured for this platform role; skip.
      continue;
    }

    try {
      // Adding/removing roles requires the MANAGE_ROLES permission.
      if (!member.roles.cache.has(targetRoleId)) {
        await member.roles.add(targetRoleId);
      }

      // Remove any other configured FMP roles that are no longer correct.
      for (const roleId of configuredIds) {
        if (roleId !== targetRoleId && member.roles.cache.has(roleId)) {
          await member.roles.remove(roleId);
        }
      }

      synced += 1;
    } catch (error) {
      console.warn(`[role-sync] Failed to sync roles for ${user.discordId}:`, error);
    }
  }

  console.log(`[role-sync] Synced ${synced} member(s).`);
  return synced;
}

export function startRoleSyncLoop(client: Client, config: Config): NodeJS.Timeout {
  const intervalMs = config.roleSyncIntervalMinutes * 60 * 1000;

  const run = async (): Promise<void> => {
    try {
      await syncRoles(client, config);
    } catch (error) {
      console.error('[role-sync] Role synchronization failed:', error);
    }
  };

  void run();

  return setInterval(() => {
    void run();
  }, intervalMs);
}
