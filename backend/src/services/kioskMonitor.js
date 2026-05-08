// kioskMonitor — détection des bornes hors-ligne et notification backoffice
// Tourne toutes les 5 minutes. Une borne est "offline" si aucun heartbeat
// reçu depuis plus de 10 minutes. La notification n'est envoyée qu'une fois
// par incident (offline_notified_at) ; elle se réinitialise au heartbeat suivant.
const db = require('./db');

async function notifyAdmins(kiosk) {
  // Récupérer le super_admin et les hotel_admin de l'hôtel concerné
  const [admins] = await db.query(
    `SELECT id FROM users
     WHERE role = 'super_admin'
        OR (role = 'hotel_admin' AND hotel_id = ?)`,
    [kiosk.hotel_id]
  );

  if (!admins.length) return;

  const label   = kiosk.label || `#${kiosk.id}`;
  const message = `La borne "${label}" (${kiosk.hotel_nom}) est hors ligne depuis plus de 10 minutes.`;

  const insertions = admins.map(admin =>
    db.query(
      `INSERT INTO workflow_notifications (recipient_id, type, entity_type, entity_id, message_fr)
       VALUES (?, 'kiosk_offline', 'kiosk', ?, ?)`,
      [admin.id, kiosk.id, message]
    )
  );

  await Promise.all(insertions);

  // Marquer la borne pour ne pas envoyer une nouvelle notification avant le prochain heartbeat
  await db.query(
    'UPDATE kiosks SET offline_notified_at = NOW() WHERE id = ?',
    [kiosk.id]
  );

  console.log(`[kioskMonitor] Notification envoyée pour la borne ${label} (hôtel ${kiosk.hotel_nom})`);
}

async function checkKiosks() {
  try {
    // Bornes actives qui n'ont pas envoyé de heartbeat depuis > 10 min
    // et pour lesquelles on n'a pas encore envoyé de notification
    const [offline] = await db.query(
      `SELECT k.id, k.hotel_id, k.label, h.nom AS hotel_nom
       FROM kiosks k
       JOIN hotels h ON h.id = k.hotel_id
       WHERE k.is_enabled = 1
         AND k.last_seen_at IS NOT NULL
         AND k.last_seen_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE)
         AND k.offline_notified_at IS NULL`
    );

    for (const kiosk of offline) {
      await notifyAdmins(kiosk);
    }
  } catch (err) {
    console.error('[kioskMonitor] Erreur :', err.message);
  }
}

function startKioskMonitor() {
  // Premier passage 30s après le démarrage (laisser la DB se stabiliser)
  setTimeout(() => {
    checkKiosks();
    setInterval(checkKiosks, 5 * 60 * 1000); // toutes les 5 minutes
  }, 30_000);

  console.log('✅ KioskMonitor démarré (vérification toutes les 5 min)');
}

module.exports = { startKioskMonitor };
