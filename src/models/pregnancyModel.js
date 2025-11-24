const pool = require('../config/db');

const pregnancyModel = {
  // Obtener todas las gestaciones con filtros opcionales
  getAll: async (filters = {}) => {
    let query = `
      SELECT 
        p.*,
        s.ear_tag as sow_ear_tag,
        s.alias as sow_alias,
        s.farm_name,
        s.breed as sow_breed,
        srv.service_date,
        srv.service_type,
        srv.boar_id as boar_id,
        b.ear_tag as boar_ear_tag,
        b.name as boar_name
      FROM pregnancies p
      LEFT JOIN sows s ON p.sow_id = s.id
      LEFT JOIN services srv ON p.service_id = srv.id
      LEFT JOIN boars b ON srv.boar_id = b.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    // Filtros opcionales
    if (filters.sow_id) {
      query += ` AND p.sow_id = $${paramCount}`;
      params.push(filters.sow_id);
      paramCount++;
    }

    if (filters.status) {
      query += ` AND p.status = $${paramCount}`;
      params.push(filters.status);
      paramCount++;
    }

    if (filters.confirmed !== undefined) {
      query += ` AND p.confirmed = $${paramCount}`;
      params.push(filters.confirmed);
      paramCount++;
    }

    if (filters.confirmation_method) {
      query += ` AND p.confirmation_method = $${paramCount}`;
      params.push(filters.confirmation_method);
      paramCount++;
    }

    if (filters.conception_date_from) {
      query += ` AND p.conception_date >= $${paramCount}`;
      params.push(filters.conception_date_from);
      paramCount++;
    }

    if (filters.conception_date_to) {
      query += ` AND p.conception_date <= $${paramCount}`;
      params.push(filters.conception_date_to);
      paramCount++;
    }

    if (filters.expected_farrowing_from) {
      query += ` AND p.expected_farrowing_date >= $${paramCount}`;
      params.push(filters.expected_farrowing_from);
      paramCount++;
    }

    if (filters.expected_farrowing_to) {
      query += ` AND p.expected_farrowing_date <= $${paramCount}`;
      params.push(filters.expected_farrowing_to);
      paramCount++;
    }

    if (filters.farm_name) {
      query += ` AND s.farm_name ILIKE $${paramCount}`;
      params.push(`%${filters.farm_name}%`);
      paramCount++;
    }

    query += ' ORDER BY p.expected_farrowing_date ASC, p.conception_date DESC, p.created_at DESC';

    const result = await pool.query(query, params);
    return result.rows;
  },

  // Obtener una gestación por ID
  getById: async (id) => {
    const result = await pool.query(
      `SELECT 
        p.*,
        s.ear_tag as sow_ear_tag,
        s.alias as sow_alias,
        s.breed as sow_breed,
        s.farm_name,
        s.parity_count,
        s.reproductive_status,
        s.current_weight,
        s.body_condition,
        srv.service_date,
        srv.service_type,
        srv.service_time,
        srv.service_number,
        srv.technician_name,
        srv.boar_id as boar_id,
        b.ear_tag as boar_ear_tag,
        b.name as boar_name,
        b.breed as boar_breed
      FROM pregnancies p
      LEFT JOIN sows s ON p.sow_id = s.id
      LEFT JOIN services srv ON p.service_id = srv.id
      LEFT JOIN boars b ON srv.boar_id = b.id
      WHERE p.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  // Obtener gestaciones de una cerda específica
  getBySowId: async (sowId) => {
    const result = await pool.query(
      `SELECT 
        p.*,
        srv.service_date,
        srv.service_type,
        srv.boar_id as boar_id,
        b.ear_tag as boar_ear_tag,
        b.name as boar_name
      FROM pregnancies p
      LEFT JOIN services srv ON p.service_id = srv.id
      LEFT JOIN boars b ON srv.boar_id = b.id
      WHERE p.sow_id = $1
      ORDER BY p.conception_date DESC`,
      [sowId]
    );
    return result.rows;
  },

  // Obtener la gestación activa de una cerda (status = 'en curso')
  getActiveBySowId: async (sowId) => {
    const result = await pool.query(
      `SELECT 
        p.*,
        srv.service_date,
        srv.service_type,
        b.ear_tag as boar_ear_tag,
        b.name as boar_name
      FROM pregnancies p
      LEFT JOIN services srv ON p.service_id = srv.id
      LEFT JOIN boars b ON srv.boar_id = b.id
      WHERE p.sow_id = $1 AND p.status = 'en curso'
      ORDER BY p.conception_date DESC
      LIMIT 1`,
      [sowId]
    );
    return result.rows[0];
  },

  // Crear un nuevo registro de gestación
  create: async (pregnancyData) => {
    const {
      sow_id, service_id, conception_date, expected_farrowing_date,
      confirmed, confirmation_date, confirmation_method,
      ultrasound_count, last_ultrasound_date, estimated_piglets,
      ultrasound_image_url, notes, created_by
    } = pregnancyData;

    const result = await pool.query(
      `INSERT INTO pregnancies (
        sow_id, service_id, conception_date, expected_farrowing_date,
        confirmed, confirmation_date, confirmation_method,
        status, ultrasound_count, last_ultrasound_date, estimated_piglets,
        ultrasound_image_url, notes, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      ) RETURNING *`,
      [
        sow_id, service_id, conception_date, expected_farrowing_date || null,
        confirmed || false, confirmation_date || null, confirmation_method || null,
        'en curso', ultrasound_count || 0, last_ultrasound_date || null,
        estimated_piglets || null, ultrasound_image_url || null,
        notes || null, created_by || null
      ]
    );
    
    return result.rows[0];
  },

  // Actualizar una gestación
  update: async (id, pregnancyData) => {
    const {
      conception_date, expected_farrowing_date,
      confirmed, confirmation_date, confirmation_method,
      status, ultrasound_count, last_ultrasound_date, estimated_piglets,
      ultrasound_image_url, notes, updated_by
    } = pregnancyData;

    const result = await pool.query(
      `UPDATE pregnancies SET
        conception_date = $1, expected_farrowing_date = $2,
        confirmed = $3, confirmation_date = $4, confirmation_method = $5,
        status = $6, ultrasound_count = $7, last_ultrasound_date = $8,
        estimated_piglets = $9, ultrasound_image_url = $10, notes = $11,
        updated_at = NOW(), updated_by = $12
      WHERE id = $13 RETURNING *`,
      [
        conception_date, expected_farrowing_date,
        confirmed, confirmation_date, confirmation_method,
        status, ultrasound_count, last_ultrasound_date, estimated_piglets,
        ultrasound_image_url, notes, updated_by, id
      ]
    );
    
    return result.rows[0];
  },

  // Actualizar solo el estado de la gestación
  updateStatus: async (id, status, notes = null, updated_by = null) => {
    const result = await pool.query(
      `UPDATE pregnancies SET 
        status = $1, 
        notes = COALESCE($2, notes),
        updated_at = NOW(),
        updated_by = $3
      WHERE id = $4 RETURNING *`,
      [status, notes, updated_by, id]
    );
    return result.rows[0];
  },

  // Confirmar gestación (actualizar confirmed a true)
  confirmPregnancy: async (id, confirmationData) => {
    const {
      confirmation_date, confirmation_method, estimated_piglets,
      ultrasound_image_url, notes, updated_by
    } = confirmationData;

    const result = await pool.query(
      `UPDATE pregnancies SET
        confirmed = true,
        confirmation_date = $1,
        confirmation_method = $2,
        estimated_piglets = COALESCE($3, estimated_piglets),
        ultrasound_image_url = COALESCE($4, ultrasound_image_url),
        ultrasound_count = ultrasound_count + 1,
        last_ultrasound_date = CASE WHEN $2 = 'ultrasonido' THEN $1 ELSE last_ultrasound_date END,
        notes = COALESCE($5, notes),
        updated_at = NOW(),
        updated_by = $6
      WHERE id = $7 RETURNING *`,
      [
        confirmation_date, confirmation_method, estimated_piglets,
        ultrasound_image_url, notes, updated_by, id
      ]
    );
    
    return result.rows[0];
  },

  // Actualización parcial (solo campos específicos)
  partialUpdate: async (id, pregnancyData) => {
    const fields = [];
    const values = [];
    let paramCount = 1;

    // Construir query dinámicamente solo con campos presentes
    Object.keys(pregnancyData).forEach(key => {
      if (pregnancyData[key] !== undefined && key !== 'id') {
        fields.push(`${key} = $${paramCount}`);
        values.push(pregnancyData[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      throw new Error('No hay campos para actualizar');
    }

    // Agregar updated_at
    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `UPDATE pregnancies SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await pool.query(query, values);
    
    return result.rows[0];
  },

  // Eliminar una gestación (solo si no tiene partos asociados)
  delete: async (id) => {
    const result = await pool.query('DELETE FROM pregnancies WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  },

  // Estadísticas de gestaciones
  getStats: async (filters = {}) => {
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (filters.date_from) {
      whereClause += ` AND p.conception_date >= $${paramCount}`;
      params.push(filters.date_from);
      paramCount++;
    }

    if (filters.date_to) {
      whereClause += ` AND p.conception_date <= $${paramCount}`;
      params.push(filters.date_to);
      paramCount++;
    }

    const result = await pool.query(`
      SELECT
        COUNT(*) as total_pregnancies,
        COUNT(*) FILTER (WHERE p.status = 'en curso') as en_curso,
        COUNT(*) FILTER (WHERE p.status = 'finalizada parto') as finalizadas_parto,
        COUNT(*) FILTER (WHERE p.status = 'finalizada aborto') as finalizadas_aborto,
        COUNT(*) FILTER (WHERE p.status = 'no confirmada') as no_confirmadas,
        COUNT(*) FILTER (WHERE p.confirmed = true) as confirmadas,
        COUNT(*) FILTER (WHERE p.confirmed = false) as pendientes_confirmacion,
        COUNT(*) FILTER (WHERE p.confirmation_method = 'ultrasonido') as confirmadas_ultrasonido,
        COUNT(*) FILTER (WHERE p.confirmation_method = 'no repeticion celo') as confirmadas_no_repeticion,
        AVG(p.estimated_piglets) as promedio_lechones_estimados,
        AVG(p.ultrasound_count) as promedio_ecografias,
        COUNT(DISTINCT p.sow_id) as cerdas_gestantes
      FROM pregnancies p
      ${whereClause}
    `, params);
    
    return result.rows[0];
  },

  // Obtener gestaciones próximas a parto (últimos 7 días antes del parto esperado)
  getUpcomingFarrowings: async (daysAhead = 7) => {
    const result = await pool.query(
      `SELECT 
        p.*,
        s.ear_tag as sow_ear_tag,
        s.alias as sow_alias,
        s.breed,
        s.farm_name,
        s.parity_count,
        srv.service_date,
        b.ear_tag as boar_ear_tag,
        b.name as boar_name,
        (p.expected_farrowing_date - CURRENT_DATE) as days_until_farrowing
      FROM pregnancies p
      INNER JOIN sows s ON p.sow_id = s.id
      LEFT JOIN services srv ON p.service_id = srv.id
      LEFT JOIN boars b ON srv.boar_id = b.id
      WHERE p.status = 'en curso'
        AND p.confirmed = true
        AND p.expected_farrowing_date BETWEEN CURRENT_DATE AND CURRENT_DATE + $1
      ORDER BY p.expected_farrowing_date ASC`,
      [daysAhead]
    );
    return result.rows;
  },

  // Obtener gestaciones vencidas (fecha de parto esperado pasada)
  getOverduePregnancies: async () => {
    const result = await pool.query(
      `SELECT 
        p.*,
        s.ear_tag as sow_ear_tag,
        s.alias as sow_alias,
        s.breed,
        s.farm_name,
        srv.service_date,
        b.ear_tag as boar_ear_tag,
        (CURRENT_DATE - p.expected_farrowing_date) as days_overdue
      FROM pregnancies p
      INNER JOIN sows s ON p.sow_id = s.id
      LEFT JOIN services srv ON p.service_id = srv.id
      LEFT JOIN boars b ON srv.boar_id = b.id
      WHERE p.status = 'en curso'
        AND p.expected_farrowing_date < CURRENT_DATE
      ORDER BY p.expected_farrowing_date ASC`
    );
    return result.rows;
  },

  // Obtener gestaciones pendientes de confirmación (más de 21 días desde concepción)
  getPendingConfirmation: async () => {
    const result = await pool.query(
      `SELECT 
        p.*,
        s.ear_tag as sow_ear_tag,
        s.alias as sow_alias,
        s.farm_name,
        srv.service_date,
        (CURRENT_DATE - p.conception_date) as days_since_conception
      FROM pregnancies p
      INNER JOIN sows s ON p.sow_id = s.id
      LEFT JOIN services srv ON p.service_id = srv.id
      WHERE p.status = 'en curso'
        AND p.confirmed = false
        AND (CURRENT_DATE - p.conception_date) >= 21
      ORDER BY p.conception_date ASC`
    );
    return result.rows;
  }
};

module.exports = pregnancyModel;
