const pool = require('../config/db');

const serviceModel = {
  /**
   * Obtener todos los servicios con información relacionada
   */
  getAll: async (filters = {}) => {
    let query = `
      SELECT 
        s.*,
        sw.ear_tag as sow_code,
        sw.alias as sow_alias,
        sw.farm_name,
        sw.breed as sow_breed,
        b.ear_tag as boar_code,
        b.name as boar_name,
        b.breed as boar_breed,
        h.heat_date,
        h.intensity as heat_intensity,
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM pregnancies p 
            WHERE p.service_id = s.id AND p.confirmed = TRUE
          ) THEN TRUE 
          ELSE FALSE 
        END as has_confirmed_pregnancy
      FROM services s
      INNER JOIN sows sw ON s.sow_id = sw.id
      LEFT JOIN boars b ON s.boar_id = b.id
      INNER JOIN heats h ON s.heat_id = h.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;

    // Filtros opcionales
    if (filters.sow_id) {
      query += ` AND s.sow_id = $${paramCount}`;
      params.push(filters.sow_id);
      paramCount++;
    }

    if (filters.boar_id) {
      query += ` AND s.boar_id = $${paramCount}`;
      params.push(filters.boar_id);
      paramCount++;
    }

    if (filters.service_type) {
      query += ` AND s.service_type = $${paramCount}`;
      params.push(filters.service_type);
      paramCount++;
    }

    if (filters.start_date && filters.end_date) {
      query += ` AND s.service_date BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(filters.start_date, filters.end_date);
      paramCount += 2;
    }

    query += ` ORDER BY s.service_date DESC, s.created_at DESC`;

    const result = await pool.query(query, params);
    return result.rows;
  },

  /**
   * Obtener un servicio por ID
   */
  getById: async (id) => {
    const query = `
      SELECT 
        s.*,
        sw.ear_tag as sow_ear_tag,
        sw.alias as sow_alias,
        sw.farm_name,
        sw.breed as sow_breed,
        sw.parity_count,
        b.ear_tag as boar_ear_tag,
        b.name as boar_name,
        b.breed as boar_breed,
        h.heat_date,
        h.intensity as heat_intensity,
        h.status as heat_status,
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM pregnancies p 
            WHERE p.service_id = s.id AND p.confirmed = TRUE
          ) THEN TRUE 
          ELSE FALSE 
        END as has_confirmed_pregnancy
      FROM services s
      INNER JOIN sows sw ON s.sow_id = sw.id
      LEFT JOIN boars b ON s.boar_id = b.id
      INNER JOIN heats h ON s.heat_id = h.id
      WHERE s.id = $1
    `;
    
    const result = await pool.query(query, [id]);
    return result.rows[0];
  },

  /**
   * Obtener servicios de una cerda específica
   */
  getBySowId: async (sowId) => {
    const query = `
      SELECT 
        s.*,
        b.ear_tag as boar_ear_tag,
        b.name as boar_name,
        h.heat_date,
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM pregnancies p 
            WHERE p.service_id = s.id AND p.confirmed = TRUE
          ) THEN TRUE 
          ELSE FALSE 
        END as has_confirmed_pregnancy
      FROM services s
      LEFT JOIN boars b ON s.boar_id = b.id
      INNER JOIN heats h ON s.heat_id = h.id
      WHERE s.sow_id = $1
      ORDER BY s.service_date DESC
    `;
    
    const result = await pool.query(query, [sowId]);
    return result.rows;
  },

  /**
   * Obtener servicios de un celo específico
   */
  getByHeatId: async (heatId) => {
    const query = `
      SELECT 
      SELECT s.*,
        sw.ear_tag as sow_code,
        sw.alias as sow_alias,
        b.ear_tag as boar_code,
        b.name as boar_name
      FROM services s
      INNER JOIN sows sw ON s.sow_id = sw.id
      LEFT JOIN boars b ON s.boar_id = b.id
      WHERE s.heat_id = $1
      ORDER BY s.service_number ASC
    `;
    
    const result = await pool.query(query, [heatId]);
    return result.rows;
  },

  /**
   * Crear un nuevo servicio
   */
  create: async (serviceData) => {
    const query = `
      INSERT INTO services (
        sow_id, boar_id, heat_id, service_date, service_time, 
        service_type, service_number, technician_name,
        mating_duration_minutes, mating_quality,
        ia_type, semen_dose_code, semen_volume_ml, semen_concentration,
        success, notes, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
      )
      RETURNING *
    `;

    const values = [
      serviceData.sow_id,
      serviceData.boar_id || null,
      serviceData.heat_id,
      serviceData.service_date,
      serviceData.service_time || null,
      serviceData.service_type,
      serviceData.service_number || 1,
      serviceData.technician_name || null,
      serviceData.mating_duration_minutes || null,
      serviceData.mating_quality || null,
      serviceData.ia_type || null,
      serviceData.semen_dose_code || null,
      serviceData.semen_volume_ml || null,
      serviceData.semen_concentration || null,
      serviceData.success || null,
      serviceData.notes || null,
      serviceData.created_by || null
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  /**
   * Actualizar un servicio existente
   */
  update: async (id, serviceData) => {
    const query = `
      UPDATE services SET
        sow_id = COALESCE($1, sow_id),
        boar_id = $2,
        heat_id = COALESCE($3, heat_id),
        service_date = COALESCE($4, service_date),
        service_time = $5,
        service_type = COALESCE($6, service_type),
        service_number = COALESCE($7, service_number),
        technician_name = $8,
        mating_duration_minutes = $9,
        mating_quality = $10,
        ia_type = $11,
        semen_dose_code = $12,
        semen_volume_ml = $13,
        semen_concentration = $14,
        success = $15,
        notes = $16
      WHERE id = $17
      RETURNING *
    `;

    const values = [
      serviceData.sow_id,
      serviceData.boar_id,
      serviceData.heat_id,
      serviceData.service_date,
      serviceData.service_time,
      serviceData.service_type,
      serviceData.service_number,
      serviceData.technician_name,
      serviceData.mating_duration_minutes,
      serviceData.mating_quality,
      serviceData.ia_type,
      serviceData.semen_dose_code,
      serviceData.semen_volume_ml,
      serviceData.semen_concentration,
      serviceData.success,
      serviceData.notes,
      id
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  /**
   * Eliminar un servicio
   */
  delete: async (id) => {
    const query = 'DELETE FROM services WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  },

  /**
   * Obtener estadísticas de servicios
   */
  getStats: async (filters = {}) => {
    let query = `
      SELECT 
        COUNT(*) as total_services,
        COUNT(CASE WHEN service_type = 'monta natural' THEN 1 END) as natural_matings,
        COUNT(CASE WHEN service_type = 'inseminacion artificial' THEN 1 END) as artificial_inseminations,
        COUNT(CASE WHEN success = TRUE THEN 1 END) as successful_services,
        COUNT(CASE WHEN success = FALSE THEN 1 END) as failed_services,
        CASE 
          WHEN COUNT(*) > 0 THEN ROUND((COUNT(CASE WHEN success = TRUE THEN 1 END)::NUMERIC / COUNT(*)::NUMERIC) * 100, 1)
          ELSE 0
        END as success_rate,
        AVG(service_number) as avg_service_number,
        COUNT(DISTINCT sow_id) as sows_served,
        COUNT(DISTINCT boar_id) as boars_used
      FROM services
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    if (filters.start_date && filters.end_date) {
      query += ` AND service_date BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(filters.start_date, filters.end_date);
    }

    const result = await pool.query(query, params);
    const stats = result.rows[0];
    
    // Convertir valores numéricos
    return {
      total_services: parseInt(stats.total_services),
      natural_matings: parseInt(stats.natural_matings),
      artificial_inseminations: parseInt(stats.artificial_inseminations),
      successful_services: parseInt(stats.successful_services),
      failed_services: parseInt(stats.failed_services),
      success_rate: parseFloat(stats.success_rate) || 0,
      avg_service_number: parseFloat(stats.avg_service_number) || 0,
      sows_served: parseInt(stats.sows_served),
      boars_used: parseInt(stats.boars_used)
    };
  },

  /**
   * Verificar si un servicio tiene gestación asociada
   */
  hasPregnancy: async (id) => {
    const query = `
      SELECT EXISTS (
        SELECT 1 FROM pregnancies 
        WHERE service_id = $1
      ) as has_pregnancy
    `;
    
    const result = await pool.query(query, [id]);
    return result.rows[0].has_pregnancy;
  }
};

module.exports = serviceModel;
