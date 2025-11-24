const pool = require('../config/db');

const abortionModel = {
  // Obtener todos los abortos con filtros opcionales
  getAll: async (filters = {}) => {
    let query = `
      SELECT 
        a.*,
        s.ear_tag as sow_ear_tag,
        s.alias as sow_alias,
        s.farm_name,
        p.conception_date,
        p.expected_farrowing_date
      FROM abortions a
      LEFT JOIN sows s ON a.sow_id = s.id
      LEFT JOIN pregnancies p ON a.pregnancy_id = p.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    // Filtros opcionales
    if (filters.sow_id) {
      query += ` AND a.sow_id = $${paramCount}`;
      params.push(filters.sow_id);
      paramCount++;
    }

    if (filters.probable_cause) {
      query += ` AND a.probable_cause = $${paramCount}`;
      params.push(filters.probable_cause);
      paramCount++;
    }

    if (filters.recovery_status) {
      query += ` AND a.recovery_status = $${paramCount}`;
      params.push(filters.recovery_status);
      paramCount++;
    }

    if (filters.date_from) {
      query += ` AND a.abortion_date >= $${paramCount}`;
      params.push(filters.date_from);
      paramCount++;
    }

    if (filters.date_to) {
      query += ` AND a.abortion_date <= $${paramCount}`;
      params.push(filters.date_to);
      paramCount++;
    }

    if (filters.farm_name) {
      query += ` AND s.farm_name ILIKE $${paramCount}`;
      params.push(`%${filters.farm_name}%`);
      paramCount++;
    }

    query += ' ORDER BY a.abortion_date DESC, a.created_at DESC';

    const result = await pool.query(query, params);
    return result.rows;
  },

  // Obtener un aborto por ID
  getById: async (id) => {
    const result = await pool.query(
      `SELECT 
        a.*,
        s.ear_tag as sow_ear_tag,
        s.alias as sow_alias,
        s.breed as sow_breed,
        s.farm_name,
        s.parity_count,
        p.conception_date,
        p.expected_farrowing_date,
        p.confirmed as pregnancy_confirmed
      FROM abortions a
      LEFT JOIN sows s ON a.sow_id = s.id
      LEFT JOIN pregnancies p ON a.pregnancy_id = p.id
      WHERE a.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  // Obtener abortos de una cerda específica
  getBySowId: async (sowId) => {
    const result = await pool.query(
      `SELECT 
        a.*,
        p.conception_date
      FROM abortions a
      LEFT JOIN pregnancies p ON a.pregnancy_id = p.id
      WHERE a.sow_id = $1
      ORDER BY a.abortion_date DESC`,
      [sowId]
    );
    return result.rows;
  },

  // Obtener último aborto de una cerda
  getLastBySowId: async (sowId) => {
    const result = await pool.query(
      `SELECT 
        a.*,
        p.conception_date
      FROM abortions a
      LEFT JOIN pregnancies p ON a.pregnancy_id = p.id
      WHERE a.sow_id = $1
      ORDER BY a.abortion_date DESC
      LIMIT 1`,
      [sowId]
    );
    return result.rows[0];
  },

  // Crear un nuevo registro de aborto
  create: async (abortionData) => {
    const {
      sow_id, pregnancy_id, abortion_date, gestation_days,
      fetuses_expelled, fetus_condition,
      symptoms, fever, vaginal_discharge, anorexia,
      probable_cause, specific_cause,
      laboratory_test, test_results,
      treatment_applied, isolation_required,
      return_to_service_date, recovery_status,
      notes, created_by
    } = abortionData;

    const result = await pool.query(
      `INSERT INTO abortions (
        sow_id, pregnancy_id, abortion_date, gestation_days,
        fetuses_expelled, fetus_condition,
        symptoms, fever, vaginal_discharge, anorexia,
        probable_cause, specific_cause,
        laboratory_test, test_results,
        treatment_applied, isolation_required,
        return_to_service_date, recovery_status,
        notes, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
      ) RETURNING *`,
      [
        sow_id, pregnancy_id, abortion_date, gestation_days,
        fetuses_expelled || 0, fetus_condition || null,
        symptoms || null, fever || false, vaginal_discharge || false, anorexia || false,
        probable_cause || null, specific_cause || null,
        laboratory_test || false, test_results || null,
        treatment_applied || null, isolation_required || false,
        return_to_service_date || null, recovery_status || null,
        notes || null, created_by || null
      ]
    );
    
    return result.rows[0];
  },

  // Actualizar un aborto
  update: async (id, abortionData) => {
    const {
      abortion_date, gestation_days, fetuses_expelled, fetus_condition,
      symptoms, fever, vaginal_discharge, anorexia,
      probable_cause, specific_cause, laboratory_test, test_results,
      treatment_applied, isolation_required, return_to_service_date,
      recovery_status, notes, updated_by
    } = abortionData;

    const result = await pool.query(
      `UPDATE abortions SET
        abortion_date = $1, gestation_days = $2, fetuses_expelled = $3, fetus_condition = $4,
        symptoms = $5, fever = $6, vaginal_discharge = $7, anorexia = $8,
        probable_cause = $9, specific_cause = $10, laboratory_test = $11, test_results = $12,
        treatment_applied = $13, isolation_required = $14, return_to_service_date = $15,
        recovery_status = $16, notes = $17, updated_at = NOW(), updated_by = $18
      WHERE id = $19 RETURNING *`,
      [
        abortion_date, gestation_days, fetuses_expelled, fetus_condition,
        symptoms, fever, vaginal_discharge, anorexia,
        probable_cause, specific_cause, laboratory_test, test_results,
        treatment_applied, isolation_required, return_to_service_date,
        recovery_status, notes, updated_by, id
      ]
    );
    
    return result.rows[0];
  },

  // Actualización parcial (solo campos específicos)
  partialUpdate: async (id, abortionData) => {
    const fields = [];
    const values = [];
    let paramCount = 1;

    // Construir query dinámicamente solo con campos presentes
    Object.keys(abortionData).forEach(key => {
      if (abortionData[key] !== undefined && key !== 'id') {
        fields.push(`${key} = $${paramCount}`);
        values.push(abortionData[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      throw new Error('No hay campos para actualizar');
    }

    // Agregar updated_at
    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `UPDATE abortions SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await pool.query(query, values);
    
    return result.rows[0];
  },

  // Eliminar un aborto
  delete: async (id) => {
    const result = await pool.query('DELETE FROM abortions WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  },

  // Estadísticas de abortos
  getStats: async (filters = {}) => {
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (filters.date_from) {
      whereClause += ` AND a.abortion_date >= $${paramCount}`;
      params.push(filters.date_from);
      paramCount++;
    }

    if (filters.date_to) {
      whereClause += ` AND a.abortion_date <= $${paramCount}`;
      params.push(filters.date_to);
      paramCount++;
    }

    const result = await pool.query(`
      SELECT
        COUNT(*) as total_abortions,
        COUNT(DISTINCT a.sow_id) as sows_with_abortions,
        SUM(a.fetuses_expelled) as total_fetuses_expelled,
        AVG(a.fetuses_expelled) as avg_fetuses_expelled,
        AVG(a.gestation_days) as avg_gestation_days,
        COUNT(*) FILTER (WHERE a.probable_cause = 'infecciosa') as infectious_abortions,
        COUNT(*) FILTER (WHERE a.probable_cause = 'nutricional') as nutritional_abortions,
        COUNT(*) FILTER (WHERE a.probable_cause = 'toxica') as toxic_abortions,
        COUNT(*) FILTER (WHERE a.probable_cause = 'traumatica') as traumatic_abortions,
        COUNT(*) FILTER (WHERE a.probable_cause = 'desconocida') as unknown_abortions,
        COUNT(*) FILTER (WHERE a.fever = TRUE) as with_fever,
        COUNT(*) FILTER (WHERE a.vaginal_discharge = TRUE) as with_discharge,
        COUNT(*) FILTER (WHERE a.anorexia = TRUE) as with_anorexia,
        COUNT(*) FILTER (WHERE a.laboratory_test = TRUE) as with_lab_test,
        COUNT(*) FILTER (WHERE a.isolation_required = TRUE) as requiring_isolation,
        COUNT(*) FILTER (WHERE a.recovery_status = 'completa') as complete_recovery,
        COUNT(*) FILTER (WHERE a.recovery_status = 'parcial') as partial_recovery,
        COUNT(*) FILTER (WHERE a.recovery_status = 'descarte recomendado') as culling_recommended
      FROM abortions a
      ${whereClause}
    `, params);
    
    return result.rows[0];
  },

  // Obtener abortos recientes (últimos 30 días)
  getRecent: async (days = 30) => {
    const result = await pool.query(
      `SELECT 
        a.*,
        s.ear_tag as sow_ear_tag,
        s.alias as sow_alias,
        s.farm_name,
        p.conception_date
      FROM abortions a
      INNER JOIN sows s ON a.sow_id = s.id
      LEFT JOIN pregnancies p ON a.pregnancy_id = p.id
      WHERE a.abortion_date >= CURRENT_DATE - INTERVAL '${days} days'
      ORDER BY a.abortion_date DESC, a.created_at DESC`
    );
    return result.rows;
  },

  // Obtener abortos críticos (que requieren aislamiento o descarte)
  getCritical: async () => {
    const result = await pool.query(
      `SELECT 
        a.*,
        s.ear_tag as sow_ear_tag,
        s.alias as sow_alias,
        s.farm_name
      FROM abortions a
      INNER JOIN sows s ON a.sow_id = s.id
      WHERE a.isolation_required = TRUE
         OR a.recovery_status = 'descarte recomendado'
         OR a.probable_cause = 'infecciosa'
      ORDER BY a.abortion_date DESC`
    );
    return result.rows;
  }
};

module.exports = abortionModel;

