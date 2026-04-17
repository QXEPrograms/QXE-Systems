const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Send an announcement embed')
    .addStringOption(opt =>
      opt.setName('title').setDescription('Announcement title').setRequired(true))
    .addStringOption(opt =>
      opt.setName('message').setDescription('Announcement message').setRequired(true))
    .addChannelOption(opt =>
      opt.setName('channel').setDescription('Channel to send to (defaults to current)').setRequired(false))
    .addStringOption(opt =>
      opt.setName('color')
        .setDescription('Embed color')
        .setRequired(false)
        .addChoices(
          { name: 'Blue', value: '0x5865f2' },
          { name: 'Green', value: '0x57f287' },
          { name: 'Red', value: '0xed4245' },
          { name: 'Yellow', value: '0xfee75c' },
          { name: 'Purple', value: '0x9b59b6' },
        )),

  async execute(interaction) {
    // Only Admins can post announcements
    if (!interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
      return interaction.reply({ content: 'Only Admins can post announcements.', flags: 64 });
    }

    const title = interaction.options.getString('title');
    const message = interaction.options.getString('message');
    const channel = interaction.options.getChannel('channel') ?? interaction.channel;
    const colorHex = interaction.options.getString('color') ?? '0x5865f2';

    const embed = new EmbedBuilder()
      .setColor(parseInt(colorHex))
      .setTitle(`📢 ${title}`)
      .setDescription(message)
      .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL({ dynamic: true }) })
      .setFooter({ text: `Posted by ${interaction.user.tag}` })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
    await interaction.reply({ content: `Announcement sent to ${channel}.`, flags: 64 });
  },
};
