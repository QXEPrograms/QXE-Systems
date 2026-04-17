const { EmbedBuilder } = require('discord.js');

// Roles that are allowed to use bot commands
function hasPermission(member) {
  return (
    member.roles.cache.has(process.env.ADMIN_ROLE_ID) ||
    member.roles.cache.has(process.env.MOD_ROLE_ID)
  );
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    // Handle "Accept Rules" button
    if (interaction.isButton() && interaction.customId === 'accept_rules') {
      const verifiedRole = interaction.guild.roles.cache.get(process.env.VERIFIED_ROLE_ID);
      if (!verifiedRole) {
        return interaction.reply({ content: 'Verified role not configured. Contact an admin.', flags: 64 });
      }

      if (interaction.member.roles.cache.has(process.env.VERIFIED_ROLE_ID)) {
        return interaction.reply({ content: 'You already accepted the rules!', flags: 64 });
      }

      await interaction.member.roles.add(verifiedRole).catch(console.error);
      return interaction.reply({ content: 'You have been verified and now have access to all channels!', flags: 64 });
    }

    // Handle slash commands
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;

    // Permission check — all commands require Mod or Admin role
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'You do not have permission to use this command.', flags: 64 });
    }

    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(err);
      const msg = { content: 'An error occurred while running that command.', flags: 64 };
      if (interaction.replied || interaction.deferred) {
        interaction.followUp(msg);
      } else {
        interaction.reply(msg);
      }
    }
  },
};
