const userModel = require('../models/userModel');
const jwt = require('jsonwebtoken');
const emailService = require('../utils/emailService');

const userController = {
  // POST /api/auth/register - Registrar nuevo usuario
  register: async (req, res) => {
    try {
      const { first_name, last_name, phone, email, password } = req.body;

      // Validaciones básicas
      if (!first_name || !last_name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Faltan campos obligatorios: first_name, last_name, email, password'
        });
      }

      // Verificar si el email ya existe
      const existingUser = await userModel.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'El email ya está registrado'
        });
      }

      // Crear usuario
      const newUser = await userModel.create({
        first_name,
        last_name,
        phone,
        email,
        password
      });

      // Generar token
      const token = jwt.sign(
        {
          id: newUser.id,
          email: newUser.email
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      res.status(201).json({
        success: true,
        message: 'Usuario registrado exitosamente',
        data: {
          user: newUser,
          token
        }
      });
    } catch (error) {
      console.error('Error al registrar usuario:', error);
      res.status(500).json({
        success: false,
        message: 'Error al registrar usuario',
        error: error.message
      });
    }
  },

  // POST /api/auth/login - Iniciar sesión
  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      // Validaciones
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email y contraseña son obligatorios'
        });
      }

      // Buscar usuario
      const user = await userModel.findByEmail(email);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Credenciales inválidas'
        });
      }

      // Verificar si el usuario está activo
      if (!user.is_active) {
        return res.status(403).json({
          success: false,
          message: 'Usuario desactivado'
        });
      }

      // Verificar contraseña
      const isPasswordValid = await userModel.verifyPassword(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Credenciales inválidas'
        });
      }

      // Generar token
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      // Remover password de la respuesta
      const { password: userPassword, ...userWithoutPassword } = user;

      res.json({
        success: true,
        message: 'Inicio de sesión exitoso',
        data: {
          user: userWithoutPassword,
          token
        }
      });
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      res.status(500).json({
        success: false,
        message: 'Error al iniciar sesión',
        error: error.message
      });
    }
  },

  // GET /api/auth/me - Obtener usuario actual
  getMe: async (req, res) => {
    try {
      const user = await userModel.findById(req.user.id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      console.error('Error al obtener usuario:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener usuario',
        error: error.message
      });
    }
  },

  // PUT /api/auth/profile - Actualizar perfil del usuario autenticado
  updateProfile: async (req, res) => {
    try {
      const userId = req.user.id;
      const { firstName, first_name, lastName, last_name, phone } = req.body;

      // Validaciones básicas
      const newFirstName = firstName || first_name;
      const newLastName = lastName || last_name;

      if (!newFirstName || !newLastName) {
        return res.status(400).json({
          success: false,
          message: 'Nombre y apellido son obligatorios'
        });
      }

      // Actualizar solo campos permitidos
      const updatedUser = await userModel.updateProfile(userId, {
        first_name: newFirstName.trim(),
        last_name: newLastName.trim(),
        phone: phone ? phone.trim() : null
      });

      res.json({
        success: true,
        message: 'Perfil actualizado exitosamente',
        data: updatedUser
      });
    } catch (error) {
      console.error('Error al actualizar perfil:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar perfil',
        error: error.message
      });
    }
  },

  // PUT /api/auth/profile/image - Actualizar imagen de perfil
  updateProfileImage: async (req, res) => {
    try {
      const userId = req.user.id;
      const { profileImage } = req.body;

      // Validar que se envió una imagen
      if (!profileImage) {
        return res.status(400).json({
          success: false,
          message: 'La imagen de perfil es obligatoria'
        });
      }

      // Validar que la imagen esté en formato base64
      if (!profileImage.startsWith('data:image/')) {
        return res.status(400).json({
          success: false,
          message: 'La imagen debe estar en formato base64'
        });
      }

      // Validar tamaño de la imagen (máximo 5MB en base64)
      const sizeInBytes = (profileImage.length * 3) / 4;
      const maxSizeInBytes = 5 * 1024 * 1024; // 5MB
      
      if (sizeInBytes > maxSizeInBytes) {
        return res.status(400).json({
          success: false,
          message: 'La imagen es demasiado grande. El tamaño máximo es 5MB'
        });
      }

      // Actualizar imagen de perfil
      const updatedUser = await userModel.updateProfileImage(userId, profileImage);

      res.json({
        success: true,
        message: 'Imagen de perfil actualizada exitosamente',
        data: updatedUser
      });
    } catch (error) {
      console.error('Error al actualizar imagen de perfil:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar imagen de perfil',
        error: error.message
      });
    }
  },

  // DELETE /api/auth/profile/image - Eliminar imagen de perfil
  deleteProfileImage: async (req, res) => {
    try {
      const userId = req.user.id;

      // Eliminar imagen de perfil
      const updatedUser = await userModel.deleteProfileImage(userId);

      res.json({
        success: true,
        message: 'Imagen de perfil eliminada exitosamente',
        data: updatedUser
      });
    } catch (error) {
      console.error('Error al eliminar imagen de perfil:', error);
      res.status(500).json({
        success: false,
        message: 'Error al eliminar imagen de perfil',
        error: error.message
      });
    }
  },

  // GET /api/users - Obtener todos los usuarios (solo admin)
  getAll: async (req, res) => {
    try {
      const users = await userModel.getAll();
      res.json({
        success: true,
        data: users
      });
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener usuarios',
        error: error.message
      });
    }
  },

  // GET /api/users/:id - Obtener usuario por ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const user = await userModel.findById(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      console.error('Error al obtener usuario:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener usuario',
        error: error.message
      });
    }
  },

  // PUT /api/users/:id - Actualizar usuario
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const userData = req.body;

      // Verificar si el usuario existe
      const existingUser = await userModel.findById(id);
      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      // Si se intenta cambiar el email, verificar que no exista
      if (userData.email && userData.email !== existingUser.email) {
        const emailExists = await userModel.findByEmail(userData.email);
        if (emailExists) {
          return res.status(409).json({
            success: false,
            message: 'El email ya está en uso'
          });
        }
      }

      // Transformar datos del frontend (camelCase) a formato de base de datos (snake_case)
      const dbUserData = {
        first_name: userData.firstName || userData.first_name,
        last_name: userData.lastName || userData.last_name,
        phone: userData.phone,
        email: userData.email,
        is_active: userData.is_active !== undefined ? userData.is_active : existingUser.is_active
      };

      const updatedUser = await userModel.update(id, dbUserData);

      res.json({
        success: true,
        message: 'Usuario actualizado exitosamente',
        data: updatedUser
      });
    } catch (error) {
      console.error('Error al actualizar usuario:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar usuario',
        error: error.message
      });
    }
  },

  // PUT /api/users/:id/password - Cambiar contraseña
  updatePassword: async (req, res) => {
    try {
      const { id } = req.params;
      const { currentPassword, newPassword } = req.body;

      // Validaciones
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Contraseña actual y nueva son obligatorias'
        });
      }

      // Obtener usuario con contraseña
      const user = await userModel.findByEmail(req.user.email);

      // Verificar contraseña actual
      const isPasswordValid = await userModel.verifyPassword(currentPassword, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Contraseña actual incorrecta'
        });
      }

      await userModel.updatePassword(id, newPassword);

      res.json({
        success: true,
        message: 'Contraseña actualizada exitosamente'
      });
    } catch (error) {
      console.error('Error al cambiar contraseña:', error);
      res.status(500).json({
        success: false,
        message: 'Error al cambiar contraseña',
        error: error.message
      });
    }
  },

  // DELETE /api/users/:id - Desactivar usuario
  deactivate: async (req, res) => {
    try {
      const { id } = req.params;
      const deactivatedUser = await userModel.deactivate(id);

      if (!deactivatedUser) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      res.json({
        success: true,
        message: 'Usuario desactivado exitosamente',
        data: deactivatedUser
      });
    } catch (error) {
      console.error('Error al desactivar usuario:', error);
      res.status(500).json({
        success: false,
        message: 'Error al desactivar usuario',
        error: error.message
      });
    }
  },

  // DELETE /api/users/:id/permanent - Eliminar usuario permanentemente
  delete: async (req, res) => {
    try {
      const { id } = req.params;
      const deletedUser = await userModel.delete(id);

      if (!deletedUser) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      res.json({
        success: true,
        message: 'Usuario eliminado permanentemente',
        data: deletedUser
      });
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      res.status(500).json({
        success: false,
        message: 'Error al eliminar usuario',
        error: error.message
      });
    }
  },

  // ==================== PASSWORD RESET ENDPOINTS ====================

  /**
   * POST /api/auth/forgot-password
   * Solicitar recuperación de contraseña
   */
  requestPasswordReset: async (req, res) => {
    try {
      const { email } = req.body;

      // Validación
      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'El email es obligatorio'
        });
      }

      // Buscar usuario por email
      const user = await userModel.findByEmail(email);
      
      // Por seguridad, siempre retornar éxito aunque el usuario no exista
      // Esto evita que se pueda enumerar usuarios válidos
      if (!user) {
        return res.json({
          success: true,
          message: 'Si el email existe en nuestro sistema, recibirás un enlace de recuperación'
        });
      }

      // Verificar que el usuario esté activo
      if (!user.is_active) {
        return res.status(403).json({
          success: false,
          message: 'Usuario desactivado. Contacte al administrador.'
        });
      }

      // Crear token de recuperación
      const tokenData = await userModel.createPasswordResetToken(user.id);

      // Enviar email (si el servicio está configurado)
      try {
        await emailService.sendPasswordResetEmail(
          email,
          tokenData.token,
          `${user.first_name} ${user.last_name}`
        );

        res.json({
          success: true,
          message: 'Se ha enviado un enlace de recuperación a tu email',
          data: {
            expiresAt: tokenData.expires_at
          }
        });
      } catch (emailError) {
        console.error('Error al enviar email:', emailError);
        
        // Si el email falla pero tenemos el token, aún podemos continuar
        // En desarrollo, retornar el token para testing
        if (process.env.NODE_ENV === 'development') {
          return res.json({
            success: true,
            message: 'Token generado (email no configurado)',
            data: {
              token: tokenData.token,
              expiresAt: tokenData.expires_at
            }
          });
        }

        // En producción, informar el error
        return res.status(500).json({
          success: false,
          message: 'Error al enviar el email de recuperación. Intente nuevamente más tarde.'
        });
      }
    } catch (error) {
      console.error('Error en requestPasswordReset:', error);
      res.status(500).json({
        success: false,
        message: 'Error al procesar la solicitud',
        error: error.message
      });
    }
  },

  /**
   * POST /api/auth/validate-reset-token
   * Validar si un token de recuperación es válido
   */
  validateResetToken: async (req, res) => {
    try {
      const { token } = req.body;

      console.log('🔍 Validando token de recuperación...');
      console.log('   Token recibido:', token ? token.substring(0, 20) + '...' : 'NO TOKEN');

      if (!token) {
        console.log('❌ Token no proporcionado');
        return res.status(400).json({
          success: false,
          message: 'Token es obligatorio'
        });
      }

      const tokenData = await userModel.validatePasswordResetToken(token);

      console.log('   Resultado validación:', tokenData ? 'VÁLIDO' : 'INVÁLIDO/EXPIRADO');

      if (!tokenData) {
        console.log('❌ Token inválido o expirado');
        return res.status(400).json({
          success: false,
          message: 'Token inválido o expirado'
        });
      }

      console.log('✅ Token válido para:', tokenData.email);
      res.json({
        success: true,
        message: 'Token válido',
        data: {
          email: tokenData.email,
          expiresAt: tokenData.expires_at
        }
      });
    } catch (error) {
      console.error('Error en validateResetToken:', error);
      res.status(500).json({
        success: false,
        message: 'Error al validar token',
        error: error.message
      });
    }
  },

  /**
   * POST /api/auth/reset-password
   * Resetear contraseña usando un token
   */
  resetPassword: async (req, res) => {
    try {
      const { token, password } = req.body;

      // Validaciones
      if (!token || !password) {
        return res.status(400).json({
          success: false,
          message: 'Token y contraseña son obligatorios'
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'La contraseña debe tener al menos 6 caracteres'
        });
      }

      // Resetear contraseña
      const user = await userModel.resetPasswordWithToken(token, password);

      // Enviar email de confirmación (opcional, no bloquear si falla)
      try {
        await emailService.sendPasswordChangedEmail(
          user.email,
          `${user.first_name} ${user.last_name}`
        );
      } catch (emailError) {
        console.error('Error al enviar email de confirmación:', emailError);
        // No interrumpir el flujo
      }

      res.json({
        success: true,
        message: 'Contraseña actualizada exitosamente'
      });
    } catch (error) {
      console.error('Error en resetPassword:', error);
      
      if (error.message === 'Token inválido o expirado') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error al resetear contraseña',
        error: error.message
      });
    }
  }
};

module.exports = userController;
