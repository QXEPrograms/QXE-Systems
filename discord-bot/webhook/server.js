const express = require('express');
const { processSignal } = require('./signalProcessor');
const { sendSignalToDiscord, sendStatusToDiscord } = require('./discordSender');

const app = express();
app.use(express.json());
app.use(express.text());

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'QXE TradingView Webhook',
        time: new Date().toISOString(),
    });
});

// TradingView webhook receiver
// TradingView POSTs to this endpoint when an alert fires
app.post('/webhook/tradingview', async (req, res) => {
    try {
        let payload = req.body;

        // TradingView sometimes sends plain text — try parsing it
        if (typeof payload === 'string') {
            try {
                payload = JSON.parse(payload);
            } catch {
                console.warn('Non-JSON payload received:', payload);
                return res.status(400).json({ error: 'Invalid JSON payload' });
            }
        }

        // Optional shared secret validation (set WEBHOOK_SECRET in env)
        const secret = process.env.WEBHOOK_SECRET;
        if (secret) {
            const incoming = req.headers['x-webhook-secret'] || req.query.secret;
            if (incoming !== secret) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
        }

        console.log(`[Webhook] Received signal: ${JSON.stringify(payload)}`);

        const signal = processSignal(payload);

        if (!signal) {
            console.log('[Webhook] Signal filtered out by strategy rules');
            return res.json({ status: 'filtered', message: 'Signal did not meet quality criteria' });
        }

        await sendSignalToDiscord(signal);
        console.log(`[Webhook] Signal sent to Discord: ${signal.symbol} ${signal.direction} ${signal.setup}`);

        res.json({ status: 'ok', signal: signal.setup, direction: signal.direction });
    } catch (err) {
        console.error('[Webhook] Error processing signal:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Manual test endpoint (protected — requires WEBHOOK_SECRET header)
app.post('/webhook/test', async (req, res) => {
    const secret = process.env.WEBHOOK_SECRET;
    if (secret && req.headers['x-webhook-secret'] !== secret) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const testPayload = {
        symbol: req.body.symbol || 'NQ1!',
        signal: req.body.signal || 'LONG',
        setup: req.body.setup || '3_STEP_MODEL',
        price: req.body.price || 21500.25,
        lvn_level: req.body.lvn_level || 21480.00,
        bias: req.body.bias || 'BULLISH',
        ismt: req.body.ismt || 'BULLISH',
        time: new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }),
        session: req.body.session || 'NY_SESSION',
        sp_target: req.body.sp_target || null,
        tpo_acceptance: req.body.tpo_acceptance || 0.72,
    };

    const signal = processSignal(testPayload);
    if (!signal) {
        return res.json({ status: 'filtered', payload: testPayload });
    }

    await sendSignalToDiscord(signal);
    res.json({ status: 'ok', signal });
});

function startWebhookServer() {
    const port = process.env.WEBHOOK_PORT || process.env.PORT || 3000;
    app.listen(port, () => {
        console.log(`[Webhook] TradingView webhook server listening on port ${port}`);
        console.log(`[Webhook] POST endpoint: /webhook/tradingview`);
    });
}

module.exports = { startWebhookServer };
