const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authMiddleware, checkRole } = require('../middleware/authMiddleware');

// Rutas públicas (sin autenticación)
router.post('/register', userController.register);
router.post('/login', userController.login);
router.post('/forgot-password', userController.requestPasswordReset);
router.post('/validate-reset-token', userController.validateResetToken);
router.post('/reset-password', userController.resetPassword);

// Rutas protegidas (requieren autenticación)
router.get('/me', authMiddleware, userController.getMe);
router.put('/profile', authMiddleware, userController.updateProfile);
router.put('/profile/image', authMiddleware, userController.updateProfileImage);
router.delete('/profile/image', authMiddleware, userController.deleteProfileImage);
router.get('/', authMiddleware, userController.getAll);
router.get('/:id', authMiddleware, userController.getById);
router.put('/:id', authMiddleware, userController.update);
router.put('/password/:id', authMiddleware, userController.updatePassword);
router.delete('/:id', authMiddleware, userController.deactivate);
router.delete('/:id/permanent', authMiddleware, userController.delete);

module.exports = router;
