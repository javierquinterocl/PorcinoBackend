const pool = require('../config/db');

const pigletModel = {
  // Obtener todos los lechones con filtros opcionales
  getAll: async (filters = {}) => {
    let query = `
      SELECT 
        p.*,
        s.ear_tag as sow_ear_tag,
        s.alias as sow_alias,
        bo.ear_tag as sire_ear_tag,
        bo.name as sire_name,
        b.birth_date,
        b.total_born,
        b.birth_type,
        asi.ear_tag as adoptive_sow_ear_tag,
        asi.alias as adoptive_sow_alias
      FROM piglets p
      LEFT JOIN sows s ON p.sow_id = s.id
      LEFT JOIN boars bo ON p.sire_id = bo.id
      LEFT JOIN births b ON p.birth_id = b.id
      LEFT JOIN sows asi ON p.adoptive_sow_id = asi.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    // Filtros opcionales
    if (filters.birth_id) {
      query += ` AND p.birth_id = $${paramCount}`;
      params.push(filters.birth_id);
      paramCount++;
    }

    if (filters.sow_id) {
      query += ` AND p.sow_id = $${paramCount}`;
      params.push(filters.sow_id);
      paramCount++;
    }

    if (filters.sire_id) {
      query += ` AND p.sire_id = $${paramCount}`;
      params.push(filters.sire_id);
      paramCount++;
    }

    if (filters.sex) {
      query += ` AND p.sex = $${paramCount}`;
      params.push(filters.sex);
      paramCount++;
    }

    if (filters.birth_status) {
      query += ` AND p.birth_status = $${paramCount}`;
      params.push(filters.birth_status);
      paramCount++;
    }

    if (filters.current_status) {
      query += ` AND p.current_status = $${paramCount}`;
      params.push(filters.current_status);
      paramCount++;
    }

    query += ' ORDER BY b.birth_date DESC, p.birth_order ASC';

    const result = await pool.query(query, params);
    return result.rows;
  },

  // Obtener un lechón por ID
  getById: async (id) => {
    const result = await pool.query(
      `SELECT 
        p.*,
        s.ear_tag as sow_ear_tag,
        s.alias as sow_alias,
        s.breed as sow_breed,
        bo.ear_tag as sire_ear_tag,
        bo.name as sire_name,
        bo.breed as sire_breed,
        b.birth_date,
        b.birth_type,
        b.total_born,
        asi.ear_tag as adoptive_sow_ear_tag,
        asi.alias as adoptive_sow_alias
      FROM piglets p
      LEFT JOIN sows s ON p.sow_id = s.id
      LEFT JOIN boars bo ON p.sire_id = bo.id
      LEFT JOIN births b ON p.birth_id = b.id
      LEFT JOIN sows asi ON p.adoptive_sow_id = asi.id
      WHERE p.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  // Obtener lechón por ear_tag (arete)
  getByEarTag: async (ear_tag) => {
    const result = await pool.query(
      `SELECT 
        p.*,
        s.ear_tag as sow_ear_tag,
        s.alias as sow_alias,
        bo.ear_tag as sire_ear_tag,
        bo.name as sire_name,
        b.birth_date
      FROM piglets p
      LEFT JOIN sows s ON p.sow_id = s.id
      LEFT JOIN boars bo ON p.sire_id = bo.id
      LEFT JOIN births b ON p.birth_id = b.id
      WHERE p.ear_tag = $1`,
      [ear_tag]
    );
    return result.rows[0];
  },

  // Obtener lechones de un parto específico
  getByBirthId: async (birthId) => {
    const result = await pool.query(
      `SELECT 
        p.*,
        s.ear_tag as sow_ear_tag,
        s.alias as sow_alias,
        bo.ear_tag as sire_ear_tag,
        bo.name as sire_name,
        asi.ear_tag as adoptive_sow_ear_tag,
        asi.alias as adoptive_sow_alias
      FROM piglets p
      LEFT JOIN sows s ON p.sow_id = s.id
      LEFT JOIN boars bo ON p.sire_id = bo.id
      LEFT JOIN sows asi ON p.adoptive_sow_id = asi.id
      WHERE p.birth_id = $1
      ORDER BY p.birth_order ASC`,
      [birthId]
    );
    return result.rows;
  },

  // Obtener lechones de una cerda específica
  getBySowId: async (sowId) => {
    const result = await pool.query(
      `SELECT 
        p.*,
        bo.ear_tag as sire_ear_tag,
        bo.name as sire_name,
        b.birth_date,
        b.birth_type
      FROM piglets p
      LEFT JOIN boars bo ON p.sire_id = bo.id
      LEFT JOIN births b ON p.birth_id = b.id
      WHERE p.sow_id = $1
      ORDER BY b.birth_date DESC, p.birth_order ASC`,
      [sowId]
    );
    return result.rows;
  },

  // Crear un nuevo lechón
  create: async (pigletData) => {
    const {
      birth_id, sow_id, sire_id, ear_tag, temporary_id,
      birth_order, sex, birth_weight, current_weight, birth_status, current_status,
      adoptive_sow_id, adoption_date, adoption_reason,
      weaning_date, weaning_weight, weaning_age_days,
      death_date, death_age_days, death_cause,
      special_care, notes, created_by
    } = pigletData;

    const result = await pool.query(
      `INSERT INTO piglets (
        birth_id, sow_id, sire_id, ear_tag, temporary_id,
        birth_order, sex, birth_weight, current_weight, birth_status, current_status,
        adoptive_sow_id, adoption_date, adoption_reason,
        weaning_date, weaning_weight, weaning_age_days,
        death_date, death_age_days, death_cause,
        special_care, notes, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
        $18, $19, $20, $21, $22, $23
      ) RETURNING *`,
      [
        birth_id, sow_id, sire_id, ear_tag || null, temporary_id || null,
        birth_order || null, sex, birth_weight || null, current_weight || null,
        birth_status || 'vivo', current_status || 'lactante',
        adoptive_sow_id || null, adoption_date || null, adoption_reason || null,
        weaning_date || null, weaning_weight || null, weaning_age_days || null,
        death_date || null, death_age_days || null, death_cause || null,
        special_care || false, notes || null, created_by || null
      ]
    );
    
    return result.rows[0];
  },

  // Actualizar un lechón
  update: async (id, pigletData) => {
    const {
      ear_tag, temporary_id, birth_order, sex, birth_weight, current_weight, birth_status, 
      current_status, adoptive_sow_id, adoption_date, adoption_reason,
      weaning_date, weaning_weight, weaning_age_days,
      death_date, death_age_days, death_cause,
      special_care, notes, updated_by
    } = pigletData;

    const result = await pool.query(
      `UPDATE piglets SET
        ear_tag = $1, temporary_id = $2, birth_order = $3, sex = $4,
        birth_weight = $5, current_weight = $6, birth_status = $7, current_status = $8,
        adoptive_sow_id = $9, adoption_date = $10, adoption_reason = $11,
        weaning_date = $12, weaning_weight = $13, weaning_age_days = $14,
        death_date = $15, death_age_days = $16, death_cause = $17,
        special_care = $18, notes = $19, updated_at = NOW(), updated_by = $20
      WHERE id = $21 RETURNING *`,
      [
        ear_tag, temporary_id, birth_order, sex, birth_weight, current_weight, birth_status,
        current_status, adoptive_sow_id, adoption_date, adoption_reason,
        weaning_date, weaning_weight, weaning_age_days,
        death_date, death_age_days, death_cause,
        special_care, notes, updated_by, id
      ]
    );
    
    return result.rows[0];
  },

  // Actualización parcial
  partialUpdate: async (id, pigletData) => {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(pigletData).forEach(key => {
      if (pigletData[key] !== undefined && key !== 'id') {
        fields.push(`${key} = $${paramCount}`);
        values.push(pigletData[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      throw new Error('No hay campos para actualizar');
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `UPDATE piglets SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await pool.query(query, values);
    
    return result.rows[0];
  },

  // Soft delete (marcar como muerto o vendido)
  softDelete: async (id, reason = 'vendido') => {
    const result = await pool.query(
      `UPDATE piglets SET 
        current_status = $1,
        updated_at = NOW()
      WHERE id = $2 RETURNING *`,
      [reason, id]
    );
    return result.rows[0];
  },

  // Delete permanente (solo admin)
  delete: async (id) => {
    const result = await pool.query('DELETE FROM piglets WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  },

  // Estadísticas de lechones
  getStats: async (filters = {}) => {
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (filters.birth_id) {
      whereClause += ` AND p.birth_id = $${paramCount}`;
      params.push(filters.birth_id);
      paramCount++;
    }

    if (filters.sow_id) {
      whereClause += ` AND p.sow_id = $${paramCount}`;
      params.push(filters.sow_id);
      paramCount++;
    }

    const result = await pool.query(`
      SELECT
        COUNT(*) as total_piglets,
        COUNT(*) FILTER (WHERE p.birth_status = 'vivo') as born_alive,
        COUNT(*) FILTER (WHERE p.birth_status = 'muerto') as born_dead,
        COUNT(*) FILTER (WHERE p.birth_status = 'momificado') as mummified,
        COUNT(*) FILTER (WHERE p.sex = 'macho') as males,
        COUNT(*) FILTER (WHERE p.sex = 'hembra') as females,
        COUNT(*) FILTER (WHERE p.current_status = 'lactante') as lactating,
        COUNT(*) FILTER (WHERE p.current_status = 'destetado') as weaned,
        COUNT(*) FILTER (WHERE p.current_status = 'vendido') as sold,
        COUNT(*) FILTER (WHERE p.current_status = 'muerto') as died,
        COUNT(*) FILTER (WHERE p.adoptive_sow_id IS NOT NULL) as adopted,
        AVG(p.birth_weight) as avg_birth_weight,
        AVG(p.weaning_weight) as avg_weaning_weight,
        AVG(p.weaning_age_days) as avg_weaning_age
      FROM piglets p
      ${whereClause}
    `, params);
    
    return result.rows[0];
  },

  // Obtener lechones para destete (lactantes mayores a X días)
  getReadyForWeaning: async (minDays = 21) => {
    const result = await pool.query(
      `SELECT 
        p.*,
        s.ear_tag as sow_ear_tag,
        s.alias as sow_alias,
        b.birth_date,
        CURRENT_DATE - b.birth_date as days_old
      FROM piglets p
      INNER JOIN sows s ON p.sow_id = s.id
      INNER JOIN births b ON p.birth_id = b.id
      WHERE p.current_status = 'lactante'
        AND p.birth_status = 'vivo'
        AND CURRENT_DATE - b.birth_date >= $1
      ORDER BY b.birth_date ASC`,
      [minDays]
    );
    return result.rows;
  }
};

module.exports = pigletModel;

