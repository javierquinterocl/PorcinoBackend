const express = require('express');
const router = express.Router();
const abortionController = require('../controllers/abortionController');
const { authMiddleware } = require('../middleware/authMiddleware');

// Todas las rutas de abortos requieren autenticación
router.use(authMiddleware);

// Rutas públicas para usuarios autenticados
router.get('/', abortionController.getAll);
router.get('/stats', abortionController.getStats);
router.get('/recent', abortionController.getRecent);
router.get('/critical', abortionController.getCritical);
router.get('/sow/:sowId', abortionController.getBySowId);
router.get('/sow/:sowId/last', abortionController.getLastBySowId);
router.get('/:id', abortionController.getById);

// Rutas de creación y edición
router.post('/', abortionController.create);
router.put('/:id', abortionController.update);
router.patch('/:id', abortionController.partialUpdate);

// Ruta de eliminación
router.delete('/:id', abortionController.delete);

module.exports = router;

