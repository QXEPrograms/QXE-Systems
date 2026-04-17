const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    // Assign welcome role
    const welcomeRole = member.guild.roles.cache.get(process.env.WELCOME_ROLE_ID);
    if (welcomeRole) {
      await member.roles.add(welcomeRole).catch(console.error);
    }

    // Send welcome message
    const channel = member.guild.channels.cache.get(process.env.WELCOME_CHANNEL_ID);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Welcome!')
      .setDescription(`Hey ${member}, welcome to **${member.guild.name}**!\nHead over to the rules channel and accept the rules to unlock all channels.`)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Member #${member.guild.memberCount}` })
      .setTimestamp();

    channel.send({ embeds: [embed] });
  },
};
