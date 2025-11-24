const express = require('express');
const router = express.Router();
const boarController = require('../controllers/boarController');
const { authMiddleware, checkRole } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Todas las rutas de verracos requieren autenticación
router.use(authMiddleware);

// Rutas públicas para usuarios autenticados
router.get('/', boarController.getAll);
router.get('/stats', boarController.getStats);
router.get('/ear-tag/:ear_tag', boarController.getByEarTag);
router.get('/:id', boarController.getById);

// Ruta para subir foto (solo una imagen a la vez)
router.post('/upload-photo', upload.single('photo'), boarController.uploadPhoto);

// Rutas de creación y edición (requieren autenticación)
router.post('/', boarController.create);
router.put('/:id', boarController.update);
router.patch('/:id', boarController.partialUpdate);
router.delete('/:id', boarController.softDelete);
router.delete('/:id/permanent', boarController.delete);

module.exports = router;
