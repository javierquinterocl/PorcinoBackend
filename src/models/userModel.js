const pool = require('../config/db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const userModel = {
  // Crear un nuevo usuario (registro)
  create: async (userData) => {
    const { first_name, last_name, phone, email, password } = userData;
    
    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pool.query(
      `INSERT INTO users (first_name, last_name, phone, email, password, is_active) 
       VALUES ($1, $2, $3, $4, $5, true) 
       RETURNING id, first_name, last_name, phone, email, is_active, created_at`,
      [first_name, last_name, phone, email, hashedPassword]
    );
    
    return result.rows[0];
  },

  // Buscar usuario por email
  findByEmail: async (email) => {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0];
  },

  // Buscar usuario por ID
  findById: async (id) => {
    const result = await pool.query(
      `SELECT id, first_name, last_name, phone, email, profile_image, is_active, created_at, updated_at 
       FROM users WHERE id = $1`,
      [id]
    );
    return result.rows[0];
  },

  // Obtener todos los usuarios
  getAll: async () => {
    const result = await pool.query(
      `SELECT id, first_name, last_name, phone, email, profile_image, is_active, created_at, updated_at 
       FROM users 
       ORDER BY created_at DESC`
    );
    return result.rows;
  },

  // Actualizar usuario
  update: async (id, userData) => {
    const { first_name, last_name, phone, email, is_active } = userData;
    
    const result = await pool.query(
      `UPDATE users 
       SET first_name = $1, last_name = $2, phone = $3, email = $4, 
           is_active = $5, updated_at = NOW() 
       WHERE id = $6 
       RETURNING id, first_name, last_name, phone, email, is_active, created_at, updated_at`,
      [first_name, last_name, phone, email, is_active, id]
    );
    
    return result.rows[0];
  },

  // Actualizar perfil del usuario (solo nombre, apellido y teléfono)
  updateProfile: async (id, profileData) => {
    const { first_name, last_name, phone } = profileData;
    
    const result = await pool.query(
      `UPDATE users 
       SET first_name = $1, last_name = $2, phone = $3, updated_at = NOW() 
       WHERE id = $4 
       RETURNING id, first_name, last_name, phone, email, profile_image, is_active, created_at, updated_at`,
      [first_name, last_name, phone, id]
    );
    
    return result.rows[0];
  },

  // Actualizar imagen de perfil
  updateProfileImage: async (id, profileImage) => {
    const result = await pool.query(
      `UPDATE users 
       SET profile_image = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING id, first_name, last_name, phone, email, profile_image, is_active, created_at, updated_at`,
      [profileImage, id]
    );
    
    return result.rows[0];
  },

  // Eliminar imagen de perfil
  deleteProfileImage: async (id) => {
    const result = await pool.query(
      `UPDATE users 
       SET profile_image = NULL, updated_at = NOW() 
       WHERE id = $1 
       RETURNING id, first_name, last_name, phone, email, profile_image, is_active, created_at, updated_at`,
      [id]
    );
    
    return result.rows[0];
  },

  // Cambiar contraseña
  updatePassword: async (id, newPassword) => {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    const result = await pool.query(
      'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
      [hashedPassword, id]
    );
    
    return result.rows[0];
  },

  // Eliminar usuario (soft delete - desactivar)
  deactivate: async (id) => {
    const result = await pool.query(
      `UPDATE users SET is_active = false, updated_at = NOW() 
       WHERE id = $1 
       RETURNING id, first_name, last_name, email, is_active`,
      [id]
    );
    return result.rows[0];
  },

  // Eliminar usuario permanentemente
  delete: async (id) => {
    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id, email',
      [id]
    );
    return result.rows[0];
  },

  // Verificar contraseña
  verifyPassword: async (plainPassword, hashedPassword) => {
    return await bcrypt.compare(plainPassword, hashedPassword);
  },

  // ==================== PASSWORD RESET ====================

  /**
   * Crear un token de recuperación de contraseña
   * @param {number} userId - ID del usuario
   * @returns {Object} Token y fecha de expiración
   */
  createPasswordResetToken: async (userId) => {
    // Generar token único
    const token = crypto.randomBytes(32).toString('hex');
    
    // Token expira en 1 hora
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Eliminar tokens anteriores del usuario
    await pool.query(
      'DELETE FROM password_reset_tokens WHERE user_id = $1',
      [userId]
    );

    // Insertar nuevo token
    const result = await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)
       RETURNING token, expires_at`,
      [userId, token, expiresAt]
    );

    return result.rows[0];
  },

  /**
   * Validar un token de recuperación
   * @param {string} token - Token de recuperación
   * @returns {Object|null} Datos del token si es válido
   */
  validatePasswordResetToken: async (token) => {
    const result = await pool.query(
      `SELECT prt.*, u.email, u.first_name, u.last_name
       FROM password_reset_tokens prt
       JOIN users u ON prt.user_id = u.id
       WHERE prt.token = $1 
         AND prt.expires_at > NOW() 
         AND prt.used_at IS NULL
         AND u.is_active = true`,
      [token]
    );

    return result.rows[0] || null;
  },

  /**
   * Marcar un token como usado
   * @param {string} token - Token de recuperación
   */
  markTokenAsUsed: async (token) => {
    await pool.query(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE token = $1',
      [token]
    );
  },

  /**
   * Resetear contraseña usando un token
   * @param {string} token - Token de recuperación
   * @param {string} newPassword - Nueva contraseña
   * @returns {Object} Usuario actualizado
   */
  resetPasswordWithToken: async (token, newPassword) => {
    // Validar token
    const tokenData = await userModel.validatePasswordResetToken(token);
    if (!tokenData) {
      throw new Error('Token inválido o expirado');
    }

    // Hash de la nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Actualizar contraseña
    const result = await pool.query(
      `UPDATE users 
       SET password = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING id, email, first_name, last_name`,
      [hashedPassword, tokenData.user_id]
    );

    // Marcar token como usado
    await userModel.markTokenAsUsed(token);

    return result.rows[0];
  },

  /**
   * Limpiar tokens expirados (para mantenimiento)
   */
  cleanExpiredTokens: async () => {
    const result = await pool.query(
      'DELETE FROM password_reset_tokens WHERE expires_at < NOW()'
    );
    return result.rowCount;
  }
};

module.exports = userModel;
