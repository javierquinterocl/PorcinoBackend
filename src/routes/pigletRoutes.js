const express = require('express');
const router = express.Router();
const pigletController = require('../controllers/pigletController');
const { authMiddleware } = require('../middleware/authMiddleware');

// Todas las rutas de lechones requieren autenticación
router.use(authMiddleware);

// Rutas públicas para usuarios autenticados
router.get('/', pigletController.getAll);
router.get('/stats', pigletController.getStats);
router.get('/ready-weaning', pigletController.getReadyForWeaning);
router.get('/birth/:birthId', pigletController.getByBirthId);
router.get('/sow/:sowId', pigletController.getBySowId);
router.get('/ear-tag/:ear_tag', pigletController.getByEarTag);
router.get('/:id', pigletController.getById);

// Rutas de creación y edición
router.post('/', pigletController.create);
router.put('/:id', pigletController.update);
router.patch('/:id', pigletController.partialUpdate);

// Rutas de eliminación
router.delete('/:id/soft', pigletController.softDelete);
router.delete('/:id', pigletController.delete);

module.exports = router;

