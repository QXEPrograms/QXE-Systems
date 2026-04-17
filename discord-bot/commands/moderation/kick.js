const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .addUserOption(opt =>
      opt.setName('user').setDescription('User to kick').setRequired(true))
    .addStringOption(opt =>
      opt.setName('reason').setDescription('Reason for kick').setRequired(false)),

  async execute(interaction) {
    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') ?? 'No reason provided';

    if (!target) return interaction.reply({ content: 'User not found.', flags: 64 });
    if (!target.kickable) return interaction.reply({ content: 'I cannot kick this user.', flags: 64 });

    await target.kick(reason);

    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle('Member Kicked')
      .addFields(
        { name: 'User', value: `${target.user.tag}`, inline: true },
        { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
        { name: 'Reason', value: reason },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
