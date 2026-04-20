// Signal processor — validates incoming TradingView alerts against the
// LVN / Volume Profile / Single Print strategy rules before relaying to Discord.

// Quality scores for each setup type (out of 10)
const SETUP_QUALITY = {
    THREE_STEP_MODEL: 10,   // Single Print + ISMT/SMT + LVN — highest confidence
    AGGRESSIVE_LEDGE: 8,    // NY Open (9:30 AM) LVN respect — high confidence
    LVN_TOUCH: 6,           // Price touching LVN — monitor for confirmation
};

// Map raw Pine Script setup strings to canonical names
const SETUP_MAP = {
    '3_STEP_MODEL':      'THREE_STEP_MODEL',
    'THREE_STEP_MODEL':  'THREE_STEP_MODEL',
    'AGGRESSIVE_LEDGE':  'AGGRESSIVE_LEDGE',
    'LVN_TOUCH':         'LVN_TOUCH',
    'LVN':               'LVN_TOUCH',
};

const VALID_DIRECTIONS = new Set(['LONG', 'SHORT', 'LONG_SETUP', 'SHORT_SETUP']);

// Human-readable labels sent in the Discord embed
const SETUP_LABELS = {
    THREE_STEP_MODEL: '3-Step Model',
    AGGRESSIVE_LEDGE: 'Aggressive Ledge Trade',
    LVN_TOUCH:        'LVN Touch',
};

// Session labels
const SESSION_LABELS = {
    NY_OPEN:    '⚡ NY Open  (9:30 AM ET)',
    NY_SESSION: '🗽 NY Session',
    OVERNIGHT:  '🌙 Overnight',
    ACTIVE:     '📊 Active Session',
};

/**
 * processSignal
 *
 * Receives a raw TradingView webhook payload and applies strategy filters:
 *  1. Required fields present
 *  2. Valid signal direction
 *  3. Setup type recognised
 *  4. For 3-step and aggressive setups, bias must match signal direction
 *  5. LVN level must be present for entries (not required for LVN_TOUCH context)
 *
 * Returns an enriched signal object, or null if the signal should be filtered.
 */
function processSignal(payload) {
    if (!payload || typeof payload !== 'object') return null;

    const {
        symbol,
        signal,
        setup,
        price,
        lvn_level,
        bias,
        ismt,
        time,
        session,
        sp_target,
        tpo_acceptance,
    } = payload;

    // ── 1. Required fields ────────────────────────────────────────────────────
    if (!symbol || !signal || !setup) {
        console.warn('[Processor] Missing required fields (symbol/signal/setup)');
        return null;
    }

    // ── 2. Direction ──────────────────────────────────────────────────────────
    const direction = String(signal).toUpperCase().trim();
    if (!VALID_DIRECTIONS.has(direction)) {
        console.warn(`[Processor] Unknown direction: ${direction}`);
        return null;
    }
    // Normalise _SETUP suffix
    const normalDir = direction.replace('_SETUP', '');

    // ── 3. Setup type ─────────────────────────────────────────────────────────
    const setupKey = SETUP_MAP[String(setup).toUpperCase().trim()];
    if (!setupKey) {
        console.warn(`[Processor] Unknown setup type: ${setup}`);
        return null;
    }

    // ── 4. Bias alignment (required for actionable setups) ───────────────────
    const normalBias = String(bias || '').toUpperCase().trim();
    const biasIsSet  = normalBias === 'BULLISH' || normalBias === 'BEARISH';

    if (setupKey !== 'LVN_TOUCH' && biasIsSet) {
        const expectBull = normalDir === 'LONG';
        const biasBull   = normalBias === 'BULLISH';
        if (expectBull !== biasBull) {
            console.log(
                `[Processor] Filtered — ${setupKey} ${normalDir} conflicts with ${normalBias} bias`
            );
            return null;
        }
    }

    // ── 5. Parse numerics ────────────────────────────────────────────────────
    const numPrice    = parseFloat(price)      || null;
    const numLvn      = parseFloat(lvn_level)  || null;
    const numSpTarget = parseFloat(sp_target)  || null;
    const numTpoAcc   = parseFloat(tpo_acceptance);

    // ── 6. Session ────────────────────────────────────────────────────────────
    const sessionKey    = String(session || 'ACTIVE').toUpperCase().trim();
    const sessionLabel  = SESSION_LABELS[sessionKey] || SESSION_LABELS.ACTIVE;
    const isNYOpen      = sessionKey === 'NY_OPEN';
    const isNYSession   = sessionKey === 'NY_SESSION' || isNYOpen;

    // ── 7. Quality score (bonus for NY session and high TPO acceptance) ───────
    let quality = SETUP_QUALITY[setupKey] || 5;
    if (isNYSession) quality = Math.min(quality + 1, 10);
    if (!isNaN(numTpoAcc) && numTpoAcc > 0.65) quality = Math.min(quality + 1, 10);

    // ── 8. Build enriched signal ──────────────────────────────────────────────
    return {
        symbol:       symbol.toUpperCase(),
        direction:    normalDir,                    // 'LONG' | 'SHORT'
        setup:        setupKey,
        setupLabel:   SETUP_LABELS[setupKey],
        price:        numPrice,
        lvnLevel:     numLvn,
        spTarget:     numSpTarget,
        bias:         normalBias || null,
        ismt:         ismt ? String(ismt).toUpperCase() : null,
        tpoAcceptance: isNaN(numTpoAcc) ? null : numTpoAcc,
        time:         time || new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }),
        session:      sessionKey,
        sessionLabel,
        isNYOpen,
        isNYSession,
        quality,
        isHighQuality: quality >= 9,
    };
}

module.exports = { processSignal };
