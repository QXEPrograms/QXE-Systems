const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const yahooFinance = require('yahoo-finance2').default;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tradeview')
    .setDescription('Get real-time stock information')
    .addStringOption(opt =>
      opt.setName('symbol').setDescription('Stock ticker symbol (e.g. AAPL, TSLA, MSFT)').setRequired(true)),

  async execute(interaction) {
    const symbol = interaction.options.getString('symbol').toUpperCase();

    await interaction.deferReply();

    try {
      const quote = await yahooFinance.quote(symbol);

      if (!quote) {
        return interaction.editReply({ content: `Could not find stock data for **${symbol}**.` });
      }

      const price = quote.regularMarketPrice?.toFixed(2) ?? 'N/A';
      const change = quote.regularMarketChange?.toFixed(2) ?? 'N/A';
      const changePct = quote.regularMarketChangePercent?.toFixed(2) ?? 'N/A';
      const open = quote.regularMarketOpen?.toFixed(2) ?? 'N/A';
      const high = quote.regularMarketDayHigh?.toFixed(2) ?? 'N/A';
      const low = quote.regularMarketDayLow?.toFixed(2) ?? 'N/A';
      const volume = quote.regularMarketVolume?.toLocaleString() ?? 'N/A';
      const marketCap = quote.marketCap
        ? `$${(quote.marketCap / 1e9).toFixed(2)}B`
        : 'N/A';
      const week52High = quote.fiftyTwoWeekHigh?.toFixed(2) ?? 'N/A';
      const week52Low = quote.fiftyTwoWeekLow?.toFixed(2) ?? 'N/A';
      const name = quote.longName ?? quote.shortName ?? symbol;

      const isPositive = parseFloat(change) >= 0;
      const arrow = isPositive ? '▲' : '▼';
      const color = isPositive ? 0x57f287 : 0xed4245;

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`${name} (${symbol})`)
        .setDescription(`**$${price}** ${arrow} ${change} (${changePct}%)`)
        .addFields(
          { name: 'Open', value: `$${open}`, inline: true },
          { name: "Day's High", value: `$${high}`, inline: true },
          { name: "Day's Low", value: `$${low}`, inline: true },
          { name: 'Volume', value: volume, inline: true },
          { name: 'Market Cap', value: marketCap, inline: true },
          { name: '52W High', value: `$${week52High}`, inline: true },
          { name: '52W Low', value: `$${week52Low}`, inline: true },
        )
        .setFooter({ text: 'Data provided by Yahoo Finance • Prices may be delayed 15 min' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      await interaction.editReply({ content: `Could not find data for **${symbol}**. Make sure it's a valid ticker symbol.` });
    }
  },
};
