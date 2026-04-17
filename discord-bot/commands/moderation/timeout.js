const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const DURATIONS = {
  '60s': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '10m': 10 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '1w': 7 * 24 * 60 * 60 * 1000,
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a member')
    .addUserOption(opt =>
      opt.setName('user').setDescription('User to timeout').setRequired(true))
    .addStringOption(opt =>
      opt.setName('duration')
        .setDescription('Duration of timeout')
        .setRequired(true)
        .addChoices(
          { name: '60 seconds', value: '60s' },
          { name: '5 minutes', value: '5m' },
          { name: '10 minutes', value: '10m' },
          { name: '30 minutes', value: '30m' },
          { name: '1 hour', value: '1h' },
          { name: '6 hours', value: '6h' },
          { name: '12 hours', value: '12h' },
          { name: '1 day', value: '1d' },
          { name: '1 week', value: '1w' },
        ))
    .addStringOption(opt =>
      opt.setName('reason').setDescription('Reason for timeout').setRequired(false)),

  async execute(interaction) {
    const target = interaction.options.getMember('user');
    const durationKey = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') ?? 'No reason provided';
    const durationMs = DURATIONS[durationKey];

    if (!target) return interaction.reply({ content: 'User not found.', flags: 64 });
    if (!target.moderatable) return interaction.reply({ content: 'I cannot timeout this user.', flags: 64 });

    await target.timeout(durationMs, reason);

    const embed = new EmbedBuilder()
      .setColor(0xffa500)
      .setTitle('Member Timed Out')
      .addFields(
        { name: 'User', value: `${target.user.tag}`, inline: true },
        { name: 'Duration', value: durationKey, inline: true },
        { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
        { name: 'Reason', value: reason },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
