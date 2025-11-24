const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authMiddleware } = require('../middleware/authMiddleware');

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

/**
 * @route   GET /api/reports/reproductors
 * @desc    Obtener estadísticas de reproductores (cerdas, verracos, lechones)
 * @access  Private
 * @query   startDate, endDate (opcional)
 */
router.get('/reproductors', reportController.getReproductorsStats);

/**
 * @route   GET /api/reports/reproductive
 * @desc    Obtener estadísticas de datos reproductivos (celos, servicios, gestaciones, partos, abortos)
 * @access  Private
 * @query   sowId (opcional), startDate, endDate (opcional)
 */
router.get('/reproductive', reportController.getReproductiveStats);

/**
 * @route   GET /api/reports/kpis
 * @desc    Obtener KPIs productivos
 * @access  Private
 * @query   sowId (opcional), startDate, endDate (opcional)
 */
router.get('/kpis', reportController.getProductivityKPIs);

module.exports = router;
