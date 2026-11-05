import { REST, Routes } from 'discord.js';
import { data as statusCommandData } from './commands/status';
import { config } from './config';

async function main(): Promise<void> {
  if (!config.discordClientId) {
    throw new Error('DISCORD_CLIENT_ID is required to register commands.');
  }

  const body = [statusCommandData.toJSON()];
  const rest = new REST({ version: '10' }).setToken(config.discordBotToken);

  try {
    if (config.discordGuildId) {
      console.log(`Registering ${body.length} command(s) in guild ${config.discordGuildId}...`);
      await rest.put(
        Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId),
        { body },
      );
    } else {
      console.log(`Registering ${body.length} command(s) globally...`);
      await rest.put(Routes.applicationCommands(config.discordClientId), { body });
    }
    console.log('Successfully registered application commands.');
  } catch (error) {
    console.error('Failed to register application commands:', error);
    process.exitCode = 1;
  }
}

void main();
