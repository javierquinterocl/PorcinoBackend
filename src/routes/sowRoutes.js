const express = require('express');
const router = express.Router();
const sowController = require('../controllers/sowController');
const { authMiddleware, checkRole } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { validateId } = require('../middleware/validateId');

// Todas las rutas de cerdas requieren autenticación
router.use(authMiddleware);

// Rutas públicas para usuarios autenticados
router.get('/', sowController.getAll);
router.get('/stats', sowController.getStats);
router.get('/ear-tag/:ear_tag', sowController.getByEarTag);
router.get('/:id/reproductive-status', validateId('id'), sowController.getReproductiveStatusById);
router.get('/:id', validateId('id'), sowController.getById);

// Ruta para subir foto (solo una imagen a la vez)
router.post('/upload-photo', upload.single('photo'), sowController.uploadPhoto);

// Rutas de creación y edición (requieren autenticación)
router.post('/', sowController.create);
router.put('/:id', validateId('id'), sowController.update);
router.patch('/:id', validateId('id'), sowController.partialUpdate);
router.delete('/:id', validateId('id'), sowController.softDelete);
router.delete('/:id/permanent', validateId('id'), sowController.delete);

module.exports = router;
