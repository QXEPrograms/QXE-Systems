const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const YahooFinance = require('yahoo-finance2').default;
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// ── Constants ────────────────────────────────────────────────────────────────
const POINT_VALUE    = 20;   // $ per NQ point
const STOP_PTS       = 20;
const T1_PTS         = 40;
const T2_PTS         = 80;
const LVN_STEP       = 10;   // price bucket size for volume profile
const LVN_THRESH     = 0.45; // LVN if vol < 45% of session avg
const LVN_TOUCH      = 15;   // points proximity to count as "touching" LVN
const SP_TOL         = 20;   // points proximity to a single print
const CONSOL_BARS    = 5;    // bars lingering at level = consolidated through

// ── Data fetch ───────────────────────────────────────────────────────────────
async function fetchNQ(days) {
  const end   = new Date();
  const start = new Date(end.getTime() - (days + 14) * 24 * 60 * 60 * 1000);
  const result = await yf.chart('NQ=F', {
    period1: start,
    period2: end,
    interval: '5m',
  });

  const quotes = result?.quotes ?? [];
  return quotes
    .filter(q => q.close != null)
    .map(q => ({
      ts:     new Date(q.date),
      open:   q.open,
      high:   q.high,
      low:    q.low,
      close:  q.close,
      volume: q.volume ?? 0,
    }));
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function etHour(date) {
  return new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
}

function timeStr(date) {
  const et = etHour(date);
  return `${String(et.getHours()).padStart(2,'0')}:${String(et.getMinutes()).padStart(2,'0')}`;
}

function dateStr(date) {
  const et = etHour(date);
  return et.toISOString().slice(0, 10);
}

function etMinutes(date) {
  const et = etHour(date);
  return et.getHours() * 60 + et.getMinutes();
}

// ── Session Volume Profile & LVN detection ───────────────────────────────────
function buildSVP(bars) {
  const svp = {};
  for (const b of bars) {
    const lo  = Math.round(b.low  / LVN_STEP) * LVN_STEP;
    const hi  = Math.round(b.high / LVN_STEP) * LVN_STEP;
    const vol = b.volume;
    let levels = 0;
    for (let p = lo; p <= hi; p += LVN_STEP) levels++;
    if (levels === 0) continue;
    const volEach = vol / levels;
    for (let p = lo; p <= hi; p += LVN_STEP) {
      svp[p] = (svp[p] ?? 0) + volEach;
    }
  }
  return svp;
}

function findLVNs(svp, bars) {
  const prices  = Object.keys(svp).map(Number).sort((a, b) => a - b);
  if (!prices.length) return [];
  const volumes = prices.map(p => svp[p]);
  const avg     = volumes.reduce((s, v) => s + v, 0) / volumes.length;
  const pocIdx  = volumes.indexOf(Math.max(...volumes));
  const poc     = prices[pocIdx];

  const candidates = prices.filter((p, i) =>
    volumes[i] < avg * LVN_THRESH && Math.abs(p - poc) > LVN_STEP * 2
  );

  // Remove levels price has consolidated through
  return candidates.filter(lvn => {
    const barsAtLevel = bars.filter(b => b.low <= lvn + LVN_TOUCH && b.high >= lvn - LVN_TOUCH);
    return barsAtLevel.length < CONSOL_BARS;
  });
}

function nearestLVN(price, lvns) {
  let best = null, bestDist = Infinity;
  for (const lvn of lvns) {
    const d = Math.abs(price - lvn);
    if (d <= LVN_TOUCH && d < bestDist) { best = lvn; bestDist = d; }
  }
  return best;
}

// ── TPO / Single Prints ───────────────────────────────────────────────────────
function buildTPO(bars, periodMin = 30) {
  const tpo = {};
  for (const b of bars) {
    const et     = etHour(b.ts);
    const mins   = et.getHours() * 60 + et.getMinutes();
    const bucket = Math.floor(mins / periodMin) * periodMin;
    const key    = `${dateStr(b.ts)}_${bucket}`;
    if (!tpo[key]) tpo[key] = { lo: b.low, hi: b.high };
    else { tpo[key].lo = Math.min(tpo[key].lo, b.low); tpo[key].hi = Math.max(tpo[key].hi, b.high); }
  }
  return tpo;
}

function findSinglePrints(tpo) {
  const priceCount = {};
  for (const { lo, hi } of Object.values(tpo)) {
    const loB = Math.round(lo / LVN_STEP) * LVN_STEP;
    const hiB = Math.round(hi / LVN_STEP) * LVN_STEP;
    for (let p = loB; p <= hiB; p += LVN_STEP) {
      priceCount[p] = (priceCount[p] ?? 0) + 1;
    }
  }
  return Object.entries(priceCount)
    .filter(([, cnt]) => cnt === 1)
    .map(([p]) => Number(p))
    .sort((a, b) => a - b);
}

function nextSPTarget(entry, direction, sps) {
  if (direction === 'long') {
    const cands = sps.filter(p => p > entry + T1_PTS);
    return cands.length ? Math.min(...cands) : null;
  } else {
    const cands = sps.filter(p => p < entry - T1_PTS);
    return cands.length ? Math.max(...cands) : null;
  }
}

// ── Bias ─────────────────────────────────────────────────────────────────────
function computeBias(tpo, bars) {
  const periods = Object.values(tpo);
  if (!periods.length) return 'neutral';
  const dayLo  = Math.min(...periods.map(p => p.lo));
  const dayHi  = Math.max(...periods.map(p => p.hi));
  const mid    = (dayLo + dayHi) / 2;
  const upper  = periods.filter(p => (p.lo + p.hi) / 2 > mid).length;
  const lower  = periods.filter(p => (p.lo + p.hi) / 2 <= mid).length;
  const lastClose = bars.length ? bars[bars.length - 1].close : mid;
  if (upper > lower && lastClose > mid) return 'bullish';
  if (lower > upper && lastClose < mid) return 'bearish';
  if (upper > lower) return 'bullish';
  if (lower > upper) return 'bearish';
  return 'neutral';
}

// ── ISMT detection ────────────────────────────────────────────────────────────
function detectISMT(b1, b2, direction) {
  if (direction === 'long')
    return b2.low < b1.low && b2.close > b1.low;
  else
    return b2.high > b1.high && b2.close < b1.high;
}

// ── Trade simulation ──────────────────────────────────────────────────────────
function simulateTrade(barsAfter, direction, entry, sps) {
  const spTarget = nextSPTarget(entry, direction, sps);
  const t2Price  = spTarget ?? (direction === 'long' ? entry + T2_PTS : entry - T2_PTS);
  let   stop     = direction === 'long' ? entry - STOP_PTS : entry + STOP_PTS;
  const t1Price  = direction === 'long' ? entry + T1_PTS   : entry - T1_PTS;

  let t1Hit = false, pnl = 0, exitReason = 'timeout', exitPrice = entry, barsHeld = 0;

  for (const b of barsAfter) {
    barsHeld++;
    if (direction === 'long') {
      if (b.low <= stop) {
        exitPrice  = stop;
        exitReason = t1Hit ? 'breakeven stop' : 'full stop';
        pnl        = t1Hit ? 0 : -STOP_PTS * POINT_VALUE;
        break;
      }
      if (!t1Hit && b.high >= t1Price) { t1Hit = true; stop = entry; }
      if (t1Hit && b.high >= t2Price) {
        exitPrice  = t2Price;
        exitReason = spTarget ? 'T2 hit (SP)' : 'T2 hit';
        pnl        = (t2Price - entry) * POINT_VALUE;
        break;
      }
    } else {
      if (b.high >= stop) {
        exitPrice  = stop;
        exitReason = t1Hit ? 'breakeven stop' : 'full stop';
        pnl        = t1Hit ? 0 : -STOP_PTS * POINT_VALUE;
        break;
      }
      if (!t1Hit && b.low <= t1Price) { t1Hit = true; stop = entry; }
      if (t1Hit && b.low <= t2Price) {
        exitPrice  = t2Price;
        exitReason = spTarget ? 'T2 hit (SP)' : 'T2 hit';
        pnl        = (entry - t2Price) * POINT_VALUE;
        break;
      }
    }
  }

  if (exitReason === 'timeout' && barsAfter.length) {
    exitPrice = barsAfter[barsAfter.length - 1].close;
    const pts = direction === 'long' ? exitPrice - entry : entry - exitPrice;
    pnl = pts * POINT_VALUE;
  }

  return { entry, exit: exitPrice, t1Hit, spTarget, pnl: Math.round(pnl), exitReason, barsHeld };
}

// ── Main backtest ─────────────────────────────────────────────────────────────
async function runBacktest(days) {
  const allBars = await fetchNQ(days);
  if (!allBars.length) throw new Error('Could not fetch NQ=F data.');

  // Group by ET date string
  const byDay = {};
  for (const b of allBars) {
    const d = dateStr(b.ts);
    (byDay[d] ??= []).push(b);
  }

  const sortedDays = Object.keys(byDay).sort().slice(-days);

  const trades    = [];
  const daily     = [];
  let   equity    = 0;
  const bySetup   = { aggressive: { trades: 0, pnl: 0, wins: 0 }, '3step': { trades: 0, pnl: 0, wins: 0 } };

  for (let di = 0; di < sortedDays.length; di++) {
    const day      = sortedDays[di];
    const dayBars  = byDay[day];
    const prevBars = di > 0 ? byDay[sortedDays[di - 1]] : [];

    let lvns = [], sps = [], bias = 'neutral';
    if (prevBars?.length) {
      const svp   = buildSVP(prevBars);
      lvns        = findLVNs(svp, prevBars);
      const tpo   = buildTPO(prevBars);
      const prevSP = findSinglePrints(tpo);

      const overnightBars = dayBars.filter(b => etMinutes(b.ts) < 9 * 60 + 30);
      const overnightTPO  = buildTPO(overnightBars);
      const overnightSP   = findSinglePrints(overnightTPO);
      sps  = [...new Set([...prevSP, ...overnightSP])].sort((a, b) => a - b);
      bias = computeBias(tpo, prevBars);
    }

    let dayPnl = 0, dayTradeCount = 0;
    const MAX_TRADES = 3;

    for (let i = 0; i < dayBars.length && dayTradeCount < MAX_TRADES; i++) {
      const b    = dayBars[i];
      const mins = etMinutes(b.ts);

      if (mins >= 15 * 60 + 45) break; // after 3:45 PM ET

      // Aggressive ledge trade: 9:25–9:55 AM ET, first trade of day
      if (mins >= 9 * 60 + 25 && mins <= 9 * 60 + 55 && dayTradeCount === 0 && bias !== 'neutral') {
        const lvn = nearestLVN(b.close, lvns);
        if (lvn !== null) {
          const direction  = bias === 'bullish' ? 'long' : 'short';
          const barsAfter  = dayBars.slice(i + 1);
          if (barsAfter.length) {
            const result = simulateTrade(barsAfter, direction, b.close, sps);
            trades.push({ date: day, time: timeStr(b.ts), setup: 'aggressive', direction, lvn, bias, ...result });
            bySetup.aggressive.trades++;
            bySetup.aggressive.pnl += result.pnl;
            if (result.pnl > 0) bySetup.aggressive.wins++;
            dayPnl += result.pnl; equity += result.pnl; dayTradeCount++;
            i += result.barsHeld;
            continue;
          }
        }
      }

      // 3-Step Model: 10:00 AM+ with ISMT + LVN + single print
      if (mins >= 10 * 60 && i >= 1 && bias !== 'neutral') {
        const b1  = dayBars[i - 1];
        const dir = bias === 'bullish' ? 'long' : 'short';
        if (detectISMT(b1, b, dir)) {
          const lvn = nearestLVN(b.close, lvns);
          const nearSP = sps.some(sp => Math.abs(b.close - sp) <= SP_TOL);
          if (lvn !== null && nearSP) {
            const barsAfter = dayBars.slice(i + 1);
            if (barsAfter.length) {
              const result = simulateTrade(barsAfter, dir, b.close, sps);
              trades.push({ date: day, time: timeStr(b.ts), setup: '3step', direction: dir, lvn, bias, ...result });
              bySetup['3step'].trades++;
              bySetup['3step'].pnl += result.pnl;
              if (result.pnl > 0) bySetup['3step'].wins++;
              dayPnl += result.pnl; equity += result.pnl; dayTradeCount++;
              i += result.barsHeld;
              continue;
            }
          }
        }
      }
    }

    daily.push({ date: day, trades: dayTradeCount, pnl: dayPnl, equity, bias });
  }

  // Stats
  const wins       = trades.filter(t => t.pnl > 0);
  const losses     = trades.filter(t => t.pnl < 0);
  const t2hits     = trades.filter(t => t.exitReason.startsWith('T2 hit'));
  const spT2       = trades.filter(t => t.exitReason === 'T2 hit (SP)');
  const breakevens = trades.filter(t => t.exitReason === 'breakeven stop');
  const fullStops  = trades.filter(t => t.exitReason === 'full stop');
  const timeouts   = trades.filter(t => t.exitReason === 'timeout');

  const winRate = trades.length ? (wins.length / trades.length * 100) : 0;
  const avgWin  = wins.length   ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length   : 0;
  const avgLoss = losses.length ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : 0;
  const rr      = avgLoss ? Math.abs(avgWin / avgLoss) : 0;
  const maxDD   = calcMaxDrawdown(daily.map(d => d.equity));

  return { days, trades, daily, bySetup, totalPnl: equity, winRate, wins: wins.length, losses: losses.length,
    t2hits: t2hits.length, spT2: spT2.length, breakevens: breakevens.length,
    fullStops: fullStops.length, timeouts: timeouts.length,
    avgWin, avgLoss, rr, maxDD };
}

function calcMaxDrawdown(curve) {
  if (!curve.length) return 0;
  let peak = curve[0], worst = 0;
  for (const v of curve) {
    if (v > peak) peak = v;
    const dd = peak ? (v - peak) / Math.abs(peak) * 100 : 0;
    if (dd < worst) worst = dd;
  }
  return worst;
}

// ── Discord command ───────────────────────────────────────────────────────────
function sign(v)  { return v >= 0 ? `+$${Math.abs(v).toLocaleString()}` : `-$${Math.abs(v).toLocaleString()}`; }
function pbar(pct, len = 14) {
  pct = Math.max(-100, Math.min(100, pct));
  const filled = Math.floor(len * Math.abs(pct) / 100);
  return `\`${'█'.repeat(filled)}${'░'.repeat(len - filled)}\` ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nq_backtest')
    .setDescription('Backtest the Wicked strategy on NQ (LVNs, Single Prints, 3-Step Model)')
    .addIntegerOption(opt =>
      opt.setName('days')
        .setDescription('Trading days to backtest (5–30, default 25)')
        .setMinValue(5)
        .setMaxValue(30)
        .setRequired(false)),

  async execute(interaction) {
    const days = interaction.options.getInteger('days') ?? 25;
    await interaction.deferReply();

    const loading = new EmbedBuilder()
      .setColor(0x00B4D8)
      .setTitle('⏳ Running NQ Wicked Strategy Backtest...')
      .setDescription(
        `**NQ Wicked Strategy** — Last **${days} trading days**\n\n` +
        `**Instrument:** NQ E-mini (/NQ)  |  **Contracts:** 1\n` +
        `**Stop:** 20 pts (-$400)  |  **T1:** 40 pts → move stop to BE\n` +
        `**T2:** Next single-print level OR 80 pts fixed\n\n` +
        `**Setups:**\n` +
        `• Aggressive Ledge Trade (9:25–9:55 AM ET)\n` +
        `• 3-Step Model: Single Print + ISMT + LVN (10:00 AM+)\n\n` +
        `**Bias:** 30-min TPO acceptance + overnight single prints\n\n` +
        `_Fetching 5-min NQ data and building session volume profiles..._`
      )
      .setFooter({ text: 'Velorum Management' });

    await interaction.editReply({ embeds: [loading] });

    let r;
    try {
      r = await runBacktest(days);
    } catch (err) {
      const errEmbed = new EmbedBuilder()
        .setColor(0xFF3366)
        .setTitle('❌ NQ Wicked Backtest Failed')
        .setDescription(err.message)
        .setFooter({ text: 'Velorum Management' });
      return interaction.editReply({ embeds: [errEmbed] });
    }

    const color      = r.totalPnl >= 0 ? 0x00FF88 : 0xFF3366;
    const totalPct   = r.daily.length ? (r.totalPnl / 10000 * 100) : 0;
    const biasEmoji  = { bullish: '🟢', bearish: '🔴', neutral: '🟡' };

    // ── Summary embed ─────────────────────────────────────────────────────────
    const e1 = new EmbedBuilder()
      .setColor(color)
      .setAuthor({ name: '🤖 Velorum Management — Wicked NQ Backtester' })
      .setTitle('📊 NQ Wicked Strategy Backtest')
      .setDescription(
        `**${r.days}-day backtest** | NQ E-mini | 1 contract | Max 3 trades/day\n` +
        `Stop: 20pts (-$400) | T1: 40pts → BE | T2: Single-Print level or 80pts`
      )
      .addFields(
        { name: '💰 Net P&L',      value: `**${sign(r.totalPnl)}**`,                                   inline: true },
        { name: '📈 Win Rate',     value: `**${r.winRate.toFixed(1)}%**  \`${r.wins}W / ${r.losses}L\``, inline: true },
        { name: '⚖️ Risk/Reward',  value: `\`${r.rr.toFixed(2)}:1\``,                                   inline: true },
        { name: '✅ Avg Win',      value: `\`${sign(Math.round(r.avgWin))}\``,                           inline: true },
        { name: '🔴 Avg Loss',     value: `\`${sign(Math.round(r.avgLoss))}\``,                          inline: true },
        { name: '📉 Max Drawdown', value: `\`${r.maxDD.toFixed(1)}%\``,                                  inline: true },
        {
          name: '🎯 Outcome Breakdown',
          value:
            `🏆 T2 hits (fixed):    \`${r.t2hits - r.spT2}\`  (+$1,600 each)\n` +
            `🎯 T2 hits (SP level): \`${r.spT2}\`  (single-print target)\n` +
            `⚖️  Breakeven stops:   \`${r.breakevens}\`  ($0)\n` +
            `🛑 Full stops:         \`${r.fullStops}\`  (-$400 each)\n` +
            `⏰ Timeout/other:      \`${r.timeouts}\`\n` +
            `📊 Total trades:       \`${r.trades.length}\``,
          inline: false,
        },
        {
          name: '🔍 By Setup',
          value: Object.entries(r.bySetup).map(([k, d]) => {
            if (!d.trades) return null;
            const wr = (d.wins / d.trades * 100).toFixed(0);
            const label = k === 'aggressive' ? 'Aggressive Ledge (9:25–9:55 AM)' : '3-Step Model (SP + ISMT + LVN)';
            return `**${label}**\n  ${d.trades} trades | ${wr}% WR | ${sign(d.pnl)}`;
          }).filter(Boolean).join('\n') || 'No setups triggered',
          inline: false,
        },
        {
          name: '📅 Daily P&L',
          value: r.daily.slice(-15).map(d => {
            const arrow = d.pnl > 0 ? '▲' : d.pnl < 0 ? '▼' : '─';
            const be    = biasEmoji[d.bias] ?? '⚪';
            return `\`${d.date}\` ${be} ${arrow} \`${d.pnl >= 0 ? '+' : ''}${sign(d.pnl)}\`  cum: \`${sign(d.equity)}\`  trades: \`${d.trades}\``;
          }).join('\n') || 'No data',
          inline: false,
        },
      )
      .setFooter({ text: 'Velorum Management' })
      .setTimestamp();

    // ── Trade log embed ───────────────────────────────────────────────────────
    const recentTrades = r.trades.slice(-10);
    const e2 = new EmbedBuilder()
      .setColor(color)
      .setAuthor({ name: '🤖 Velorum Management — Wicked NQ Backtester' })
      .setTitle(`📋 Wicked NQ Trade Log — ${r.trades.length} Trades`)
      .setFooter({ text: 'Velorum Management' })
      .setTimestamp();

    if (recentTrades.length) {
      const setupEmoji = { aggressive: '⚡', '3step': '🔱' };
      const dirEmoji   = { long: '⬆️', short: '⬇️' };
      for (const t of recentTrades) {
        const icon     = t.pnl > 0 ? '🏆' : t.pnl === 0 || t.exitReason === 'breakeven stop' ? '⚖️' : '🛑';
        const t1Label  = t.t1Hit ? '✅ BE' : '❌ T1';
        const t2Label  = t.exitReason.startsWith('T2 hit') ? '✅ T2' : '❌ T2';
        const spNote   = t.spTarget ? ` → SP \`${t.spTarget.toFixed(0)}\`` : '';
        e2.addFields({
          name:  `${icon} ${t.date} ${t.time}  ${setupEmoji[t.setup] ?? '⚪'} ${t.setup.toUpperCase()}  ${dirEmoji[t.direction] ?? ''} ${t.direction.toUpperCase()}`,
          value: `Entry \`${t.entry.toFixed(0)}\` → Exit \`${t.exit.toFixed(0)}\`${spNote}  LVN: \`${t.lvn.toFixed(0)}\`\n${t1Label} | ${t2Label} | Bias: \`${t.bias}\`\nP&L: **${sign(t.pnl)}** | _${t.exitReason}_`,
          inline: false,
        });
      }
    } else {
      e2.setDescription('No trades were executed in this period.');
    }

    await interaction.editReply({ embeds: [e1] });
    await interaction.followUp({ embeds: [e2] });
  },
};
