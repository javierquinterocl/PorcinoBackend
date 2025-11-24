const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { notificationJob } = require('../jobs/notificationJob');

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Rutas de notificaciones
router.get('/', notificationController.getAll);
router.get('/unread', notificationController.getUnread);
router.get('/count', notificationController.getUnreadCount);
router.get('/:id', notificationController.getById);
router.post('/', notificationController.create);
router.put('/:id/read', notificationController.markAsRead);
router.put('/read-all', notificationController.markAllAsRead);
router.delete('/:id', notificationController.delete);
router.delete('/', notificationController.deleteAll);

// Endpoint temporal para generar notificaciones manualmente (DESARROLLO)
router.post('/generate', async (req, res) => {
  try {
    console.log('🔄 Generación manual de notificaciones solicitada...');
    await notificationJob.runAll();
    res.json({
      success: true,
      message: 'Notificaciones generadas exitosamente. Revisa la consola del servidor.'
    });
  } catch (error) {
    console.error('Error generando notificaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error generando notificaciones',
      error: error.message
    });
  }
});

module.exports = router;

