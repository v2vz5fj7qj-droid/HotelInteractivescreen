// Archivage automatique des événements datés passés
// Appelé au démarrage et toutes les nuits à minuit
const Event = require('../models/event');

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

function startArchiveScheduler() {
  // Exécution immédiate au démarrage
  archiveExpiredEvents();

  // Puis toutes les nuits à minuit (86400000 ms)
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const msUntilMidnight = midnight - now;

  setTimeout(() => {
    archiveExpiredEvents();
    setInterval(archiveExpiredEvents, 86400000);
  }, msUntilMidnight);

  console.log(`[archiveService] Scheduler démarré — prochain passage dans ${Math.round(msUntilMidnight / 60000)} min`);
}

module.exports = { startArchiveScheduler, archiveExpiredEvents };
