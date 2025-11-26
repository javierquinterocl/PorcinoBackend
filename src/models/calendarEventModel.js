const pool = require('../config/db');

const calendarEventModel = {
  // Obtener todos los eventos
  getAll: async (filters = {}) => {
    let query = `
      SELECT 
        ce.*,
        u_created.email as created_by_email,
        u_created.first_name || ' ' || u_created.last_name as created_by_name,
        u_updated.email as updated_by_email,
        u_updated.first_name || ' ' || u_updated.last_name as updated_by_name,
        s.ear_tag as sow_ear_tag,
        s.alias as sow_alias,
        s.breed as sow_breed,
        s.reproductive_status as sow_reproductive_status,
        b.ear_tag as boar_ear_tag,
        b.alias as boar_alias,
        p.ear_tag as piglet_ear_tag
      FROM calendar_events ce
      LEFT JOIN users u_created ON ce.created_by = u_created.id
      LEFT JOIN users u_updated ON ce.updated_by = u_updated.id
      LEFT JOIN sows s ON ce.sow_id = s.id
      LEFT JOIN boars b ON ce.boar_id = b.id
      LEFT JOIN piglets p ON ce.piglet_id = p.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    // Filtros opcionales
    if (filters.status) {
      query += ` AND ce.status = $${paramCount}`;
      params.push(filters.status);
      paramCount++;
    }

    if (filters.event_type) {
      query += ` AND ce.event_type = $${paramCount}`;
      params.push(filters.event_type);
      paramCount++;
    }

    if (filters.start_date && filters.end_date) {
      query += ` AND ce.event_date BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(filters.start_date, filters.end_date);
      paramCount += 2;
    }

    if (filters.sow_id) {
      query += ` AND ce.sow_id = $${paramCount}`;
      params.push(filters.sow_id);
      paramCount++;
    }

    query += ' ORDER BY ce.event_date ASC, ce.created_at DESC';

    const result = await pool.query(query, params);
    return result.rows;
  },

  // Obtener un evento por ID
  getById: async (id) => {
    const result = await pool.query(
      `SELECT 
        ce.*,
        u_created.email as created_by_email,
        u_created.first_name || ' ' || u_created.last_name as created_by_name,
        u_updated.email as updated_by_email,
        u_updated.first_name || ' ' || u_updated.last_name as updated_by_name,
        s.ear_tag as sow_ear_tag,
        s.alias as sow_alias,
        s.breed as sow_breed,
        s.reproductive_status as sow_reproductive_status,
        b.ear_tag as boar_ear_tag,
        b.alias as boar_alias,
        p.ear_tag as piglet_ear_tag
      FROM calendar_events ce
      LEFT JOIN users u_created ON ce.created_by = u_created.id
      LEFT JOIN users u_updated ON ce.updated_by = u_updated.id
      LEFT JOIN sows s ON ce.sow_id = s.id
      LEFT JOIN boars b ON ce.boar_id = b.id
      LEFT JOIN piglets p ON ce.piglet_id = p.id
      WHERE ce.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  // Obtener eventos de un mes específico
  getByMonth: async (year, month) => {
    const result = await pool.query(
      `SELECT 
        ce.*,
        u_created.email as created_by_email,
        u_created.first_name || ' ' || u_created.last_name as created_by_name,
        u_updated.email as updated_by_email,
        u_updated.first_name || ' ' || u_updated.last_name as updated_by_name,
        s.ear_tag as sow_ear_tag,
        s.alias as sow_alias,
        s.breed as sow_breed,
        s.reproductive_status as sow_reproductive_status,
        b.ear_tag as boar_ear_tag,
        b.alias as boar_alias,
        p.ear_tag as piglet_ear_tag
      FROM calendar_events ce
      LEFT JOIN users u_created ON ce.created_by = u_created.id
      LEFT JOIN users u_updated ON ce.updated_by = u_updated.id
      LEFT JOIN sows s ON ce.sow_id = s.id
      LEFT JOIN boars b ON ce.boar_id = b.id
      LEFT JOIN piglets p ON ce.piglet_id = p.id
      WHERE EXTRACT(YEAR FROM ce.event_date) = $1 
       AND EXTRACT(MONTH FROM ce.event_date) = $2
       ORDER BY ce.event_date ASC`,
      [year, month]
    );
    return result.rows;
  },

  // Crear un nuevo evento
  create: async (eventData) => {
    const {
      title, event_date, event_type, description, notes,
      status, reminder_days, created_by, sow_id, boar_id, piglet_id
    } = eventData;

    const result = await pool.query(
      `INSERT INTO calendar_events (
        title, event_date, event_type, description, notes,
        status, reminder_days, created_by, sow_id, boar_id, piglet_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [
        title,
        event_date,
        event_type || 'custom',
        description || null,
        notes || null,
        status || 'pending',
        reminder_days || 0,
        created_by || null,
        sow_id || null,
        boar_id || null,
        piglet_id || null
      ]
    );
    
    // Obtener el evento completo con la información del usuario
    return calendarEventModel.getById(result.rows[0].id);
  },

  // Actualizar un evento
  update: async (id, eventData) => {
    const {
      title, event_date, event_type, description, notes,
      status, reminder_days, updated_by, sow_id, boar_id, piglet_id
    } = eventData;

    await pool.query(
      `UPDATE calendar_events SET
        title = $1,
        event_date = $2,
        event_type = $3,
        description = $4,
        notes = $5,
        status = $6,
        reminder_days = $7,
        updated_at = NOW(),
        updated_by = $8,
        sow_id = $9,
        boar_id = $10,
        piglet_id = $11
      WHERE id = $12`,
      [
        title,
        event_date,
        event_type,
        description,
        notes,
        status,
        reminder_days,
        updated_by,
        sow_id,
        boar_id,
        piglet_id,
        id
      ]
    );
    
    // Obtener el evento completo con la información del usuario
    return calendarEventModel.getById(id);
  },

  // Eliminar un evento
  delete: async (id) => {
    const result = await pool.query('DELETE FROM calendar_events WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  },

  // Obtener eventos próximos (próximos N días)
  getUpcoming: async (days = 7) => {
    const result = await pool.query(
      `SELECT 
        ce.*,
        u_created.email as created_by_email,
        u_created.first_name || ' ' || u_created.last_name as created_by_name,
        u_updated.email as updated_by_email,
        u_updated.first_name || ' ' || u_updated.last_name as updated_by_name,
        s.ear_tag as sow_ear_tag,
        s.alias as sow_alias,
        s.breed as sow_breed,
        s.reproductive_status as sow_reproductive_status,
        b.ear_tag as boar_ear_tag,
        b.alias as boar_alias,
        p.ear_tag as piglet_ear_tag
      FROM calendar_events ce
      LEFT JOIN users u_created ON ce.created_by = u_created.id
      LEFT JOIN users u_updated ON ce.updated_by = u_updated.id
      LEFT JOIN sows s ON ce.sow_id = s.id
      LEFT JOIN boars b ON ce.boar_id = b.id
      LEFT JOIN piglets p ON ce.piglet_id = p.id
      WHERE ce.event_date >= CURRENT_DATE 
       AND ce.event_date <= CURRENT_DATE + $1 * INTERVAL '1 day'
       AND ce.status = 'pending'
       ORDER BY ce.event_date ASC`,
      [days]
    );
    return result.rows;
  }
};

module.exports = calendarEventModel;

