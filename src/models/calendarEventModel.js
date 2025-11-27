const pool = require('../config/db');

const calendarEventModel = {
  // Obtener todos los eventos
  getAll: async (filters = {}) => {
    try {
      let query = `
        SELECT 
          ce.*,
          s.ear_tag as sow_ear_tag,
          s.alias as sow_alias
        FROM calendar_events ce
        LEFT JOIN sows s ON ce.sow_id = s.id
        WHERE 1=1
      `;
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

      console.log('📅 [calendarEventModel.getAll] Ejecutando query:', query);
      console.log('📅 [calendarEventModel.getAll] Parámetros:', params);
      
      const result = await pool.query(query, params);
      console.log(`📅 [calendarEventModel.getAll] Eventos encontrados: ${result.rows.length}`);
      return result.rows;
    } catch (error) {
      console.error('❌ [calendarEventModel.getAll] Error:', error.message);
      throw error;
    }
  },

  // Obtener un evento por ID
  getById: async (id) => {
    try {
      console.log(`📅 [calendarEventModel.getById] Consultando evento ID: ${id}`);
      const result = await pool.query('SELECT * FROM calendar_events WHERE id = $1', [id]);
      console.log(`📅 [calendarEventModel.getById] Evento ${result.rows.length > 0 ? 'encontrado' : 'no encontrado'}`);
      return result.rows[0];
    } catch (error) {
      console.error('❌ [calendarEventModel.getById] Error:', error.message);
      throw error;
    }
  },

  // Obtener eventos de un mes específico
  getByMonth: async (year, month) => {
    try {
      console.log(`📅 [calendarEventModel.getByMonth] Consultando año: ${year}, mes: ${month}`);
      const result = await pool.query(
        `SELECT 
          ce.*,
          s.ear_tag as sow_ear_tag,
          s.alias as sow_alias
        FROM calendar_events ce
        LEFT JOIN sows s ON ce.sow_id = s.id
        WHERE EXTRACT(YEAR FROM event_date) = $1 
        AND EXTRACT(MONTH FROM event_date) = $2
        ORDER BY event_date ASC`,
        [year, month]
      );
      console.log(`📅 [calendarEventModel.getByMonth] Eventos encontrados: ${result.rows.length}`);
      return result.rows;
    } catch (error) {
      console.error('❌ [calendarEventModel.getByMonth] Error:', error.message);
      throw error;
    }
  },

  // Crear un nuevo evento
  create: async (eventData) => {
    try {
      const {
        title, event_date, event_type, description, notes,
        status, reminder_days, created_by
      } = eventData;

      console.log('📅 [calendarEventModel.create] Creando evento:', { title, event_date, event_type });

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
      
      console.log('✅ [calendarEventModel.create] Evento creado con ID:', result.rows[0].id);
      return result.rows[0];
    } catch (error) {
      console.error('❌ [calendarEventModel.create] Error:', error.message);
      console.error('   Datos recibidos:', eventData);
      throw error;
    }
  },

  // Actualizar un evento
  update: async (id, eventData) => {
    try {
      const {
        title, event_date, event_type, description, notes,
        status, reminder_days, updated_by
      } = eventData;

      console.log(`📅 [calendarEventModel.update] Actualizando evento ID: ${id}`);

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
      
      if (result.rows.length === 0) {
        throw new Error(`Evento con ID ${id} no encontrado`);
      }

      console.log('✅ [calendarEventModel.update] Evento actualizado');
      return result.rows[0];
    } catch (error) {
      console.error('❌ [calendarEventModel.update] Error:', error.message);
      throw error;
    }
  },

  // Eliminar un evento
  delete: async (id) => {
    try {
      console.log(`📅 [calendarEventModel.delete] Eliminando evento ID: ${id}`);
      const result = await pool.query('DELETE FROM calendar_events WHERE id = $1 RETURNING *', [id]);
      
      if (result.rows.length === 0) {
        throw new Error(`Evento con ID ${id} no encontrado`);
      }

      console.log('✅ [calendarEventModel.delete] Evento eliminado');
      return result.rows[0];
    } catch (error) {
      console.error('❌ [calendarEventModel.delete] Error:', error.message);
      throw error;
    }
  },

  // Obtener eventos próximos (próximos N días)
  getUpcoming: async (days = 7) => {
    try {
      console.log(`📅 [calendarEventModel.getUpcoming] Consultando próximos ${days} días`);
      const result = await pool.query(
        `SELECT * FROM calendar_events 
         WHERE event_date >= CURRENT_DATE 
         AND event_date <= CURRENT_DATE + $1 * INTERVAL '1 day'
         AND status = 'pending'
         ORDER BY event_date ASC`,
        [days]
      );
      console.log(`📅 [calendarEventModel.getUpcoming] Eventos encontrados: ${result.rows.length}`);
      return result.rows;
    } catch (error) {
      console.error('❌ [calendarEventModel.getUpcoming] Error:', error.message);
      throw error;
    }
  }
};

module.exports = calendarEventModel;

