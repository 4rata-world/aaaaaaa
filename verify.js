import {
  SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
} from 'discord.js';
import { roleProblem } from '../features/roles.js';

export const data = new SlashCommandBuilder()
  .setName('verify')
  .setDescription('押すとロールが付く認証ボタンを作ります')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addRoleOption((o) => o.setName('role').setDescription('認証した人に付けるロール').setRequired(true))
  .addIntegerOption((o) =>
    o.setName('min_days').setDescription('アカウント作成からこの日数たっていない人は弾く（0〜365）').setMinValue(0).setMaxValue(365)
  )
  .addStringOption((o) => o.setName('message').setDescription('表示する文章（改行は \\n）').setMaxLength(2000))
  .addStringOption((o) => o.setName('label').setDescription('ボタンの文字（初期値: 認証する）').setMaxLength(80));

export async function execute(interaction) {
  const role = interaction.options.getRole('role');
  const days = interaction.options.getInteger('min_days') ?? 0;

  const problem = roleProblem(role);
  if (problem) {
    return interaction.reply({ content: `⚠️ ${problem}`, flags: MessageFlags.Ephemeral });
  }

  let message = interaction.options.getString('message') ?? 'ボタンを押すと、認証されてロールが付きます。';
  message = message.replaceAll('\\n', '\n');
  if (days > 0) message += `\n\n-# Discordアカウントを作ってから${days}日以上の人が対象です。`;

  const embed = new EmbedBuilder().setTitle('✅ 認証').setDescription(message).setColor(0x2bc7a5);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`verify:${role.id}:${days}`)
      .setLabel(interaction.options.getString('label') ?? '認証する')
      .setStyle(ButtonStyle.Success)
  );

  try {
    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: '✅ 認証ボタンを作りました。', flags: MessageFlags.Ephemeral });
  } catch (err) {
    console.error(err);
    await interaction.reply({ content: '❌ 送れませんでした。Botがこのチャンネルに書き込めるか確認してください。', flags: MessageFlags.Ephemeral });
  }
}
