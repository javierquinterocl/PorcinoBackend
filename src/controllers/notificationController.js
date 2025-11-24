const notificationModel = require('../models/notificationModel');

const notificationController = {
  /**
   * GET /api/notifications
   * Obtener todas las notificaciones del usuario autenticado
   */
  getAll: async (req, res) => {
    try {
      const userId = req.user.id;
      const { is_read, type, limit, offset } = req.query;

      const filters = {};
      if (is_read !== undefined) filters.is_read = is_read === 'true';
      if (type) filters.type = type;
      if (limit) filters.limit = parseInt(limit);
      if (offset) filters.offset = parseInt(offset);

      const notifications = await notificationModel.getByUserId(userId, filters);

      res.json({
        success: true,
        data: notifications
      });
    } catch (error) {
      console.error('Error al obtener notificaciones:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener notificaciones',
        error: error.message
      });
    }
  },

  /**
   * GET /api/notifications/unread
   * Obtener notificaciones no leídas
   */
  getUnread: async (req, res) => {
    try {
      const userId = req.user.id;
      const notifications = await notificationModel.getUnreadByUserId(userId);

      res.json({
        success: true,
        data: notifications
      });
    } catch (error) {
      console.error('Error al obtener notificaciones no leídas:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener notificaciones no leídas',
        error: error.message
      });
    }
  },

  /**
   * GET /api/notifications/count
   * Obtener contador de notificaciones no leídas
   */
  getUnreadCount: async (req, res) => {
    try {
      const userId = req.user.id;
      const count = await notificationModel.countUnreadByUserId(userId);

      res.json({
        success: true,
        data: { count }
      });
    } catch (error) {
      console.error('Error al contar notificaciones:', error);
      res.status(500).json({
        success: false,
        message: 'Error al contar notificaciones',
        error: error.message
      });
    }
  },

  /**
   * GET /api/notifications/:id
   * Obtener una notificación específica
   */
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const notification = await notificationModel.getById(id);

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notificación no encontrada'
        });
      }

      // Verificar que la notificación pertenece al usuario
      if (notification.user_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para ver esta notificación'
        });
      }

      res.json({
        success: true,
        data: notification
      });
    } catch (error) {
      console.error('Error al obtener notificación:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener notificación',
        error: error.message
      });
    }
  },

  /**
   * POST /api/notifications
   * Crear una nueva notificación (solo admin o sistema)
   */
  create: async (req, res) => {
    try {
      const notificationData = req.body;

      // Si no se especifica user_id, usar el del usuario autenticado
      if (!notificationData.user_id) {
        notificationData.user_id = req.user.id;
      }

      const notification = await notificationModel.create(notificationData);

      res.status(201).json({
        success: true,
        message: 'Notificación creada exitosamente',
        data: notification
      });
    } catch (error) {
      console.error('Error al crear notificación:', error);
      res.status(500).json({
        success: false,
        message: 'Error al crear notificación',
        error: error.message
      });
    }
  },

  /**
   * PUT /api/notifications/:id/read
   * Marcar notificación como leída
   */
  markAsRead: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const notification = await notificationModel.markAsRead(id, userId);

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notificación no encontrada'
        });
      }

      res.json({
        success: true,
        message: 'Notificación marcada como leída',
        data: notification
      });
    } catch (error) {
      console.error('Error al marcar notificación como leída:', error);
      res.status(500).json({
        success: false,
        message: 'Error al marcar notificación como leída',
        error: error.message
      });
    }
  },

  /**
   * PUT /api/notifications/read-all
   * Marcar todas las notificaciones como leídas
   */
  markAllAsRead: async (req, res) => {
    try {
      const userId = req.user.id;
      const notifications = await notificationModel.markAllAsRead(userId);

      res.json({
        success: true,
        message: `${notifications.length} notificaciones marcadas como leídas`,
        data: notifications
      });
    } catch (error) {
      console.error('Error al marcar todas como leídas:', error);
      res.status(500).json({
        success: false,
        message: 'Error al marcar todas como leídas',
        error: error.message
      });
    }
  },

  /**
   * DELETE /api/notifications/:id
   * Eliminar una notificación
   */
  delete: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const notification = await notificationModel.delete(id, userId);

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notificación no encontrada'
        });
      }

      res.json({
        success: true,
        message: 'Notificación eliminada exitosamente',
        data: notification
      });
    } catch (error) {
      console.error('Error al eliminar notificación:', error);
      res.status(500).json({
        success: false,
        message: 'Error al eliminar notificación',
        error: error.message
      });
    }
  },

  /**
   * DELETE /api/notifications
   * Eliminar todas las notificaciones del usuario
   */
  deleteAll: async (req, res) => {
    try {
      const userId = req.user.id;
      const notifications = await notificationModel.deleteAllByUserId(userId);

      res.json({
        success: true,
        message: `${notifications.length} notificaciones eliminadas`,
        data: notifications
      });
    } catch (error) {
      console.error('Error al eliminar notificaciones:', error);
      res.status(500).json({
        success: false,
        message: 'Error al eliminar notificaciones',
        error: error.message
      });
    }
  }
};

module.exports = notificationController;

