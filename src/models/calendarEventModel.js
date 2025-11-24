const pool = require('../config/db');

const calendarEventModel = {
  // Obtener todos los eventos
  getAll: async (filters = {}) => {
    let query = 'SELECT * FROM calendar_events WHERE 1=1';
    const params = [];
    let paramCount = 1;

    // Filtros opcionales
    if (filters.status) {
      query += ` AND status = $${paramCount}`;
      params.push(filters.status);
      paramCount++;
    }

    if (filters.event_type) {
      query += ` AND event_type = $${paramCount}`;
      params.push(filters.event_type);
      paramCount++;
    }

    if (filters.start_date && filters.end_date) {
      query += ` AND event_date BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(filters.start_date, filters.end_date);
      paramCount += 2;
    }

    query += ' ORDER BY event_date ASC, created_at DESC';

    const result = await pool.query(query, params);
    return result.rows;
  },

  // Obtener un evento por ID
  getById: async (id) => {
    const result = await pool.query('SELECT * FROM calendar_events WHERE id = $1', [id]);
    return result.rows[0];
  },

  // Obtener eventos de un mes específico
  getByMonth: async (year, month) => {
    const result = await pool.query(
      `SELECT * FROM calendar_events 
       WHERE EXTRACT(YEAR FROM event_date) = $1 
       AND EXTRACT(MONTH FROM event_date) = $2
       ORDER BY event_date ASC`,
      [year, month]
    );
    return result.rows;
  },

  // Crear un nuevo evento
  create: async (eventData) => {
    const {
      title, event_date, event_type, description, notes,
      status, reminder_days, created_by
    } = eventData;

    const result = await pool.query(
      `INSERT INTO calendar_events (
        title, event_date, event_type, description, notes,
        status, reminder_days, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        title,
        event_date,
        event_type || 'custom',
        description || null,
        notes || null,
        status || 'pending',
        reminder_days || 0,
        created_by || null
      ]
    );
    
    return result.rows[0];
  },

  // Actualizar un evento
  update: async (id, eventData) => {
    const {
      title, event_date, event_type, description, notes,
      status, reminder_days, updated_by
    } = eventData;

    const result = await pool.query(
      `UPDATE calendar_events SET
        title = $1,
        event_date = $2,
        event_type = $3,
        description = $4,
        notes = $5,
        status = $6,
        reminder_days = $7,
        updated_at = NOW(),
        updated_by = $8
      WHERE id = $9 RETURNING *`,
      [
        title,
        event_date,
        event_type,
        description,
        notes,
        status,
        reminder_days,
        updated_by,
        id
      ]
    );
    
    return result.rows[0];
  },

  // Eliminar un evento
  delete: async (id) => {
    const result = await pool.query('DELETE FROM calendar_events WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  },

  // Obtener eventos próximos (próximos N días)
  getUpcoming: async (days = 7) => {
    const result = await pool.query(
      `SELECT * FROM calendar_events 
       WHERE event_date >= CURRENT_DATE 
       AND event_date <= CURRENT_DATE + $1 * INTERVAL '1 day'
       AND status = 'pending'
       ORDER BY event_date ASC`,
      [days]
    );
    return result.rows;
  }
};

module.exports = calendarEventModel;

