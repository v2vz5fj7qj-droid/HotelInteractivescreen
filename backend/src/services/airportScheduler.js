// ════════════════════════════════════════════════
//  ConnectBé — Scheduler de planification par aéroport
//  Exécute la planification saisie dans le back-office super-admin
//  (table airports : schedule_enabled / schedule_mode / interval_minutes / fixed_hours)
//
//  Jusqu'ici cette planification était enregistrée et affichée — cron_expression
//  comprise — mais aucun processus ne la lisait : airports.findScheduled() n'était
//  importé nulle part. Les écrans annonçaient « toutes les 2 min » alors que la seule
//  chose qui rafraîchissait vraiment était le bouton « Refresh » manuel, d'où un
//  « dernier refresh » figé au jour du dernier clic.
// ════════════════════════════════════════════════

const db = require('./db');
const { refreshFlights } = require('./flightRefresh');

const TICK_MS = 60_000;

// Même fenêtre que le scheduler global : un tick de 60 s dérive et ne rattrape jamais
// son retard, exiger la minute 0 pile ferait sauter des heures programmées en silence.
const FIXED_HOUR_WINDOW_MIN = 5;

let tickTimer   = null;
let tickRunning = false;

// Dernière tentative par aéroport, en mémoire. Sans elle, un aéroport dont l'API échoue
// en boucle serait retenté à chaque tick (toutes les 60 s) quel que soit son intervalle :
// last_fetched_at n'est estampillé qu'en cas de succès, à dessein.
const lastAttempt = new Map();

// Fuseau de référence des heures fixes. Lu directement en base : la planification
// vit dans la table airports, il n'y a plus de configuration vols globale.
async function getSchedulerTimezone() {
  try {
    const [rows] = await db.query(
      "SELECT config_value FROM theme_config WHERE config_key = 'flight_timezone'"
    );
    return rows[0]?.config_value || 'UTC';
  } catch {
    return 'UTC';
  }
}

function parseHours(raw) {
  if (Array.isArray(raw)) return raw.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 23);
  try { return parseHours(JSON.parse(raw || '[]')); } catch { return []; }
}

function hourInTZ(timezone) {
  try {
    const h = parseInt(new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, hour: 'numeric', hour12: false,
    }).formatToParts(new Date()).find(p => p.type === 'hour').value, 10);
    return h === 24 ? 0 : h;
  } catch {
    return new Date().getUTCHours();
  }
}

// L'échéance se calcule côté MySQL : last_fetched_at y est écrit par NOW(), comparer en
// JavaScript ferait dépendre le résultat du fuseau de la connexion.
async function findDueAirports() {
  const [rows] = await db.query(`
    SELECT code, schedule_mode, interval_minutes, fixed_hours
    FROM airports
    WHERE schedule_enabled = 1
      AND (
        (schedule_mode = 'interval' AND (
          last_fetched_at IS NULL
          OR last_fetched_at <= NOW() - INTERVAL GREATEST(1, COALESCE(interval_minutes, 30)) MINUTE))
        OR
        (schedule_mode = 'fixed_hours' AND (
          last_fetched_at IS NULL
          OR last_fetched_at < DATE_FORMAT(NOW(), '%Y-%m-%d %H:00:00')))
      )
    ORDER BY code
  `);
  return rows;
}

// Un aéroport en mode « heures fixes » n'est dû que dans la fenêtre de l'heure retenue
function keepIfScheduledNow(rows, timezone) {
  const now     = new Date();
  const current = hourInTZ(timezone);
  return rows.filter(a => {
    if (a.schedule_mode !== 'fixed_hours') return true;
    if (now.getMinutes() >= FIXED_HOUR_WINDOW_MIN) return false;
    return parseHours(a.fixed_hours).includes(current);
  });
}

function throttleMinutes(airport) {
  if (airport.schedule_mode === 'fixed_hours') return 60;
  return Math.min(1440, Math.max(1, parseInt(airport.interval_minutes, 10) || 30));
}

async function runTick() {
  if (tickRunning) {
    console.warn('[Airports] Tick précédent encore en cours — déclenchement ignoré');
    return;
  }
  tickRunning = true;
  try {
    const timezone = await getSchedulerTimezone();
    const due      = keepIfScheduledNow(await findDueAirports(), timezone);

    for (const airport of due) {
      const since = lastAttempt.get(airport.code);
      if (since && Date.now() - since < throttleMinutes(airport) * 60_000) continue;
      lastAttempt.set(airport.code, Date.now());

      try {
        const result = await refreshFlights(airport.code);
        if (result.refreshed > 0) {
          await db.query('UPDATE airports SET last_fetched_at = NOW() WHERE code = ?', [airport.code]);
          console.log(`[Airports] ${airport.code} rafraîchi — ${result.refreshed}/${result.total} sens`);
        } else {
          // Pas d'estampille : l'interface ne doit pas annoncer « rafraîchi à l'instant »
          // au-dessus de données inchangées.
          console.warn(`[Airports] ${airport.code} — échec (${result.errors?.join(' · ') || 'cause inconnue'})`);
        }
      } catch (e) {
        console.warn(`[Airports] ${airport.code} interrompu (${e.message})`);
      }
    }
  } catch (e) {
    console.warn(`[Airports] Tick en erreur (${e.message})`);
  } finally {
    tickRunning = false;
  }
}

function stopAirportScheduler() {
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
}

function startAirportScheduler() {
  stopAirportScheduler();
  tickTimer = setInterval(() => { runTick().catch(() => {}); }, TICK_MS);
  console.log('[Airports] Scheduler par aéroport actif — planifications lues en base toutes les minutes');
}

module.exports = {
  startAirportScheduler,
  stopAirportScheduler,
  runTick,
  parseHours,
  keepIfScheduledNow,
  throttleMinutes,
};
