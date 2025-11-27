const pool = require('../config/db');

const sowModel = {
  // Obtener todas las cerdas con filtros opcionales
  getAll: async (filters = {}) => {
    let query = 'SELECT * FROM sows WHERE 1=1';
    const params = [];
    let paramCount = 1;

    // Filtros opcionales
    if (filters.status) {
      query += ` AND status = $${paramCount}`;
      params.push(filters.status);
      paramCount++;
    }

    if (filters.breed) {
      query += ` AND breed = $${paramCount}`;
      params.push(filters.breed);
      paramCount++;
    }

    if (filters.reproductive_status) {
      query += ` AND reproductive_status = $${paramCount}`;
      params.push(filters.reproductive_status);
      paramCount++;
    }

    if (filters.farm_name) {
      query += ` AND farm_name ILIKE $${paramCount}`;
      params.push(`%${filters.farm_name}%`);
      paramCount++;
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    return result.rows;
  },

  // Obtener una cerda por ID
  getById: async (id) => {
    const result = await pool.query('SELECT * FROM sows WHERE id = $1', [id]);
    return result.rows[0];
  },

  // Obtener cerda por ear_tag (arete)
  getByEarTag: async (ear_tag) => {
    const result = await pool.query('SELECT * FROM sows WHERE ear_tag = $1', [ear_tag]);
    return result.rows[0];
  },

  // Crear una nueva cerda
  create: async (sowData) => {
    const {
      ear_tag, id_type, alias, breed, genetic_line, generation, sire_tag, dam_tag,
      birth_date, entry_date, origin, status, location, farm_name,
      current_weight, min_service_weight, body_condition, last_weight_date,
      parity_count, total_piglets_born, total_piglets_alive, total_piglets_dead,
      total_abortions, avg_piglets_alive, reproductive_status,
      last_service_date, last_parturition_date, expected_farrowing_date,
      last_weaning_date, photo_url, created_by
    } = sowData;

    const result = await pool.query(
      `INSERT INTO sows (
        ear_tag, id_type, alias, breed, genetic_line, generation, sire_tag, dam_tag,
        birth_date, entry_date, origin, status, location, farm_name,
        current_weight, min_service_weight, body_condition, last_weight_date,
        parity_count, total_piglets_born, total_piglets_alive, total_piglets_dead,
        total_abortions, avg_piglets_alive, reproductive_status,
        last_service_date, last_parturition_date, expected_farrowing_date,
        last_weaning_date, photo_url, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31
      ) RETURNING *`,
      [
        ear_tag, id_type, alias, breed, genetic_line, generation, sire_tag, dam_tag,
        birth_date, entry_date, origin || 'propia', status || 'activa', location, farm_name,
        current_weight, min_service_weight || 120.00, body_condition, last_weight_date,
        parity_count || 0, total_piglets_born || 0, total_piglets_alive || 0,
        total_piglets_dead || 0, total_abortions || 0, avg_piglets_alive,
        reproductive_status || 'vacia', last_service_date, last_parturition_date,
        expected_farrowing_date, last_weaning_date, photo_url, created_by
      ]
    );
    
    return result.rows[0];
  },

  // Actualizar una cerda
  update: async (id, sowData) => {
    const {
      ear_tag, id_type, alias, breed, genetic_line, generation, sire_tag, dam_tag,
      birth_date, entry_date, origin, status, location, farm_name,
      current_weight, min_service_weight, body_condition, last_weight_date,
      parity_count, total_piglets_born, total_piglets_alive, total_piglets_dead,
      total_abortions, avg_piglets_alive, reproductive_status,
      last_service_date, last_parturition_date, expected_farrowing_date,
      last_weaning_date, photo_url, updated_by
    } = sowData;

    const result = await pool.query(
      `UPDATE sows SET
        ear_tag = $1, id_type = $2, alias = $3, breed = $4, genetic_line = $5,
        generation = $6, sire_tag = $7, dam_tag = $8, birth_date = $9, entry_date = $10,
        origin = $11, status = $12, location = $13, farm_name = $14,
        current_weight = $15, min_service_weight = $16, body_condition = $17,
        last_weight_date = $18, parity_count = $19, total_piglets_born = $20,
        total_piglets_alive = $21, total_piglets_dead = $22, total_abortions = $23,
        avg_piglets_alive = $24, reproductive_status = $25, last_service_date = $26,
        last_parturition_date = $27, expected_farrowing_date = $28,
        last_weaning_date = $29, photo_url = $30, updated_by = $31, updated_at = NOW()
      WHERE id = $32 RETURNING *`,
      [
        ear_tag, id_type, alias, breed, genetic_line, generation, sire_tag, dam_tag,
        birth_date, entry_date, origin, status, location, farm_name,
        current_weight, min_service_weight, body_condition, last_weight_date,
        parity_count, total_piglets_born, total_piglets_alive, total_piglets_dead,
        total_abortions, avg_piglets_alive, reproductive_status, last_service_date,
        last_parturition_date, expected_farrowing_date, last_weaning_date,
        photo_url, updated_by, id
      ]
    );
    
    return result.rows[0];
  },

  // Actualización parcial (solo campos específicos)
  partialUpdate: async (id, sowData) => {
    const fields = [];
    const values = [];
    let paramCount = 1;

    // Construir query dinámicamente solo con campos presentes
    Object.keys(sowData).forEach(key => {
      if (sowData[key] !== undefined && key !== 'id') {
        fields.push(`${key} = $${paramCount}`);
        values.push(sowData[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      throw new Error('No hay campos para actualizar');
    }

    fields.push('updated_at = NOW()');
    values.push(id);

    const query = `UPDATE sows SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await pool.query(query, values);
    
    return result.rows[0];
  },

  // Eliminar una cerda (soft delete - cambiar status)
  softDelete: async (id) => {
    const result = await pool.query(
      'UPDATE sows SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      ['descartada', id]
    );
    return result.rows[0];
  },

  // Eliminar permanentemente
  delete: async (id) => {
    const result = await pool.query('DELETE FROM sows WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  },

  // Estadísticas generales
  getStats: async () => {
    const result = await pool.query(`
      SELECT
        COUNT(*) as total_cerdas,
        COUNT(*) FILTER (WHERE status = 'activa') as activas,
        COUNT(*) FILTER (WHERE status = 'gestante') as gestantes,
        COUNT(*) FILTER (WHERE reproductive_status = 'lactante') as lactantes,
        COUNT(*) FILTER (WHERE reproductive_status = 'vacia') as vacias,
        AVG(current_weight) as peso_promedio,
        AVG(body_condition) as condicion_corporal_promedio,
        SUM(total_piglets_born) as total_lechones_nacidos,
        SUM(total_piglets_alive) as total_lechones_vivos
      FROM sows
      WHERE status = 'activa'
    `);
    
    return result.rows[0];
  }
};

module.exports = sowModel;
