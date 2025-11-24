const express = require('express');
const router = express.Router();
const heatController = require('../controllers/heatController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { runNow } = require('../jobs/heatStatusJob');

// Todas las rutas de celos requieren autenticación
router.use(authMiddleware);

// Rutas públicas para usuarios autenticados
router.get('/', heatController.getAll);
router.get('/stats', heatController.getStats);
router.get('/pending', heatController.getPending);
router.get('/sow/:sowId', heatController.getBySowId);
router.get('/sow/:sowId/last', heatController.getLastBySowId);
router.get('/:id', heatController.getById);

// Ruta para ejecutar manualmente el job de actualización de estados
router.post('/jobs/update-unserved', async (req, res) => {
  try {
    const result = await runNow();
    res.json({
      success: true,
      message: 'Job ejecutado exitosamente',
      data: result
    });
  } catch (error) {
    console.error('Error al ejecutar job manualmente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al ejecutar job',
      error: error.message
    });
  }
});

// Rutas de creación y edición
router.post('/', heatController.create);
router.put('/:id', heatController.update);
router.patch('/:id', heatController.partialUpdate);
router.patch('/:id/status', heatController.updateStatus);

// Ruta de eliminación (solo para celos no servidos)
router.delete('/:id', heatController.delete);

module.exports = router;
