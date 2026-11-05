import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { getServerStatus, type ServerStatusResponse } from '../api';
import { config } from '../config';

const EMBED_COLOR = 0xe23a3a;

export const data = new SlashCommandBuilder()
  .setName('status')
  .setDescription("Afficher l'état du réseau multijoueur FreightMP");

function formatUpdatedAt(updatedAt: string): string {
  const date = new Date(updatedAt);
  return Number.isNaN(date.getTime()) ? updatedAt : date.toLocaleString('fr-FR');
}

function buildStatusEmbed(status: ServerStatusResponse): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle('🛻 FreightMP — État du réseau')
    .addFields({ name: 'Joueurs en ligne', value: String(status.totalOnline), inline: true })
    .setFooter({ text: `Mis à jour le ${formatUpdatedAt(status.updatedAt)}` });

  for (const server of status.servers) {
    embed.addFields({
      name: `${server.name} (${server.game})`,
      value: [
        `Région : ${server.region}`,
        `Statut : ${server.status}`,
        `Joueurs : ${server.onlinePlayers}/${server.maxPlayers}`,
      ].join('\n'),
      inline: true,
    });
  }

  return embed;
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  try {
    const status = await getServerStatus(config.apiUrl);
    const embed = buildStatusEmbed(status);
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('[status] Failed to fetch server status:', error);
    await interaction.editReply({ content: 'Le réseau est indisponible pour le moment.' });
  }
}

export default { data, execute };
