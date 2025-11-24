const pool = require('../config/db');

const heatModel = {
  // Obtener todos los celos con filtros opcionales
  getAll: async (filters = {}) => {
    let query = `
      SELECT 
        h.*,
        s.ear_tag as sow_ear_tag,
        s.alias as sow_alias,
        s.farm_name,
        b.ear_tag as boar_detector_ear_tag,
        b.name as boar_detector_name
      FROM heats h
      LEFT JOIN sows s ON h.sow_id = s.id
      LEFT JOIN boars b ON h.boar_detector_id = b.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    // Filtros opcionales
    if (filters.sow_id) {
      query += ` AND h.sow_id = $${paramCount}`;
      params.push(filters.sow_id);
      paramCount++;
    }

    if (filters.status) {
      query += ` AND h.status = $${paramCount}`;
      params.push(filters.status);
      paramCount++;
    }

    if (filters.heat_type) {
      query += ` AND h.heat_type = $${paramCount}`;
      params.push(filters.heat_type);
      paramCount++;
    }

    if (filters.intensity) {
      query += ` AND h.intensity = $${paramCount}`;
      params.push(filters.intensity);
      paramCount++;
    }

    if (filters.date_from) {
      query += ` AND h.heat_date >= $${paramCount}`;
      params.push(filters.date_from);
      paramCount++;
    }

    if (filters.date_to) {
      query += ` AND h.heat_date <= $${paramCount}`;
      params.push(filters.date_to);
      paramCount++;
    }

    if (filters.farm_name) {
      query += ` AND s.farm_name ILIKE $${paramCount}`;
      params.push(`%${filters.farm_name}%`);
      paramCount++;
    }

    query += ' ORDER BY h.heat_date DESC, h.created_at DESC';

    const result = await pool.query(query, params);
    return result.rows;
  },

  // Obtener un celo por ID
  getById: async (id) => {
    const result = await pool.query(
      `SELECT 
        h.*,
        s.ear_tag as sow_ear_tag,
        s.alias as sow_alias,
        s.breed as sow_breed,
        s.farm_name,
        s.reproductive_status,
        s.parity_count,
        b.ear_tag as boar_detector_ear_tag,
        b.name as boar_detector_name
      FROM heats h
      LEFT JOIN sows s ON h.sow_id = s.id
      LEFT JOIN boars b ON h.boar_detector_id = b.id
      WHERE h.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  // Obtener celos de una cerda específica
  getBySowId: async (sowId) => {
    const result = await pool.query(
      `SELECT 
        h.*,
        b.ear_tag as boar_detector_ear_tag,
        b.name as boar_detector_name
      FROM heats h
      LEFT JOIN boars b ON h.boar_detector_id = b.id
      WHERE h.sow_id = $1
      ORDER BY h.heat_date DESC`,
      [sowId]
    );
    return result.rows;
  },

  // Obtener el último celo de una cerda
  getLastBySowId: async (sowId) => {
    const result = await pool.query(
      `SELECT 
        h.*,
        b.ear_tag as boar_detector_ear_tag,
        b.name as boar_detector_name
      FROM heats h
      LEFT JOIN boars b ON h.boar_detector_id = b.id
      WHERE h.sow_id = $1
      ORDER BY h.heat_date DESC
      LIMIT 1`,
      [sowId]
    );
    return result.rows[0];
  },

  // Crear un nuevo registro de celo
  create: async (heatData) => {
    const {
      sow_id, heat_date, heat_end_date, detection_time, intensity, duration_hours,
      heat_type, induction_protocol, induction_date, peak_estrus_date, peak_estrus_time,
      detection_method, boar_detector_id, standing_reflex, vulva_swelling, vulva_discharge,
      mounting_behavior, restlessness, loss_of_appetite, vocalization, ear_erection,
      tail_deviation, frequent_urination, sniffing_genital, back_arching,
      status, notes, created_by
    } = heatData;

    const result = await pool.query(
      `INSERT INTO heats (
        sow_id, heat_date, heat_end_date, detection_time, intensity, duration_hours,
        heat_type, induction_protocol, induction_date, peak_estrus_date, peak_estrus_time,
        detection_method, boar_detector_id, standing_reflex, vulva_swelling, vulva_discharge,
        mounting_behavior, restlessness, loss_of_appetite, vocalization, ear_erection,
        tail_deviation, frequent_urination, sniffing_genital, back_arching,
        status, notes, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28
      ) RETURNING *`,
      [
        sow_id, heat_date, heat_end_date || null, detection_time || null, 
        intensity || 'medio', duration_hours || null, heat_type || 'natural',
        induction_protocol || null, induction_date || null, peak_estrus_date || null,
        peak_estrus_time || null, detection_method || 'verraco detector',
        boar_detector_id || null, standing_reflex || false, vulva_swelling || false,
        vulva_discharge || false, mounting_behavior || false, restlessness || false,
        loss_of_appetite || false, vocalization || false, ear_erection || false,
        tail_deviation || false, frequent_urination || false, sniffing_genital || false,
        back_arching || false, status || 'detectado', notes || null, created_by || null
      ]
    );
    
    return result.rows[0];
  },

  // Actualizar un celo (solo campos permitidos antes de ser servido)
  update: async (id, heatData) => {
    const {
      heat_date, heat_end_date, detection_time, intensity, duration_hours,
      heat_type, induction_protocol, induction_date, peak_estrus_date, peak_estrus_time,
      detection_method, boar_detector_id, standing_reflex, vulva_swelling, vulva_discharge,
      mounting_behavior, restlessness, loss_of_appetite, vocalization, ear_erection,
      tail_deviation, frequent_urination, sniffing_genital, back_arching,
      notes
    } = heatData;

    const result = await pool.query(
      `UPDATE heats SET
        heat_date = $1, heat_end_date = $2, detection_time = $3, intensity = $4,
        duration_hours = $5, heat_type = $6, induction_protocol = $7, induction_date = $8,
        peak_estrus_date = $9, peak_estrus_time = $10, detection_method = $11,
        boar_detector_id = $12, standing_reflex = $13, vulva_swelling = $14,
        vulva_discharge = $15, mounting_behavior = $16, restlessness = $17,
        loss_of_appetite = $18, vocalization = $19, ear_erection = $20,
        tail_deviation = $21, frequent_urination = $22, sniffing_genital = $23,
        back_arching = $24, notes = $25
      WHERE id = $26 RETURNING *`,
      [
        heat_date, heat_end_date, detection_time, intensity, duration_hours,
        heat_type, induction_protocol, induction_date, peak_estrus_date, peak_estrus_time,
        detection_method, boar_detector_id, standing_reflex, vulva_swelling, vulva_discharge,
        mounting_behavior, restlessness, loss_of_appetite, vocalization, ear_erection,
        tail_deviation, frequent_urination, sniffing_genital, back_arching, notes, id
      ]
    );
    
    return result.rows[0];
  },

  // Actualizar solo el estado del celo
  updateStatus: async (id, status, notes = null) => {
    const result = await pool.query(
      `UPDATE heats SET status = $1, notes = COALESCE($2, notes)
      WHERE id = $3 RETURNING *`,
      [status, notes, id]
    );
    return result.rows[0];
  },

  // Actualización parcial (solo campos específicos)
  partialUpdate: async (id, heatData) => {
    const fields = [];
    const values = [];
    let paramCount = 1;

    // Construir query dinámicamente solo con campos presentes
    Object.keys(heatData).forEach(key => {
      if (heatData[key] !== undefined && key !== 'id') {
        fields.push(`${key} = $${paramCount}`);
        values.push(heatData[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      throw new Error('No hay campos para actualizar');
    }

    values.push(id);

    const query = `UPDATE heats SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await pool.query(query, values);
    
    return result.rows[0];
  },

  // Eliminar un celo (solo si no está asociado a servicios)
  delete: async (id) => {
    const result = await pool.query('DELETE FROM heats WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  },

  // Estadísticas de celos
  getStats: async (filters = {}) => {
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (filters.date_from) {
      whereClause += ` AND h.heat_date >= $${paramCount}`;
      params.push(filters.date_from);
      paramCount++;
    }

    if (filters.date_to) {
      whereClause += ` AND h.heat_date <= $${paramCount}`;
      params.push(filters.date_to);
      paramCount++;
    }

    const result = await pool.query(`
      SELECT
        COUNT(*) as total_heats,
        COUNT(*) FILTER (WHERE h.status = 'detectado') as detectados,
        COUNT(*) FILTER (WHERE h.status = 'servido') as servidos,
        COUNT(*) FILTER (WHERE h.status = 'no servido') as no_servidos,
        COUNT(*) FILTER (WHERE h.status = 'cancelado') as cancelados,
        COUNT(*) FILTER (WHERE h.heat_type = 'natural') as naturales,
        COUNT(*) FILTER (WHERE h.heat_type = 'inducido') as inducidos,
        COUNT(*) FILTER (WHERE h.intensity = 'fuerte') as intensidad_fuerte,
        COUNT(*) FILTER (WHERE h.intensity = 'medio') as intensidad_media,
        COUNT(*) FILTER (WHERE h.intensity = 'debil') as intensidad_debil,
        AVG(h.duration_hours) as duracion_promedio,
        COUNT(DISTINCT h.sow_id) as cerdas_en_celo
      FROM heats h
      ${whereClause}
    `, params);
    
    return result.rows[0];
  },

  // Obtener celos detectados pendientes de servicio
  getPendingHeats: async () => {
    const result = await pool.query(
      `SELECT 
        h.*,
        s.ear_tag as sow_ear_tag,
        s.alias as sow_alias,
        s.breed,
        s.farm_name,
        s.current_weight,
        s.body_condition,
        s.parity_count
      FROM heats h
      INNER JOIN sows s ON h.sow_id = s.id
      WHERE h.status = 'detectado'
        AND s.status = 'activa'
      ORDER BY h.heat_date DESC, h.created_at DESC`
    );
    return result.rows;
  }
};

module.exports = heatModel;
