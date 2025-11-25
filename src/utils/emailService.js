const { Resend } = require('resend');

/**
 * Servicio para envío de emails usando Resend API
 */
class EmailService {
  constructor() {
    this.resend = null;
    this.fromEmail = null;
    this.initializeResend();
  }

  /**
   * Inicializar el cliente de Resend
   */
  initializeResend() {
    const resendApiKey = process.env.RESEND_API_KEY;
    const emailFrom = process.env.EMAIL_FROM || 'onboarding@resend.dev';

    console.log('\n🔍 Verificando configuración de Resend...');
    console.log('   RESEND_API_KEY:', resendApiKey ? '✅ Configurado (' + resendApiKey.substring(0, 8) + '...)' : '❌ NO CONFIGURADO');
    console.log('   EMAIL_FROM:', emailFrom);

    if (!resendApiKey) {
      console.warn('\n⚠️  API Key de Resend NO configurada. Las funciones de email estarán deshabilitadas.');
      console.warn('   Para habilitar emails, configure: RESEND_API_KEY en las variables de entorno');
      console.warn('   Modo desarrollo: El token se mostrará en la respuesta para testing.\n');
      return;
    }

    try {
      this.resend = new Resend(resendApiKey);
      this.fromEmail = emailFrom;
      console.log('✅ Servicio de email con Resend configurado correctamente\n');
    } catch (error) {
      console.error('\n❌ Error al configurar el servicio de Resend:', error.message);
      this.resend = null;
    }
  }

  /**
   * Verificar si el servicio de email está disponible
   */
  isAvailable() {
    return this.resend !== null;
  }

  /**
   * Enviar email de recuperación de contraseña
   * @param {string} to - Email del destinatario
   * @param {string} token - Token de recuperación
   * @param {string} userName - Nombre del usuario
   */
  async sendPasswordResetEmail(to, token, userName) {
    if (!this.isAvailable()) {
      const errorMsg = 'El servicio de email no está configurado. Configure RESEND_API_KEY en las variables de entorno.';
      console.error('❌', errorMsg);
      throw new Error(errorMsg);
    }

    // URL para resetear contraseña (ajustar según el dominio en producción)
    const resetUrl = process.env.FRONTEND_URL 
      ? `${process.env.FRONTEND_URL}/reset-password/${token}`
      : `http://localhost:5173/reset-password/${token}`;

    console.log('📧 Preparando email de recuperación...');
    console.log('   Para:', to);
    console.log('   URL:', resetUrl);

    try {
      console.log('📤 Enviando email con Resend...');
      console.log('   De:', `Sistema Granme <${this.fromEmail}>`);
      console.log('   Para:', to);
      
      const { data, error } = await this.resend.emails.send({
        from: `Sistema Granme <${this.fromEmail}>`,
        to: [to],
        subject: 'Recuperación de Contraseña - Sistema Granme',
        html: this.getPasswordResetTemplate(userName, resetUrl)
      });

      if (error) {
        console.error('❌ Error de Resend:', JSON.stringify(error, null, 2));
        console.error('   Código de error:', error.statusCode || error.code);
        console.error('   Mensaje:', error.message);
        console.error('   Nombre:', error.name);
        throw new Error(`Error de Resend: ${error.message || JSON.stringify(error)}`);
      }

      console.log('✅ Email de recuperación enviado exitosamente');
      console.log('   Email ID:', data.id);
      console.log('   Destinatario:', to);
      return data;
    } catch (error) {
      console.error('❌ Error al enviar email de recuperación:', error);
      console.error('   Tipo de error:', error.constructor.name);
      console.error('   Detalles completos:', JSON.stringify(error, null, 2));
      console.error('   Stack:', error.stack);
      throw error; // Lanzar el error original para ver todos los detalles
    }
  }

  /**
   * Plantilla HTML para el email de recuperación de contraseña
   * @param {string} userName - Nombre del usuario
   * @param {string} resetUrl - URL para resetear la contraseña
   */
  getPasswordResetTemplate(userName, resetUrl) {
    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Recuperación de Contraseña</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
          }
          .container {
            background-color: #ffffff;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            padding-bottom: 20px;
            border-bottom: 3px solid #6b7c45;
          }
          .header h1 {
            color: #1a2e02;
            margin: 0;
            font-size: 28px;
          }
          .content {
            padding: 30px 0;
          }
          .button {
            display: inline-block;
            padding: 15px 30px;
            background-color: #6b7c45;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            margin: 20px 0;
            text-align: center;
          }
          .button:hover {
            background-color: #5a6b35;
          }
          .footer {
            text-align: center;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            font-size: 12px;
            color: #666;
          }
          .warning {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .warning p {
            margin: 0;
            color: #856404;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🐷 Sistema Granme</h1>
          </div>
          
          <div class="content">
            <h2>Hola ${userName || 'Usuario'},</h2>
            <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.</p>
            <p>Para crear una nueva contraseña, haz clic en el siguiente botón:</p>
            
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Restablecer Contraseña</a>
            </div>
            
            <p>O copia y pega el siguiente enlace en tu navegador:</p>
            <p style="word-break: break-all; background-color: #f8f9fa; padding: 10px; border-radius: 4px;">
              ${resetUrl}
            </p>
            
            <div class="warning">
              <p><strong>⚠️ Importante:</strong></p>
              <p>• Este enlace expirará en <strong>1 hora</strong>.</p>
              <p>• Si no solicitaste este cambio, ignora este email y tu contraseña permanecerá sin cambios.</p>
              <p>• Por seguridad, nunca compartas este enlace con nadie.</p>
            </div>
          </div>
          
          <div class="footer">
            <p>Este es un mensaje automático del Sistema de Gestión Porcina Granme.</p>
            <p>Si tienes problemas, contacta al administrador del sistema.</p>
            <p>&copy; ${new Date().getFullYear()} Granme. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Enviar email genérico de notificación
   * @param {string} to - Email del destinatario
   * @param {string} subject - Asunto del email
   * @param {string} html - Contenido HTML del email
   */
  async sendEmail(to, subject, html) {
    if (!this.isAvailable()) {
      console.warn('⚠️  Email no enviado: servicio Resend no configurado');
      return null;
    }

    try {
      console.log('📧 Enviando email...');
      console.log('   De:', `Sistema Granme <${this.fromEmail}>`);
      console.log('   Para:', to);
      console.log('   Asunto:', subject);

      const { data, error } = await this.resend.emails.send({
        from: `Sistema Granme <${this.fromEmail}>`,
        to: [to],
        subject,
        html
      });

      if (error) {
        console.error('❌ Error de Resend al enviar email:', JSON.stringify(error, null, 2));
        console.error('   Código:', error.statusCode || error.code);
        console.error('   Mensaje:', error.message);
        return null;
      }

      console.log('✅ Email enviado exitosamente');
      console.log('   Email ID:', data.id);
      return data;
    } catch (error) {
      console.error('❌ Error al enviar email:', error);
      console.error('   Detalles:', JSON.stringify(error, null, 2));
      // No lanzar error para no interrumpir el flujo
      return null;
    }
  }

  /**
   * Enviar email de confirmación de cambio de contraseña
   * @param {string} to - Email del destinatario
   * @param {string} userName - Nombre del usuario
   */
  async sendPasswordChangedEmail(to, userName) {
    if (!this.isAvailable()) {
      console.warn('Email de confirmación no enviado: servicio no configurado');
      return;
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: `Sistema Granme <${this.fromEmail}>`,
        to: [to],
        subject: 'Contraseña Actualizada - Sistema Granme',
        html: `
          <!DOCTYPE html>
          <html lang="es">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Contraseña Actualizada</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f4f4f4;
              }
              .container {
                background-color: #ffffff;
                padding: 30px;
                border-radius: 10px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
              }
              .header {
                text-align: center;
                padding-bottom: 20px;
                border-bottom: 3px solid #6b7c45;
              }
              .header h1 {
                color: #1a2e02;
                margin: 0;
                font-size: 28px;
              }
              .content {
                padding: 30px 0;
              }
              .success-icon {
                text-align: center;
                font-size: 50px;
                margin: 20px 0;
              }
              .footer {
                text-align: center;
                padding-top: 20px;
                border-top: 1px solid #ddd;
                font-size: 12px;
                color: #666;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🐷 Sistema Granme</h1>
              </div>
              
              <div class="content">
                <div class="success-icon">✅</div>
                <h2 style="text-align: center;">Contraseña Actualizada</h2>
                <p>Hola ${userName || 'Usuario'},</p>
                <p>Tu contraseña ha sido actualizada exitosamente.</p>
                <p>Si no realizaste este cambio, contacta inmediatamente al administrador del sistema.</p>
                <p>Fecha del cambio: <strong>${new Date().toLocaleString('es-CO')}</strong></p>
              </div>
              
              <div class="footer">
                <p>Este es un mensaje automático del Sistema de Gestión Porcina Granme.</p>
                <p>&copy; ${new Date().getFullYear()} Granme. Todos los derechos reservados.</p>
              </div>
            </div>
          </body>
          </html>
        `
      });

      if (error) {
        console.error('❌ Error al enviar email de confirmación:', error);
        return;
      }

      console.log('✉️  Email de confirmación enviado:', data.id);
      return data;
    } catch (error) {
      console.error('❌ Error al enviar email de confirmación:', error);
      // No lanzar error para no interrumpir el flujo
    }
  }
}

// Exportar una instancia singleton
module.exports = new EmailService();
