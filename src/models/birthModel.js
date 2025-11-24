const pool = require('../config/db');

const birthModel = {
  // Obtener todos los partos con filtros opcionales
  getAll: async (filters = {}) => {
    let query = `
      SELECT 
        b.*,
        s.ear_tag as sow_ear_tag,
        s.alias as sow_alias,
        s.farm_name,
        bo.ear_tag as boar_ear_tag,
        bo.name as boar_name,
        p.conception_date,
        p.expected_farrowing_date
      FROM births b
      LEFT JOIN sows s ON b.sow_id = s.id
      LEFT JOIN boars bo ON b.boar_id = bo.id
      LEFT JOIN pregnancies p ON b.pregnancy_id = p.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    // Filtros opcionales
    if (filters.sow_id) {
      query += ` AND b.sow_id = $${paramCount}`;
      params.push(filters.sow_id);
      paramCount++;
    }

    if (filters.boar_id) {
      query += ` AND b.boar_id = $${paramCount}`;
      params.push(filters.boar_id);
      paramCount++;
    }

    if (filters.birth_type) {
      query += ` AND b.birth_type = $${paramCount}`;
      params.push(filters.birth_type);
      paramCount++;
    }

    if (filters.sow_condition) {
      query += ` AND b.sow_condition = $${paramCount}`;
      params.push(filters.sow_condition);
      paramCount++;
    }

    if (filters.date_from) {
      query += ` AND b.birth_date >= $${paramCount}`;
      params.push(filters.date_from);
      paramCount++;
    }

    if (filters.date_to) {
      query += ` AND b.birth_date <= $${paramCount}`;
      params.push(filters.date_to);
      paramCount++;
    }

    if (filters.farm_name) {
      query += ` AND s.farm_name ILIKE $${paramCount}`;
      params.push(`%${filters.farm_name}%`);
      paramCount++;
    }

    query += ' ORDER BY b.birth_date DESC, b.created_at DESC';

    const result = await pool.query(query, params);
    return result.rows;
  },

  // Obtener un parto por ID
  getById: async (id) => {
    const result = await pool.query(
      `SELECT 
        b.*,
        s.ear_tag as sow_ear_tag,
        s.alias as sow_alias,
        s.breed as sow_breed,
        s.farm_name,
        s.parity_count,
        bo.ear_tag as boar_ear_tag,
        bo.name as boar_name,
        bo.breed as boar_breed,
        p.conception_date,
        p.expected_farrowing_date,
        p.confirmed as pregnancy_confirmed
      FROM births b
      LEFT JOIN sows s ON b.sow_id = s.id
      LEFT JOIN boars bo ON b.boar_id = bo.id
      LEFT JOIN pregnancies p ON b.pregnancy_id = p.id
      WHERE b.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  // Obtener partos de una cerda específica
  getBySowId: async (sowId) => {
    const result = await pool.query(
      `SELECT 
        b.*,
        bo.ear_tag as boar_ear_tag,
        bo.name as boar_name,
        p.conception_date
      FROM births b
      LEFT JOIN boars bo ON b.boar_id = bo.id
      LEFT JOIN pregnancies p ON b.pregnancy_id = p.id
      WHERE b.sow_id = $1
      ORDER BY b.birth_date DESC`,
      [sowId]
    );
    return result.rows;
  },

  // Obtener último parto de una cerda
  getLastBySowId: async (sowId) => {
    const result = await pool.query(
      `SELECT 
        b.*,
        bo.ear_tag as boar_ear_tag,
        bo.name as boar_name
      FROM births b
      LEFT JOIN boars bo ON b.boar_id = bo.id
      WHERE b.sow_id = $1
      ORDER BY b.birth_date DESC
      LIMIT 1`,
      [sowId]
    );
    return result.rows[0];
  },

  // Crear un nuevo registro de parto
  create: async (birthData) => {
    const {
      sow_id, pregnancy_id, boar_id, birth_date, birth_start_time, birth_end_time,
      gestation_days, birth_type, assistance_required, veterinarian_name,
      total_born, born_alive, born_dead, mummified, malformed,
      total_litter_weight, avg_piglet_weight, sow_condition, sow_temperature,
      oxytocin_applied, antibiotics_applied, treatment_notes,
      lactation_start_date, expected_weaning_date, notes, created_by
    } = birthData;

    const result = await pool.query(
      `INSERT INTO births (
        sow_id, pregnancy_id, boar_id, birth_date, birth_start_time, birth_end_time,
        gestation_days, birth_type, assistance_required, veterinarian_name,
        total_born, born_alive, born_dead, mummified, malformed,
        total_litter_weight, avg_piglet_weight, sow_condition, sow_temperature,
        oxytocin_applied, antibiotics_applied, treatment_notes,
        lactation_start_date, expected_weaning_date, notes, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26
      ) RETURNING *`,
      [
        sow_id, pregnancy_id, boar_id, birth_date, 
        birth_start_time || null, birth_end_time || null,
        gestation_days, birth_type || 'normal', 
        assistance_required || false, veterinarian_name || null,
        total_born, born_alive, born_dead, 
        mummified || 0, malformed || 0,
        total_litter_weight || null, avg_piglet_weight || null, 
        sow_condition || null, sow_temperature || null,
        oxytocin_applied || false, antibiotics_applied || false, 
        treatment_notes || null,
        lactation_start_date || null, expected_weaning_date || null, 
        notes || null, created_by || null
      ]
    );
    
    return result.rows[0];
  },

  // Actualizar un parto
  update: async (id, birthData) => {
    const {
      birth_date, birth_start_time, birth_end_time, gestation_days, birth_type, 
      assistance_required, veterinarian_name, total_born, born_alive, born_dead, 
      mummified, malformed, total_litter_weight, avg_piglet_weight, sow_condition, 
      sow_temperature, oxytocin_applied, antibiotics_applied, treatment_notes,
      lactation_start_date, expected_weaning_date, notes, updated_by
    } = birthData;

    const result = await pool.query(
      `UPDATE births SET
        birth_date = $1, birth_start_time = $2, birth_end_time = $3,
        gestation_days = $4, birth_type = $5, assistance_required = $6,
        veterinarian_name = $7, total_born = $8, born_alive = $9, born_dead = $10,
        mummified = $11, malformed = $12, total_litter_weight = $13,
        avg_piglet_weight = $14, sow_condition = $15, sow_temperature = $16,
        oxytocin_applied = $17, antibiotics_applied = $18, treatment_notes = $19,
        lactation_start_date = $20, expected_weaning_date = $21, notes = $22,
        updated_at = NOW(), updated_by = $23
      WHERE id = $24 RETURNING *`,
      [
        birth_date, birth_start_time, birth_end_time, gestation_days, birth_type,
        assistance_required, veterinarian_name, total_born, born_alive, born_dead,
        mummified, malformed, total_litter_weight, avg_piglet_weight, sow_condition,
        sow_temperature, oxytocin_applied, antibiotics_applied, treatment_notes,
        lactation_start_date, expected_weaning_date, notes, updated_by, id
      ]
    );
    
    return result.rows[0];
  },

  // Actualización parcial (solo campos específicos)
  partialUpdate: async (id, birthData) => {
    const fields = [];
    const values = [];
    let paramCount = 1;

    // Construir query dinámicamente solo con campos presentes
    Object.keys(birthData).forEach(key => {
      if (birthData[key] !== undefined && key !== 'id') {
        fields.push(`${key} = $${paramCount}`);
        values.push(birthData[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      throw new Error('No hay campos para actualizar');
    }

    // Agregar updated_at
    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `UPDATE births SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await pool.query(query, values);
    
    return result.rows[0];
  },

  // Eliminar un parto
  delete: async (id) => {
    const result = await pool.query('DELETE FROM births WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  },

  // Estadísticas de partos
  getStats: async (filters = {}) => {
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (filters.date_from) {
      whereClause += ` AND b.birth_date >= $${paramCount}`;
      params.push(filters.date_from);
      paramCount++;
    }

    if (filters.date_to) {
      whereClause += ` AND b.birth_date <= $${paramCount}`;
      params.push(filters.date_to);
      paramCount++;
    }

    const result = await pool.query(`
      SELECT
        COUNT(*) as total_births,
        COUNT(DISTINCT b.sow_id) as sows_farrowed,
        SUM(b.total_born) as total_piglets_born,
        SUM(b.born_alive) as total_born_alive,
        SUM(b.born_dead) as total_born_dead,
        SUM(b.mummified) as total_mummified,
        SUM(b.malformed) as total_malformed,
        AVG(b.total_born) as avg_total_born,
        AVG(b.born_alive) as avg_born_alive,
        AVG(b.gestation_days) as avg_gestation_days,
        AVG(b.avg_piglet_weight) as avg_piglet_weight,
        COUNT(*) FILTER (WHERE b.birth_type = 'normal') as normal_births,
        COUNT(*) FILTER (WHERE b.birth_type = 'asistido') as assisted_births,
        COUNT(*) FILTER (WHERE b.birth_type = 'distocico') as dystocic_births,
        COUNT(*) FILTER (WHERE b.birth_type = 'cesarea') as cesarean_births,
        COUNT(*) FILTER (WHERE b.assistance_required = TRUE) as births_needing_assistance,
        COUNT(*) FILTER (WHERE b.sow_condition = 'excelente') as excellent_condition,
        COUNT(*) FILTER (WHERE b.sow_condition = 'buena') as good_condition,
        COUNT(*) FILTER (WHERE b.sow_condition = 'regular') as regular_condition,
        COUNT(*) FILTER (WHERE b.sow_condition IN ('mala', 'critica')) as poor_condition
      FROM births b
      ${whereClause}
    `, params);
    
    return result.rows[0];
  },

  // Obtener partos recientes (últimos 30 días)
  getRecent: async (days = 30) => {
    const result = await pool.query(
      `SELECT 
        b.*,
        s.ear_tag as sow_ear_tag,
        s.alias as sow_alias,
        s.farm_name,
        bo.ear_tag as boar_ear_tag,
        bo.name as boar_name
      FROM births b
      INNER JOIN sows s ON b.sow_id = s.id
      LEFT JOIN boars bo ON b.boar_id = bo.id
      WHERE b.birth_date >= CURRENT_DATE - INTERVAL '${days} days'
      ORDER BY b.birth_date DESC, b.created_at DESC`
    );
    return result.rows;
  },

  // Obtener partos con problemas (distócicos, cesáreas, o condición pobre)
  getProblematicBirths: async () => {
    const result = await pool.query(
      `SELECT 
        b.*,
        s.ear_tag as sow_ear_tag,
        s.alias as sow_alias,
        s.farm_name,
        bo.ear_tag as boar_ear_tag
      FROM births b
      INNER JOIN sows s ON b.sow_id = s.id
      LEFT JOIN boars bo ON b.boar_id = bo.id
      WHERE b.birth_type IN ('distocico', 'cesarea')
         OR b.sow_condition IN ('mala', 'critica')
         OR b.assistance_required = TRUE
      ORDER BY b.birth_date DESC`
    );
    return result.rows;
  }
};

module.exports = birthModel;
