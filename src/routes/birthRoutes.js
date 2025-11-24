const express = require('express');
const router = express.Router();
const birthController = require('../controllers/birthController');
const { authMiddleware } = require('../middleware/authMiddleware');

// Todas las rutas de partos requieren autenticación
router.use(authMiddleware);

// Rutas públicas para usuarios autenticados
router.get('/', birthController.getAll);
router.get('/stats', birthController.getStats);
router.get('/recent', birthController.getRecent);
router.get('/problematic', birthController.getProblematic);
router.get('/sow/:sowId', birthController.getBySowId);
router.get('/sow/:sowId/last', birthController.getLastBySowId);
router.get('/:id', birthController.getById);

// Rutas de creación y edición
router.post('/', birthController.create);
router.put('/:id', birthController.update);
router.patch('/:id', birthController.partialUpdate);

// Ruta de eliminación
router.delete('/:id', birthController.delete);

// Rutas de destete
router.post('/:id/wean', birthController.weanLitter);
router.post('/process-weaning', birthController.processAllWeaning);

module.exports = router;
