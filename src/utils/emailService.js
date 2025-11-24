const nodemailer = require('nodemailer');

/**
 * Servicio para envío de emails
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  /**
   * Inicializar el transportador de nodemailer
   */
  initializeTransporter() {
    // Verificar si las variables de entorno están configuradas
    const emailHost = process.env.EMAIL_HOST;
    const emailPort = process.env.EMAIL_PORT || 587;
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    const emailFrom = process.env.EMAIL_FROM || emailUser;

    console.log('\n🔍 Verificando configuración de email...');
    console.log('   EMAIL_HOST:', emailHost || '❌ NO CONFIGURADO');
    console.log('   EMAIL_PORT:', emailPort);
    console.log('   EMAIL_USER:', emailUser || '❌ NO CONFIGURADO');
    console.log('   EMAIL_PASS:', emailPass ? '✅ Configurado (' + emailPass.length + ' caracteres)' : '❌ NO CONFIGURADO');

    if (!emailHost || !emailUser || !emailPass) {
      console.warn('\n⚠️  Configuración de email INCOMPLETA. Las funciones de email estarán deshabilitadas.');
      console.warn('   Para habilitar emails, configure: EMAIL_HOST, EMAIL_USER, EMAIL_PASS en .env');
      console.warn('   Modo desarrollo: El token se mostrará en la respuesta para testing.\n');
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: emailHost,
        port: parseInt(emailPort),
        secure: parseInt(emailPort) === 465, // true para 465, false para otros puertos
        auth: {
          user: emailUser,
          pass: emailPass
        },
        // Agregar opciones adicionales para debugging
        debug: process.env.NODE_ENV === 'development',
        logger: process.env.NODE_ENV === 'development',
        // Rechazar certificados no autorizados (importante para certificados corporativos/proxies)
        tls: {
          rejectUnauthorized: false
        }
      });

      this.fromEmail = emailFrom;
      console.log('✅ Servicio de email configurado correctamente');
      
      // Verificar la conexión inmediatamente
      this.transporter.verify((error, success) => {
        if (error) {
          console.error('\n❌ Error al conectar con el servidor SMTP:', error.message);
          console.error('   Verifica:');
          console.error('   1. Contraseña de aplicación de Gmail (sin espacios)');
          console.error('   2. Verificación en 2 pasos activada');
          console.error('   3. Conexión a internet');
          this.transporter = null; // Deshabilitar si la conexión falla
        } else {
          console.log('✅ Conexión SMTP verificada exitosamente\n');
        }
      });
    } catch (error) {
      console.error('\n❌ Error al configurar el servicio de email:', error.message);
      this.transporter = null;
    }
  }

  /**
   * Verificar si el servicio de email está disponible
   */
  isAvailable() {
    return this.transporter !== null;
  }

  /**
   * Enviar email de recuperación de contraseña
   * @param {string} to - Email del destinatario
   * @param {string} token - Token de recuperación
   * @param {string} userName - Nombre del usuario
   */
  async sendPasswordResetEmail(to, token, userName) {
    if (!this.isAvailable()) {
      const errorMsg = 'El servicio de email no está configurado. Configure las variables de entorno necesarias.';
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

    const mailOptions = {
      from: `"Sistema Granme" <${this.fromEmail}>`,
      to: to,
      subject: 'Recuperación de Contraseña - Sistema Granme',
      html: this.getPasswordResetTemplate(userName, resetUrl)
    };

    try {
      console.log('📤 Enviando email...');
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email de recuperación enviado exitosamente');
      console.log('   Message ID:', info.messageId);
      console.log('   Destinatario:', to);
      return info;
    } catch (error) {
      console.error('❌ Error al enviar email de recuperación:', error);
      console.error('   Detalles:', error.message);
      if (error.code) {
        console.error('   Código de error:', error.code);
      }
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
   * Enviar email de confirmación de cambio de contraseña
   * @param {string} to - Email del destinatario
   * @param {string} userName - Nombre del usuario
   */
  async sendPasswordChangedEmail(to, userName) {
    if (!this.isAvailable()) {
      // No lanzar error aquí, solo loggearlo
      console.warn('Email de confirmación no enviado: servicio no configurado');
      return;
    }

    const mailOptions = {
      from: `"Sistema Granme" <${this.fromEmail}>`,
      to: to,
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
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✉️  Email de confirmación enviado:', info.messageId);
      return info;
    } catch (error) {
      console.error('❌ Error al enviar email de confirmación:', error);
      // No lanzar error para no interrumpir el flujo
    }
  }
}

// Exportar una instancia singleton
module.exports = new EmailService();
