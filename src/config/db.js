const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

pool.on('connect', () => {
  console.log('✅ Conectado a PostgreSQL - Base de datos: porcime');
});

pool.on('error', (err) => {
  console.error('❌ Error en la conexión a PostgreSQL:', err);
  process.exit(-1);
});

// Verificar conexión al inicio
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Error al verificar conexión:', err);
  } else {
    console.log('✅ Conexión verificada:', res.rows[0].now);
  }
});

module.exports = pool;
