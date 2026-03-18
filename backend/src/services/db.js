const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:            process.env.DB_HOST     || 'localhost',
  port:            process.env.DB_PORT     || 3306,
  database:        process.env.DB_NAME     || 'connectbe_kiosk',
  user:            process.env.DB_USER     || 'connectbe_user',
  password:        process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit:    10,
  charset: 'utf8mb4',
});

module.exports = pool;
