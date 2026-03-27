const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:            process.env.DB_HOST     || 'localhost',
  port:            process.env.DB_PORT     || 3306,
  database:        process.env.DB_NAME     || 'connectbe_kiosk',
  user:            process.env.DB_USER     || 'connectbe_user',
  password:        process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit:    10,
  charset:            'UTF8MB4_UNICODE_CI',
});

// Force SET NAMES utf8mb4 sur chaque nouvelle connexion du pool
pool.pool.on('connection', conn => {
  conn.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
});

module.exports = pool;
