import { createHmac } from 'crypto';
import {
  SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
} from 'discord.js';
import { roleProblem } from '../features/roles.js';

export const data = new SlashCommandBuilder()
  .setName('webverify')
  .setDescription('ウェブ認証のボタンを作ります（人間チェック付き）')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addRoleOption((o) => o.setName('role').setDescription('認証した人に付けるロール').setRequired(true))
  .addStringOption((o) => o.setName('message').setDescription('表示する文章（改行は \\n）').setMaxLength(2000));

export async function execute(interaction) {
  const flags = MessageFlags.Ephemeral;
  const base = process.env.VERIFY_URL;
  const secret = process.env.SIGN_SECRET;
  if (!base || !secret) {
    return interaction.reply({ content: '⚠️ ウェブ認証がまだ設定されていません（VERIFY_URL と SIGN_SECRET が必要です）。', flags });
  }

  const role = interaction.options.getRole('role');
  const problem = roleProblem(role);
  if (problem) return interaction.reply({ content: `⚠️ ${problem}`, flags });

  const g = interaction.guildId;
  const sig = createHmac('sha256', secret).update(`${g}:${role.id}`).digest('hex');
  const link = `${base.replace(/\/$/, '')}/v?g=${g}&r=${role.id}&s=${sig}`;

  const msg = interaction.options.getString('message') ??
    'ボタンから認証ページを開いて、Discordでログインし、人間チェックを通すとロールが付きます。';
  const embed = new EmbedBuilder().setTitle('🔐 ウェブ認証').setDescription(msg.replaceAll('\\n', '\n')).setColor(0x5865f2);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel('認証ページを開く').setStyle(ButtonStyle.Link).setURL(link)
  );

  try {
    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: '✅ ウェブ認証のボタンを作りました。', flags });
  } catch (err) {
    console.error(err);
    await interaction.reply({ content: '❌ 送れませんでした。Botがこのチャンネルに書き込めるか確認してください。', flags });
  }
}
