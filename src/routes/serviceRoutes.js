const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const authMiddleware = require('../middleware/authMiddleware');

// Aplicar autenticación a todas las rutas
// router.use(authMiddleware);

// Rutas de servicios
router.get('/', serviceController.getAll);
router.get('/stats', serviceController.getStats);
router.get('/sow/:sowId', serviceController.getBySowId);
router.get('/heat/:heatId', serviceController.getByHeatId);
router.get('/:id', serviceController.getById);
router.post('/', serviceController.create);
router.put('/:id', serviceController.update);
router.delete('/:id', serviceController.delete);

module.exports = router;
