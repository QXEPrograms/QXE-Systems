const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Delete a number of messages from a channel')
    .addIntegerOption(opt =>
      opt.setName('amount').setDescription('Number of messages to delete (1–100)').setMinValue(1).setMaxValue(100).setRequired(true))
    .addUserOption(opt =>
      opt.setName('user').setDescription('Only delete messages from this user').setRequired(false)),

  async execute(interaction) {
    const amount = interaction.options.getInteger('amount');
    const targetUser = interaction.options.getUser('user');

    await interaction.deferReply({ flags: 64 });

    let messages = await interaction.channel.messages.fetch({ limit: amount });

    if (targetUser) {
      messages = messages.filter(m => m.author.id === targetUser.id);
    }

    const deleted = await interaction.channel.bulkDelete(messages, true);

    await interaction.editReply({ content: `Deleted ${deleted.size} message(s).` });
  },
};
