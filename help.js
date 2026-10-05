import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('このBotの使い方とコマンド一覧を表示します');

export async function execute(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('📖 Karisuke の使い方')
    .setColor(0x5865f2)
    .setDescription('チャンネルをつないで、メッセージを各チャンネルの言語に翻訳して届けるBotです。')
    .addFields(
      {
        name: '🌐 グローバルチャット',
        value: [
          '`/global-join` このチャンネルをつなぐ（言語を選ぶ）',
          '`/global-leave` つなぐのをやめる',
          '`/global-language` このチャンネルの言語を変える',
          '`/global-list` つながっているチャンネルの一覧',
          '`/global-pause` 転送を一時停止・再開',
        ].join('\n'),
      },
      {
        name: '🛠 管理',
        value: [
          '`/global-announce` 全チャンネルにお知らせを送る',
          '`/global-ban` 転送しないユーザーの管理',
          '`/global-slang` 決まった訳し方の登録',
          '`/global-stats` 翻訳の使用量（Botの持ち主のみ）',
        ].join('\n'),
      },
      {
        name: '🛡 モデレーション',
        value: [
          '`/mod purge` メッセージをまとめて削除',
          '`/mod timeout` `/mod untimeout` タイムアウト',
          '`/mod kick` `/mod ban` `/mod unban`',
          '`/modlog` ログの送り先を設定（削除・編集・参加退出・管理操作）',
        ].join('\n'),
      },
      {
        name: '✨ 便利機能',
        value: [
          '`/poll` アンケートを作る',
          '`/embed` 埋め込みメッセージを送る',
          '`/rolepanel` ボタンでロールを付け外しするパネル',
          '`/verify` 押すとロールが付く認証ボタン（アカウント作成日の条件も付けられる）',
          '`/webverify` ウェブで人間チェックをする認証',
          '`/welcome` ようこそメッセージの設定',
        ].join('\n'),
      }
    )
    .setFooter({ text: '管理系のコマンドは、必要な権限がある人だけが使えます。' });

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
