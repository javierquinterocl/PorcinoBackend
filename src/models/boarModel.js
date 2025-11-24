const pool = require('../config/db');

const boarModel = {
  // Obtener todos los verracos con filtros opcionales
  getAll: async (filters = {}) => {
    let query = 'SELECT * FROM boars WHERE 1=1';
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

    if (filters.boar_type) {
      query += ` AND boar_type = $${paramCount}`;
      params.push(filters.boar_type);
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

  // Obtener un verraco por ID
  getById: async (id) => {
    const result = await pool.query('SELECT * FROM boars WHERE id = $1', [id]);
    return result.rows[0];
  },

  // Obtener verraco por ear_tag (arete)
  getByEarTag: async (ear_tag) => {
    const result = await pool.query('SELECT * FROM boars WHERE ear_tag = $1', [ear_tag]);
    return result.rows[0];
  },

  // Crear un nuevo verraco
  create: async (boarData) => {
    const {
      ear_tag, id_type, name, breed, genetic_line, generation,
      sire_ear_tag, dam_ear_tag, birth_date, entry_date, origin,
      boar_type, status, location, farm_name, current_weight,
      total_services, last_service_date, supplier_name, supplier_code,
      notes, photo_url, created_by
    } = boarData;

    const result = await pool.query(
      `INSERT INTO boars (
        ear_tag, id_type, name, breed, genetic_line, generation,
        sire_ear_tag, dam_ear_tag, birth_date, entry_date, origin,
        boar_type, status, location, farm_name, current_weight,
        total_services, last_service_date, supplier_name, supplier_code,
        notes, photo_url, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23
      ) RETURNING *`,
      [
        ear_tag, id_type, name, breed, genetic_line, generation,
        sire_ear_tag, dam_ear_tag, birth_date, entry_date, origin || 'propio',
        boar_type || 'fisico', status || 'activo', location, farm_name,
        current_weight, total_services || 0, last_service_date,
        supplier_name, supplier_code, notes, photo_url, created_by
      ]
    );
    
    return result.rows[0];
  },

  // Actualizar un verraco
  update: async (id, boarData) => {
    const {
      ear_tag, id_type, name, breed, genetic_line, generation,
      sire_ear_tag, dam_ear_tag, birth_date, entry_date, origin,
      boar_type, status, location, farm_name, current_weight,
      total_services, last_service_date, supplier_name, supplier_code,
      notes, photo_url, updated_by
    } = boarData;

    const result = await pool.query(
      `UPDATE boars SET
        ear_tag = $1, id_type = $2, name = $3, breed = $4, genetic_line = $5,
        generation = $6, sire_ear_tag = $7, dam_ear_tag = $8, birth_date = $9,
        entry_date = $10, origin = $11, boar_type = $12, status = $13,
        location = $14, farm_name = $15, current_weight = $16, total_services = $17,
        last_service_date = $18, supplier_name = $19, supplier_code = $20,
        notes = $21, photo_url = $22, updated_by = $23, updated_at = NOW()
      WHERE id = $24 RETURNING *`,
      [
        ear_tag, id_type, name, breed, genetic_line, generation,
        sire_ear_tag, dam_ear_tag, birth_date, entry_date, origin,
        boar_type, status, location, farm_name, current_weight,
        total_services, last_service_date, supplier_name, supplier_code,
        notes, photo_url, updated_by, id
      ]
    );
    
    return result.rows[0];
  },

  // Actualización parcial (solo campos específicos)
  partialUpdate: async (id, boarData) => {
    const fields = [];
    const values = [];
    let paramCount = 1;

    // Construir query dinámicamente solo con campos presentes
    Object.keys(boarData).forEach(key => {
      if (boarData[key] !== undefined && key !== 'id') {
        fields.push(`${key} = $${paramCount}`);
        values.push(boarData[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      throw new Error('No hay campos para actualizar');
    }

    fields.push('updated_at = NOW()');
    values.push(id);

    const query = `UPDATE boars SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await pool.query(query, values);
    
    return result.rows[0];
  },

  // Eliminar un verraco (soft delete - cambiar status)
  softDelete: async (id) => {
    const result = await pool.query(
      'UPDATE boars SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      ['descartado', id]
    );
    return result.rows[0];
  },

  // Eliminar permanentemente
  delete: async (id) => {
    const result = await pool.query('DELETE FROM boars WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  },

  // Estadísticas generales
  getStats: async () => {
    const result = await pool.query(`
      SELECT
        COUNT(*) as total_verracos,
        COUNT(*) FILTER (WHERE status = 'activo' AND boar_type = 'fisico') as activos_fisicos,
        COUNT(*) FILTER (WHERE boar_type = 'semen comprado') as semen_comprado,
        COUNT(*) FILTER (WHERE status = 'descanso') as en_descanso,
        AVG(current_weight) FILTER (WHERE boar_type = 'fisico' AND status = 'activo') as peso_promedio,
        SUM(total_services) as total_servicios_realizados
      FROM boars
      WHERE status != 'descartado'
    `);
    
    return result.rows[0];
  }
};

module.exports = boarModel;
