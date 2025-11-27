const { Resend } = require('resend');

/**
 * Servicio para envío de emails usando Resend
 */
class EmailService {
  constructor() {
    this.resend = null;
    this.initializeResend();
  }

  /**
   * Inicializar Resend
   */
  initializeResend() {
    const resendApiKey = process.env.RESEND_API_KEY;
    const emailFrom = process.env.EMAIL_FROM || 'onboarding@resend.dev';

    console.log('\n🔍 Verificando configuración de email (Resend)...');
    console.log('   RESEND_API_KEY:', resendApiKey ? '✅ Configurado (' + resendApiKey.substring(0, 10) + '...)' : '❌ NO CONFIGURADO');
    console.log('   EMAIL_FROM:', emailFrom);

    if (!resendApiKey) {
      console.warn('\n⚠️  RESEND_API_KEY no configurado. Las funciones de email estarán deshabilitadas.');
      console.warn('   Para habilitar emails:');
      console.warn('   1. Ve a https://resend.com');
      console.warn('   2. Crea una cuenta y obtén tu API Key');
      console.warn('   3. Configura RESEND_API_KEY en las variables de entorno de Vercel');
      console.warn('   Modo desarrollo: El token se mostrará en la respuesta para testing.\n');
      return;
    }

    try {
      this.resend = new Resend(resendApiKey);
      this.fromEmail = emailFrom;
      console.log('✅ Servicio de email (Resend) configurado correctamente\n');
    } catch (error) {
      console.error('\n❌ Error al configurar Resend:', error.message);
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
      
      const { data, error } = await this.resend.emails.send({
        from: `Sistema Granme <${this.fromEmail}>`,
        to: [to],
        subject: 'Recuperación de Contraseña - Sistema Granme',
        html: this.getPasswordResetTemplate(userName, resetUrl)
      });

      if (error) {
        console.error('❌ Error de Resend:', error);
        throw new Error(`Error al enviar email: ${error.message || JSON.stringify(error)}`);
      }
      
      console.log('✅ Email de recuperación enviado exitosamente');
      console.log('   Email ID:', data.id);
      console.log('   Destinatario:', to);
      return data;
    } catch (error) {
      console.error('❌ Error al enviar email de recuperación:', error);
      console.error('   Detalles:', error.message);
      throw new Error('No se pudo enviar el email de recuperación. Intente nuevamente más tarde.');
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
   * Enviar email de notificación de evento creado
   * @param {string} to - Email del destinatario
   * @param {Object} eventData - Datos del evento
   */
  async sendEventNotificationEmail(to, eventData) {
    if (!this.isAvailable()) {
      console.warn('Email de notificación de evento no enviado: servicio no configurado');
      return;
    }

    const { title, eventDate, eventTime, createdBy, sowName } = eventData;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nuevo Evento - Calendario</title>
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
          .event-details {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #6b7c45;
          }
          .event-details p {
            margin: 10px 0;
          }
          .event-details strong {
            color: #1a2e02;
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
            <h2>📅 Nuevo Evento Creado</h2>
            <p>Se ha creado un nuevo evento en el calendario:</p>
            
            <div class="event-details">
              <p><strong>📝 Evento:</strong> ${title}</p>
              <p><strong>📅 Fecha:</strong> ${eventDate}</p>
              ${eventTime ? `<p><strong>⏰ Hora:</strong> ${eventTime}</p>` : ''}
              ${sowName ? `<p><strong>🐷 Cerda:</strong> ${sowName}</p>` : ''}
              <p><strong>👤 Creado por:</strong> ${createdBy}</p>
            </div>
          </div>
          
          <div class="footer">
            <p>Este es un mensaje automático del Sistema de Gestión Porcina Granme.</p>
            <p>&copy; ${new Date().getFullYear()} Granme. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      const { data, error } = await this.resend.emails.send({
        from: `Sistema Granme <${this.fromEmail}>`,
        to: [to],
        subject: `Nuevo Evento: ${title}`,
        html: htmlContent
      });

      if (error) {
        console.error('❌ Error al enviar email de evento:', error);
        return;
      }

      console.log('✉️  Email de evento enviado:', data.id);
      return data;
    } catch (error) {
      console.error('❌ Error al enviar email de evento:', error);
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
