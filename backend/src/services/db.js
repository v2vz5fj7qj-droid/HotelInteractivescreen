// Singleton pool MySQL2 — importé par tous les modèles et routes.
// Variables d'environnement requises : DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD.
// connectionLimit=10 : max 10 connexions simultanées (adapter selon la charge serveur).
// Le charset utf8mb4 est forcé à la connexion pour supporter les emojis et l'arabe.
const mysql = require('mysql2/promise');

if (!process.env.DB_PASSWORD) {
  console.error('[FATAL] DB_PASSWORD non défini dans les variables d\'environnement.');
  process.exit(1);
}

const pool = mysql.createPool({
  host:            process.env.DB_HOST || 'localhost',
  port:            process.env.DB_PORT || 3306,
  database:        process.env.DB_NAME || 'connectbe_kiosk',
  user:            process.env.DB_USER || 'connectbe_user',
  password:        process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit:    10,
  charset:            'utf8mb4',
});

// Force SET NAMES utf8mb4 sur chaque nouvelle connexion du pool
pool.pool.on('connection', conn => {
  conn.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
});

module.exports = pool;
