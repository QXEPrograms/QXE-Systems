const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rules')
    .setDescription('Post the server rules with an Accept button'),

  async execute(interaction) {
    // Only Admins can post rules
    if (!interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
      return interaction.reply({ content: 'Only Admins can post the rules.', flags: 64 });
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('RTrades Community — Rules & Guidelines')
      .setDescription('Welcome to RTrades. This is a **paid, members-only** trading community. To keep this a high-quality environment for everyone, all members are expected to follow the rules below.\n\nBy clicking Accept, you agree to these rules.')
      .addFields(
        { name: '1. Respect Everyone', value: 'Treat all members with respect. No harassment, insults, hate speech, or personal attacks. Disagreements about trades or markets are fine — disrespect is not.' },
        { name: '2. No Spam', value: 'No spam, repeated messages, excessive emojis, or unnecessary @mentions. Keep conversations clean and on-topic.' },
        { name: '3. No Unauthorized Promotion', value: 'Do not advertise other servers, services, bots, or social media without explicit permission from staff. This includes DM advertising members.' },
        { name: '4. Trading Content Only in Trading Channels', value: 'Keep trade ideas, signals, and market discussion in the appropriate channels. Off-topic content belongs in general chat.' },
        { name: '5. No Financial Advice', value: 'Nothing shared in this server is financial advice. You are responsible for your own trades and decisions. Do not hold other members liable for your losses.' },
        { name: '6. No Sharing of Paid Content', value: 'This is a paid community. Do not share signals, strategies, or any content from this server with non-members. Violations will result in a permanent ban.' },
        { name: '7. No Chargebacks or Refund Abuse', value: 'Attempting a chargeback or payment dispute will result in an immediate permanent ban from the community.' },
        { name: '8. Follow Discord ToS', value: 'Abide by Discord\'s Terms of Service at all times. discord.com/terms' },
        { name: '9. Listen to Staff', value: 'Follow all instructions from moderators and admins. If you disagree with a decision, reach out privately — do not argue publicly.' },
        { name: '10. No Trolling or Disruption', value: 'Deliberately stirring up drama, derailing conversations, or causing disruption will result in a timeout or ban.' },
        { name: '11. No Threatening or Violent Language', value: 'Any threats directed at members or staff will result in an immediate permanent ban and may be reported to Discord.' },
        { name: '12. Punishment Scale', value: '**1st offense** — Warning\n**2nd offense** — Timeout\n**3rd offense** — Kick\n**Severe violations** — Immediate permanent ban\n\nStaff reserve the right to skip steps for serious violations.' },
      )
      .setFooter({ text: 'Click the button below to accept the rules and gain full access.' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('accept_rules')
        .setLabel('Accept Rules')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅'),
    );

    const rulesChannel = interaction.guild.channels.cache.get(process.env.RULES_CHANNEL_ID);
    if (rulesChannel) {
      await rulesChannel.send({ embeds: [embed], components: [row] });
      return interaction.reply({ content: `Rules posted in ${rulesChannel}.`, flags: 64 });
    }

    await interaction.reply({ embeds: [embed], components: [row] });
  },
};
