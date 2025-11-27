const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});

pool.on('connect', () => {
  console.log('✅ Conectado a PostgreSQL - Base de datos:', process.env.DB_NAME);
});

pool.on('error', (err) => {
  console.error('❌ Error en la conexión a PostgreSQL:', err);
  // No hacer exit en producción para permitir que el pool se recupere
  if (process.env.NODE_ENV !== 'production') {
    process.exit(-1);
  }
});

// Verificar conexión al inicio
pool.query('SELECT NOW(), current_database() as db', (err, res) => {
  if (err) {
    console.error('❌ Error al verificar conexión:', err.message);
    console.error('   Verifica las credenciales en las variables de entorno');
  } else {
    console.log('✅ Conexión verificada');
    console.log('   Base de datos:', res.rows[0].db);
    console.log('   Hora del servidor:', res.rows[0].now);
  }
});

module.exports = pool;
