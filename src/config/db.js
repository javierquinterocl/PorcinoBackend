const { Pool } = require('pg');
require('dotenv').config();

// Configuración de la conexión con soporte SSL para Supabase
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: false
  } : false,
  // Configuración adicional para Railway
  max: 20, // Número máximo de conexiones en el pool
  idleTimeoutMillis: 30000, // Tiempo de espera antes de cerrar conexiones inactivas
  connectionTimeoutMillis: 2000, // Tiempo de espera para establecer conexión
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
