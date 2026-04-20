const https = require('https');
const http  = require('http');

// Embed colour palette
const COLOR = {
    LONG:    0x00E676,   // Bright green
    SHORT:   0xFF1744,   // Bright red
    NEUTRAL: 0x7289DA,   // Discord blurple
    GOLD:    0xFFD700,   // High-quality signal accent
};

// Per-setup emoji
const SETUP_EMOJI = {
    THREE_STEP_MODEL: '🎯',
    AGGRESSIVE_LEDGE: '⚡',
    LVN_TOUCH:        '📍',
};

// Render ★ quality stars (max 5)
function qualityStars(q) {
    const filled = Math.round((q / 10) * 5);
    return '★'.repeat(filled) + '☆'.repeat(5 - filled);
}

// Format a price with commas and 2 decimal places
function fmt(n) {
    if (n == null) return 'N/A';
    return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * buildEmbed
 * Constructs a rich Discord embed object from an enriched signal.
 */
function buildEmbed(signal) {
    const isLong  = signal.direction === 'LONG';
    const color   = signal.isHighQuality ? COLOR.GOLD : (isLong ? COLOR.LONG : COLOR.SHORT);
    const emoji   = SETUP_EMOJI[signal.setup] || '📊';
    const dirTag  = isLong ? '🟢 LONG' : '🔴 SHORT';
    const biasTag = signal.bias === 'BULLISH' ? '📈 Bullish' :
                    signal.bias === 'BEARISH' ? '📉 Bearish' : '—';

    // ── Description block ──────────────────────────────────────────────────
    let description = '';

    if (signal.setup === 'THREE_STEP_MODEL') {
        description =
            '**3-Step Model — All conditions confirmed:**\n' +
            '> ✅ **Single Print** context active\n' +
            `> ✅ **ISMT / SMT**: ${signal.ismt || 'Detected'}\n` +
            `> ✅ **LVN Level**: $${fmt(signal.lvnLevel)}\n\n` +
            `Bias is **${signal.bias}** via 30-min TPO — ` +
            (isLong
                ? 'seek longs at the LVN, target the single print above.'
                : 'seek shorts at the LVN, target the single print below.');
    } else if (signal.setup === 'AGGRESSIVE_LEDGE') {
        description =
            '**Aggressive Ledge Trade — NY Open window (9:30 AM ET)**\n' +
            `> Price is **respecting** the LVN at $${fmt(signal.lvnLevel)}\n` +
            `> 30-min TPO bias: **${signal.bias}**\n\n` +
            '_These setups offer the best risk/reward at the NY open — act quickly._';
    } else if (signal.setup === 'LVN_TOUCH') {
        description =
            '**LVN Touch Detected**\n' +
            `> Price approaching LVN at $${fmt(signal.lvnLevel)}\n` +
            `> Current bias: **${signal.bias || 'Unconfirmed'}**\n\n` +
            '_Monitor for 3-step confirmation before entering._';
    }

    // ── Fields ───────────────────────────────────────────────────────────────
    const fields = [
        { name: '📌 Direction',    value: dirTag,                     inline: true },
        { name: '🧭 Bias (TPO)',   value: biasTag,                    inline: true },
        { name: `${emoji} Setup`,  value: signal.setupLabel,          inline: true },
        { name: '💵 Price',        value: `$${fmt(signal.price)}`,    inline: true },
    ];

    if (signal.lvnLevel != null) {
        fields.push({ name: '📍 LVN Level', value: `$${fmt(signal.lvnLevel)}`, inline: true });
    }

    if (signal.spTarget != null) {
        fields.push({ name: '🎯 SP Target', value: `$${fmt(signal.spTarget)}`, inline: true });
    }

    if (signal.setup === 'THREE_STEP_MODEL' && signal.ismt) {
        fields.push({ name: '🔄 ISMT / SMT', value: signal.ismt, inline: true });
    }

    if (signal.tpoAcceptance != null) {
        const pct  = (signal.tpoAcceptance * 100).toFixed(0);
        const half = signal.tpoAcceptance >= 0.5 ? 'Upper half (Bullish)' : 'Lower half (Bearish)';
        fields.push({ name: '📊 TPO Acceptance', value: `${pct}% — ${half}`, inline: true });
    }

    fields.push({ name: '🕐 Session',        value: signal.sessionLabel,                  inline: true });
    fields.push({ name: '✨ Signal Quality', value: `${qualityStars(signal.quality)} ${signal.quality}/10`, inline: true });

    // ── Assemble embed ────────────────────────────────────────────────────────
    return {
        title: `${emoji} ${signal.symbol} — ${signal.setupLabel}`,
        description,
        color,
        fields,
        footer: {
            text: `QXE Trading System  •  LVN / Volume Profile Strategy  •  ${signal.time}`,
        },
        timestamp: new Date().toISOString(),
    };
}

/**
 * postToWebhook
 * Low-level HTTP/HTTPS POST to a Discord webhook URL.
 */
function postToWebhook(webhookUrl, body) {
    return new Promise((resolve, reject) => {
        const payload   = JSON.stringify(body);
        const parsed    = new URL(webhookUrl);
        const isHttps   = parsed.protocol === 'https:';
        const lib       = isHttps ? https : http;

        const options = {
            hostname: parsed.hostname,
            port:     parsed.port || (isHttps ? 443 : 80),
            path:     parsed.pathname + parsed.search,
            method:   'POST',
            headers: {
                'Content-Type':   'application/json',
                'Content-Length': Buffer.byteLength(payload),
            },
        };

        const req = lib.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve();
                } else {
                    reject(new Error(`Discord responded ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

/**
 * sendSignalToDiscord
 * Formats the signal and sends it to the configured Discord webhook channel.
 */
async function sendSignalToDiscord(signal) {
    const webhookUrl = process.env.DISCORD_TRADE_WEBHOOK_URL;
    if (!webhookUrl) {
        console.error('[Discord] DISCORD_TRADE_WEBHOOK_URL is not set — signal not sent');
        return;
    }

    const embed   = buildEmbed(signal);
    // Ping @here for high-quality setups so members don't miss them
    const content = signal.isHighQuality ? '@here 🚨 **HIGH QUALITY SIGNAL**' : '';

    await postToWebhook(webhookUrl, {
        content,
        embeds: [embed],
        username:   'QXE Trading Bot',
    });
}

/**
 * sendStatusToDiscord
 * Posts a plain status/info message (startup, errors, etc.).
 */
async function sendStatusToDiscord(message) {
    const webhookUrl = process.env.DISCORD_TRADE_WEBHOOK_URL;
    if (!webhookUrl) return;

    await postToWebhook(webhookUrl, {
        embeds: [{
            title:       '🤖 QXE Trading Bot',
            description: message,
            color:       COLOR.NEUTRAL,
            timestamp:   new Date().toISOString(),
        }],
        username: 'QXE Trading Bot',
    });
}

module.exports = { sendSignalToDiscord, sendStatusToDiscord, buildEmbed };
