import { Events, MessageFlags, PermissionFlagsBits as P } from 'discord.js';

const DANGEROUS = [
  P.Administrator, P.ManageGuild, P.ManageRoles, P.ManageChannels,
  P.ManageMessages, P.ManageWebhooks, P.ManageNicknames, P.KickMembers,
  P.BanMembers, P.ModerateMembers, P.MentionEveryone, P.ManageThreads,
];

// 配れないロールなら理由を返す。配れるなら null
export function roleProblem(role) {
  if (role.id === role.guild.id || role.managed) {
    return 'このロールは使えません（@everyone・Bot用のロール）。';
  }
  if (role.permissions.any(DANGEROUS)) {
    return '管理系の権限を持つロールは、ボタンやBotから配れません。';
  }
  if (!role.editable) {
    return 'Botのロールより上にあるため付けられません。サーバー設定 → ロールで、Botのロールをこのロールより上に動かしてください。';
  }
  return null;
}

export function register(client) {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;
    const [kind, roleId, minDays] = interaction.customId.split(':');
    if (kind !== 'role' && kind !== 'verify') return;

    const reply = (content) =>
      interaction.reply({ content, flags: MessageFlags.Ephemeral });

    const role = interaction.guild?.roles.cache.get(roleId);
    if (!role) return reply('⚠️ このロールは見つかりません。');

    const problem = roleProblem(role);
    if (problem) return reply(`⚠️ ${problem}`);

    const member = interaction.member;
    try {
      if (kind === 'verify') {
        if (member.roles.cache.has(roleId)) return reply('✅ すでに認証済みです。');
        const days = Number(minDays) || 0;
        if (days > 0) {
          const age = (Date.now() - interaction.user.createdTimestamp) / 86400000;
          if (age < days) {
            return reply(`❌ Discordアカウントを作ってから${days}日以上たっていないため、認証できません。`);
          }
        }
        await member.roles.add(role);
        return reply(`✅ 認証しました。**${role.name}** を付けました。`);
      }
      if (member.roles.cache.has(roleId)) {
        await member.roles.remove(role);
        return reply(`➖ **${role.name}** を外しました。`);
      }
      await member.roles.add(role);
      return reply(`➕ **${role.name}** を付けました。`);
    } catch (err) {
      console.error(err);
      return reply('❌ ロールを変更できませんでした。');
    }
  });
}
