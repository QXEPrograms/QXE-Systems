const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const warningsPath = path.join(__dirname, '../../data/warnings.json');

function loadWarnings() {
  if (!fs.existsSync(warningsPath)) {
    fs.writeFileSync(warningsPath, '{}');
    return {};
  }
  return JSON.parse(fs.readFileSync(warningsPath, 'utf8'));
}

function saveWarnings(data) {
  fs.writeFileSync(warningsPath, JSON.stringify(data, null, 2));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a member')
    .addUserOption(opt =>
      opt.setName('user').setDescription('User to warn').setRequired(true))
    .addStringOption(opt =>
      opt.setName('reason').setDescription('Reason for warning').setRequired(true)),

  async execute(interaction) {
    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason');

    if (!target) return interaction.reply({ content: 'User not found.', flags: 64 });

    const warnings = loadWarnings();
    const userId = target.user.id;

    if (!warnings[userId]) warnings[userId] = [];
    warnings[userId].push({
      reason,
      moderator: interaction.user.tag,
      timestamp: new Date().toISOString(),
    });
    saveWarnings(warnings);

    const count = warnings[userId].length;

    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle('Member Warned')
      .addFields(
        { name: 'User', value: `${target.user.tag}`, inline: true },
        { name: 'Total Warnings', value: `${count}`, inline: true },
        { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
        { name: 'Reason', value: reason },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    // DM the warned user
    target.user.send(`You have been warned in **${interaction.guild.name}**.\n**Reason:** ${reason}\n**Total warnings:** ${count}`).catch(() => {});
  },
};
