const express = require('express');
const router = express.Router();
const calendarEventController = require('../controllers/calendarEventController');
const { authMiddleware } = require('../middleware/authMiddleware');

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Rutas de consulta
router.get('/', calendarEventController.getAll);
router.get('/upcoming', calendarEventController.getUpcoming);
router.get('/month/:year/:month', calendarEventController.getByMonth);
router.get('/:id', calendarEventController.getById);

// Rutas de creación, edición y eliminación
router.post('/', calendarEventController.create);
router.put('/:id', calendarEventController.update);
router.delete('/:id', calendarEventController.delete);

module.exports = router;

