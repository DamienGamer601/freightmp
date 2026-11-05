import { Client, Events, GatewayIntentBits } from 'discord.js';
import { config } from './config';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async (ready) => {
  console.log(`Connecté en tant que ${ready.user?.tag ?? 'inconnu'}`);

  const guild = ready.guilds.cache.get(config.discordGuildId);
  if (!guild) {
    console.error(
      `Guilde ${config.discordGuildId} introuvable. Vérifiez DISCORD_GUILD_ID et que le bot y est bien présent.`,
    );
    await client.destroy();
    process.exit(1);
  }

  const roles = await guild.roles.fetch();
  const sorted = [...roles.values()].sort((a, b) => b.position - a.position);

  console.log(`\nRôles du serveur "${guild.name}" (${sorted.length}) :\n`);
  for (const role of sorted) {
    if (role.name === '@everyone') continue;
    console.log(`- ${role.name.padEnd(28)} id: ${role.id}`);
  }

  console.log('\nCopiez les IDs correspondants dans votre .env :');
  console.log('  ROLE_ADMIN_ID=<id rôle Admin>');
  console.log('  ROLE_DEV_ID=<id rôle Dev>');
  console.log('  ROLE_MODERATOR_ID=<id rôle Moderator>');
  console.log('  ROLE_DRIVER_ID=<id rôle Driver>');
  console.log('\nEnsuite redémarrez le bot (npm run dev) pour activer la synchronisation.');

  await client.destroy();
  process.exit(0);
});

void client.login(config.discordBotToken).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Erreur de connexion Discord :', message);
  process.exit(1);
});
