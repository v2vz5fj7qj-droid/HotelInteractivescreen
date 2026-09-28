// Archivage automatique des événements datés passés
// Appelé au démarrage et toutes les nuits à minuit
//
// Le même passage nocturne assure la purge RGPD des codes d'accès client :
// un code porte un nom et un numéro de chambre, données personnelles qui n'ont
// pas à survivre au séjour.
const Event = require('../models/event');
const db    = require('./db');

// Rétention après la fin d'accès réelle (départ + courtoisie).
const GUEST_RETENTION_DAYS = parseInt(process.env.GUEST_RETENTION_DAYS || '30', 10);

// Purge en deux temps, volontairement : les sessions (empreinte d'appareil,
// user-agent, IP) disparaissent, le code reste avec son nom vidé. On conserve
// ainsi les statistiques d'usage par chambre sans conserver d'identité.
async function purgeExpiredGuestData() {
  try {
    const [sessions] = await db.query(
      `DELETE s FROM guest_sessions s
       JOIN guest_codes c ON c.id = s.code_id
       WHERE DATE_ADD(c.valid_until, INTERVAL (c.grace_hours + ? * 24) HOUR) < NOW()`,
      [GUEST_RETENTION_DAYS]
    );

    const [codes] = await db.query(
      `UPDATE guest_codes
       SET guest_name = NULL, anonymized_at = NOW()
       WHERE anonymized_at IS NULL
         AND guest_name IS NOT NULL
         AND DATE_ADD(valid_until, INTERVAL (grace_hours + ? * 24) HOUR) < NOW()`,
      [GUEST_RETENTION_DAYS]
    );

    if (sessions.affectedRows || codes.affectedRows) {
      console.log(
        `[archiveService] Purge visiteurs — ${sessions.affectedRows} session(s) supprimée(s), ` +
        `${codes.affectedRows} code(s) anonymisé(s)`
      );
    }
  } catch (err) {
    console.error('[archiveService] Erreur purge visiteurs:', err.message);
  }
}

async function archiveExpiredEvents() {
  try {
    const [result] = await Event.archiveExpired();
    if (result.affectedRows > 0) {
      console.log(`[archiveService] ${result.affectedRows} événement(s) archivé(s) automatiquement`);
    }
  } catch (err) {
    console.error('[archiveService] Erreur archivage:', err.message);
  }
}

async function nightlyPass() {
  await archiveExpiredEvents();
  await purgeExpiredGuestData();
}

function startArchiveScheduler() {
  // Exécution immédiate au démarrage
  nightlyPass();

  // Puis toutes les nuits à minuit (86400000 ms)
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const msUntilMidnight = midnight - now;

  setTimeout(() => {
    nightlyPass();
    setInterval(nightlyPass, 86400000);
  }, msUntilMidnight);

  console.log(`[archiveService] Scheduler démarré — prochain passage dans ${Math.round(msUntilMidnight / 60000)} min`);
}

module.exports = { startArchiveScheduler, archiveExpiredEvents, purgeExpiredGuestData };
