import { Client, Events, GatewayIntentBits, Interaction } from 'discord.js';
import statusCommand from './commands/status';
import { config } from './config';
import { startRoleSyncLoop } from './sync/roles';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user?.tag ?? 'unknown'}`);
  startRoleSyncLoop(client, config);
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  if (interaction.commandName === statusCommand.data.name) {
    try {
      await statusCommand.execute(interaction);
    } catch (error) {
      console.error(`[command] Error running /${interaction.commandName}:`, error);
    }
  }
});

function shutdown(): void {
  console.log('Shutting down...');
  client.destroy();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

void client.login(config.discordBotToken);
