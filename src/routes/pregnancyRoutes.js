const express = require('express');
const router = express.Router();
const pregnancyController = require('../controllers/pregnancyController');
const { authMiddleware } = require('../middleware/authMiddleware');

// Todas las rutas de gestaciones requieren autenticación
router.use(authMiddleware);

// Rutas de consulta
router.get('/', pregnancyController.getAll);
router.get('/stats', pregnancyController.getStats);
router.get('/upcoming', pregnancyController.getUpcoming);
router.get('/overdue', pregnancyController.getOverdue);
router.get('/pending-confirmation', pregnancyController.getPendingConfirmation);
router.get('/sow/:sowId', pregnancyController.getBySowId);
router.get('/sow/:sowId/active', pregnancyController.getActiveBySowId);
router.get('/:id', pregnancyController.getById);

// Rutas de creación y edición
router.post('/', pregnancyController.create);
router.put('/:id', pregnancyController.update);
router.patch('/:id', pregnancyController.partialUpdate);
router.patch('/:id/status', pregnancyController.updateStatus);
router.patch('/:id/confirm', pregnancyController.confirmPregnancy);

// Ruta de eliminación
router.delete('/:id', pregnancyController.delete);

module.exports = router;
