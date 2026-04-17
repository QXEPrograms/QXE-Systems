const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Set slowmode for a channel')
    .addIntegerOption(opt =>
      opt.setName('seconds').setDescription('Slowmode delay in seconds (0 to disable, max 21600)').setMinValue(0).setMaxValue(21600).setRequired(true))
    .addChannelOption(opt =>
      opt.setName('channel').setDescription('Channel to apply slowmode to (defaults to current)').setRequired(false)),

  async execute(interaction) {
    const seconds = interaction.options.getInteger('seconds');
    const channel = interaction.options.getChannel('channel') ?? interaction.channel;

    await channel.setRateLimitPerUser(seconds);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Slowmode Updated')
      .addFields(
        { name: 'Channel', value: `${channel}`, inline: true },
        { name: 'Delay', value: seconds === 0 ? 'Disabled' : `${seconds}s`, inline: true },
        { name: 'Set by', value: `${interaction.user.tag}`, inline: true },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
