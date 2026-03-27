// ════════════════════════════════════════════════
//  ConnectBé — Flight Credit Tracker
//  Comptabilise les crédits FlightAPI consommés
//  Chaque appel API coûte 2 crédits (schedule)
// ════════════════════════════════════════════════

const db = require('./db');

async function addCredits(count = 2) {
  try {
    await db.query(
      `INSERT INTO theme_config (config_key, config_value) VALUES ('flight_credits_used', ?)
       ON DUPLICATE KEY UPDATE config_value = CAST(config_value AS UNSIGNED) + ?`,
      [String(count), count]
    );
  } catch (_) { /* non-bloquant */ }
}

async function getCreditsStats() {
  const [rows] = await db.query(
    `SELECT config_key, config_value FROM theme_config
     WHERE config_key IN ('flight_credits_used', 'flight_credits_limit')`
  );
  const cfg       = Object.fromEntries(rows.map(r => [r.config_key, r.config_value]));
  const used      = parseInt(cfg.flight_credits_used  || '0',     10);
  const limit     = parseInt(cfg.flight_credits_limit || '30', 10);
  return { used, limit, remaining: Math.max(0, limit - used) };
}

async function resetCredits() {
  await db.query(
    `INSERT INTO theme_config (config_key, config_value) VALUES ('flight_credits_used', '0')
     ON DUPLICATE KEY UPDATE config_value = '0'`
  );
}

module.exports = { addCredits, getCreditsStats, resetCredits };
