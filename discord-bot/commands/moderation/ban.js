const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server')
    .addUserOption(opt =>
      opt.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption(opt =>
      opt.setName('reason').setDescription('Reason for ban').setRequired(false))
    .addIntegerOption(opt =>
      opt.setName('delete_days').setDescription('Days of messages to delete (0-7)').setMinValue(0).setMaxValue(7).setRequired(false)),

  async execute(interaction) {
    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') ?? 'No reason provided';
    const deleteDays = interaction.options.getInteger('delete_days') ?? 0;

    if (!target) return interaction.reply({ content: 'User not found.', flags: 64 });
    if (!target.bannable) return interaction.reply({ content: 'I cannot ban this user.', flags: 64 });

    await target.ban({ deleteMessageDays: deleteDays, reason });

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('Member Banned')
      .addFields(
        { name: 'User', value: `${target.user.tag}`, inline: true },
        { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
        { name: 'Reason', value: reason },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
