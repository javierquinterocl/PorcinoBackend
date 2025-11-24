const pool = require('../config/db');

const notificationModel = {
  /**
   * Crear una nueva notificación
   */
  create: async (notificationData) => {
    const { 
      user_id, 
      title, 
      message, 
      type, 
      priority = 'normal',
      reference_type = null,
      reference_id = null,
      action_url = null,
      expires_at = null
    } = notificationData;

    const result = await pool.query(
      `INSERT INTO notifications 
       (user_id, title, message, type, priority, reference_type, reference_id, action_url, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [user_id, title, message, type, priority, reference_type, reference_id, action_url, expires_at]
    );

    return result.rows[0];
  },

  /**
   * Crear notificaciones para múltiples usuarios
   */
  createBulk: async (notifications) => {
    const values = [];
    const placeholders = [];
    
    notifications.forEach((notif, index) => {
      const baseIndex = index * 9;
      placeholders.push(
        `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, 
          $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8}, $${baseIndex + 9})`
      );
      values.push(
        notif.user_id,
        notif.title,
        notif.message,
        notif.type,
        notif.priority || 'normal',
        notif.reference_type || null,
        notif.reference_id || null,
        notif.action_url || null,
        notif.expires_at || null
      );
    });

    if (placeholders.length === 0) return [];

    const result = await pool.query(
      `INSERT INTO notifications 
       (user_id, title, message, type, priority, reference_type, reference_id, action_url, expires_at)
       VALUES ${placeholders.join(', ')}
       RETURNING *`,
      values
    );

    return result.rows;
  },

  /**
   * Obtener todas las notificaciones de un usuario
   */
  getByUserId: async (userId, filters = {}) => {
    const { is_read, type, limit = 50, offset = 0 } = filters;
    
    let query = 'SELECT * FROM notifications WHERE user_id = $1';
    const params = [userId];
    let paramIndex = 2;

    // Filtrar por estado de lectura
    if (is_read !== undefined) {
      query += ` AND is_read = $${paramIndex}`;
      params.push(is_read);
      paramIndex++;
    }

    // Filtrar por tipo
    if (type) {
      query += ` AND type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    // Excluir notificaciones expiradas
    query += ' AND (expires_at IS NULL OR expires_at > NOW())';

    // Ordenar por fecha de creación (más recientes primero)
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  },

  /**
   * Obtener notificaciones no leídas de un usuario
   */
  getUnreadByUserId: async (userId) => {
    const result = await pool.query(
      `SELECT * FROM notifications 
       WHERE user_id = $1 
         AND is_read = FALSE 
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  },

  /**
   * Contar notificaciones no leídas
   */
  countUnreadByUserId: async (userId) => {
    const result = await pool.query(
      `SELECT COUNT(*) as count 
       FROM notifications 
       WHERE user_id = $1 
         AND is_read = FALSE 
         AND (expires_at IS NULL OR expires_at > NOW())`,
      [userId]
    );
    return parseInt(result.rows[0].count);
  },

  /**
   * Obtener una notificación por ID
   */
  getById: async (id) => {
    const result = await pool.query(
      'SELECT * FROM notifications WHERE id = $1',
      [id]
    );
    return result.rows[0];
  },

  /**
   * Marcar notificación como leída
   */
  markAsRead: async (id, userId) => {
    const result = await pool.query(
      `UPDATE notifications 
       SET is_read = TRUE, read_at = NOW() 
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId]
    );
    return result.rows[0];
  },

  /**
   * Marcar todas las notificaciones como leídas
   */
  markAllAsRead: async (userId) => {
    const result = await pool.query(
      `UPDATE notifications 
       SET is_read = TRUE, read_at = NOW() 
       WHERE user_id = $1 AND is_read = FALSE
       RETURNING *`,
      [userId]
    );
    return result.rows;
  },

  /**
   * Marcar notificaciones por tipo como leídas
   */
  markTypeAsRead: async (userId, type) => {
    const result = await pool.query(
      `UPDATE notifications 
       SET is_read = TRUE, read_at = NOW() 
       WHERE user_id = $1 AND type = $2 AND is_read = FALSE
       RETURNING *`,
      [userId, type]
    );
    return result.rows;
  },

  /**
   * Eliminar una notificación
   */
  delete: async (id, userId) => {
    const result = await pool.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );
    return result.rows[0];
  },

  /**
   * Eliminar todas las notificaciones de un usuario
   */
  deleteAllByUserId: async (userId) => {
    const result = await pool.query(
      'DELETE FROM notifications WHERE user_id = $1 RETURNING *',
      [userId]
    );
    return result.rows;
  },

  /**
   * Eliminar notificaciones leídas antiguas (limpieza)
   */
  deleteOldRead: async (daysOld = 30) => {
    const result = await pool.query(
      `DELETE FROM notifications 
       WHERE is_read = TRUE 
         AND read_at < NOW() - INTERVAL '${daysOld} days'
       RETURNING id`,
    );
    return result.rowCount;
  },

  /**
   * Eliminar notificaciones expiradas
   */
  deleteExpired: async () => {
    const result = await pool.query(
      `DELETE FROM notifications 
       WHERE expires_at IS NOT NULL AND expires_at < NOW()
       RETURNING id`
    );
    return result.rowCount;
  },

  /**
   * Obtener notificaciones por referencia
   */
  getByReference: async (referenceType, referenceId) => {
    const result = await pool.query(
      'SELECT * FROM notifications WHERE reference_type = $1 AND reference_id = $2',
      [referenceType, referenceId]
    );
    return result.rows;
  },

  /**
   * Eliminar notificaciones por referencia
   */
  deleteByReference: async (referenceType, referenceId) => {
    const result = await pool.query(
      'DELETE FROM notifications WHERE reference_type = $1 AND reference_id = $2 RETURNING *',
      [referenceType, referenceId]
    );
    return result.rows;
  }
};

module.exports = notificationModel;

