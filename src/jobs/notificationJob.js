const cron = require('node-cron');
const pool = require('../config/db');
const notificationModel = require('../models/notificationModel');
const userModel = require('../models/userModel');
const emailService = require('../utils/emailService');

/**
 * Job para generar notificaciones automáticas basadas en:
 * - Eventos del calendario próximos
 * - Partos próximos
 * - Servicios pendientes
 * - Confirmaciones de gestación pendientes
 */

const notificationJob = {
  /**
   * Generar notificaciones para eventos del calendario
   */
  generateCalendarNotifications: async () => {
    try {
      console.log('📅 Generando notificaciones de calendario...');

      // Obtener eventos próximos (dentro de las próximas 24 horas)
      const result = await pool.query(
        `SELECT ce.*, u.id as user_id 
         FROM calendar_events ce
         CROSS JOIN users u
         WHERE ce.event_date BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
           AND ce.event_date > NOW()
           AND u.is_active = TRUE
         ORDER BY ce.event_date ASC`
      );

      const events = result.rows;
      console.log(`   Encontrados ${events.length} eventos próximos`);

      if (events.length === 0) return;

      // Verificar si ya existe notificación para cada evento
      const notifications = [];
      for (const event of events) {
        // Verificar si ya existe notificación reciente (leída o no)
        const existing = await pool.query(
          `SELECT id FROM notifications 
           WHERE user_id = $1 
             AND reference_type = 'calendar_event' 
             AND reference_id = $2 
             AND created_at > NOW() - INTERVAL '12 hours'`,
          [event.user_id, event.id]
        );

        if (existing.rows.length > 0) continue;

        // Calcular tiempo restante
        const timeUntil = new Date(event.event_date) - new Date();
        const hoursUntil = Math.floor(timeUntil / (1000 * 60 * 60));

        let title, message, priority;
        
        if (hoursUntil <= 1) {
          title = '🔔 Evento próximo en 1 hora';
          message = `${event.title} - ${event.description || ''}`;
          priority = 'high';
        } else if (hoursUntil <= 6) {
          title = '📅 Evento próximo hoy';
          message = `${event.title} en ${hoursUntil} horas - ${event.description || ''}`;
          priority = 'normal';
        } else {
          title = '📅 Recordatorio de evento';
          message = `${event.title} mañana - ${event.description || ''}`;
          priority = 'normal';
        }

        notifications.push({
          user_id: event.user_id,
          title,
          message,
          type: 'calendar',
          priority,
          reference_type: 'calendar_event',
          reference_id: event.id,
          action_url: '/calendar',
          // incluir la fecha del evento en el objeto en memoria
          event_date: event.event_date
        });
      }

      if (notifications.length > 0) {
        const created = await notificationModel.createBulk(notifications);
        console.log(`   ✅ Creadas ${created.length} notificaciones de calendario`);
        // Enviar correo por cada notificación creada usando las fechas del objeto en memoria
        for (let i = 0; i < created.length; i++) {
          const notification = created[i];
          const original = notifications[i];
          try {
            const user = await userModel.findById(notification.user_id);
            if (user && user.email && emailService.isAvailable()) {
              const subject = notification.title || 'Nueva notificación';
              // Obtener la fecha y hora del evento real desde el objeto original en memoria
              let eventDate = null;
              if (original && original.event_date) {
                eventDate = new Date(original.event_date);
              }
              const pad = n => n.toString().padStart(2, '0');
              const formattedDate = `${eventDate.getFullYear()}/${pad(eventDate.getMonth()+1)}/${pad(eventDate.getDate())}`;
              const formattedTime = `${pad(eventDate.getHours())}:${pad(eventDate.getMinutes())}`;

              const html = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px #eee; padding: 24px;">
                  <h2 style="color: #1a2e02;">Hola ${user.first_name || user.email},</h2>
                  <p style="font-size: 16px;">Tienes una nueva notificación en el sistema Granme:</p>
                  <table style="width:100%; margin: 16px 0; border-collapse: collapse;">
                    <tr><td style="font-weight:bold;">Título:</td><td>${notification.title}</td></tr>
                    <tr><td style="font-weight:bold;">Tipo:</td><td>${notification.type || 'General'}</td></tr>
                    <tr><td style="font-weight:bold;">Descripción:</td><td>${notification.message}</td></tr>
                    <tr><td style="font-weight:bold;">Fecha del evento:</td><td>${formattedDate}</td></tr>
                    <tr><td style="font-weight:bold;">Hora del evento:</td><td>${formattedTime}</td></tr>
                  </table>
                  <div style="margin: 24px 0; text-align: center;">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/notifications" style="background: #6b7c45; color: #fff; text-decoration: none; padding: 12px 32px; border-radius: 5px; font-weight: bold;">Ver más</a>
                  </div>
                  <hr>
                  <small style="color: #888;">Este mensaje fue generado automáticamente por el sistema Granme.</small>
                </div>
              `;
              await emailService.sendEmail(user.email, subject, html);
            }
          } catch (emailError) {
            console.error('Error al enviar email de notificación automática:', emailError);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error generando notificaciones de calendario:', error);
    }
  },

  /**
   * Generar notificaciones para partos próximos
   */
  generateBirthNotifications: async () => {
    try {
      console.log('🐷 Generando notificaciones de partos próximos...');

      // Obtener gestaciones próximas a término (112-116 días)
      const result = await pool.query(
        `SELECT p.*, s.ear_tag, s.alias, u.id as user_id
         FROM pregnancies p
         JOIN sows s ON p.sow_id = s.id
         CROSS JOIN users u
         WHERE p.confirmed = TRUE
           AND p.expected_farrowing_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'
           AND u.is_active = TRUE
         ORDER BY p.expected_farrowing_date ASC`
      );

      const pregnancies = result.rows;
      console.log(`   Encontradas ${pregnancies.length} gestaciones próximas al parto`);

      if (pregnancies.length === 0) return;

      const notifications = [];
      for (const preg of pregnancies) {
        // Verificar si ya existe notificación
        const existing = await pool.query(
          `SELECT id FROM notifications 
           WHERE user_id = $1 
             AND reference_type = 'pregnancy' 
             AND reference_id = $2 
             AND is_read = FALSE
             AND created_at > NOW() - INTERVAL '3 days'`,
          [preg.user_id, preg.id]
        );

        if (existing.rows.length > 0) continue;

        const daysUntil = Math.ceil((new Date(preg.expected_farrowing_date) - new Date()) / (1000 * 60 * 60 * 24));
        const sowName = preg.alias || preg.ear_tag;

        let title, message, priority;
        
        if (daysUntil <= 1) {
          title = '🚨 Parto inminente';
          message = `La cerda ${sowName} puede parir hoy. Preparar jaula de maternidad.`;
          priority = 'urgent';
        } else if (daysUntil <= 3) {
          title = '⚠️ Parto próximo';
          message = `La cerda ${sowName} puede parir en ${daysUntil} días. Revisar preparativos.`;
          priority = 'high';
        } else {
          title = '📋 Parto programado';
          message = `La cerda ${sowName} tiene parto previsto en ${daysUntil} días.`;
          priority = 'normal';
        }

        notifications.push({
          user_id: preg.user_id,
          title,
          message,
          type: 'birth',
          priority,
          reference_type: 'pregnancy',
          reference_id: preg.id,
          action_url: `/pregnancies?sow=${preg.sow_id}`,
          expected_farrowing_date: preg.expected_farrowing_date
        });
      }

      if (notifications.length > 0) {
        const created = await notificationModel.createBulk(notifications);
        console.log(`   ✅ Creadas ${created.length} notificaciones de partos`);
        for (let i = 0; i < created.length; i++) {
          const notification = created[i];
          const original = notifications[i];
          try {
            const user = await userModel.findById(notification.user_id);
            if (user && user.email && emailService.isAvailable()) {
              const subject = notification.title || 'Nueva notificación';
              // usar fecha original si está disponible
              let eventDate = null;
              if (original && original.expected_farrowing_date) {
                eventDate = new Date(original.expected_farrowing_date);
              }
              const pad = n => n.toString().padStart(2, '0');
              const formattedDate = eventDate ? `${eventDate.getFullYear()}/${pad(eventDate.getMonth()+1)}/${pad(eventDate.getDate())}` : 'No disponible';
              const formattedTime = eventDate ? `${pad(eventDate.getHours())}:${pad(eventDate.getMinutes())}` : 'No disponible';
              const html = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px #eee; padding: 24px;">
                  <h2 style="color: #1a2e02;">Hola ${user.first_name || user.email},</h2>
                  <p style="font-size: 16px;">Tienes una nueva notificación en el sistema Granme:</p>
                  <table style="width:100%; margin: 16px 0; border-collapse: collapse;">
                    <tr><td style="font-weight:bold;">Título:</td><td>${notification.title}</td></tr>
                    <tr><td style="font-weight:bold;">Tipo:</td><td>${notification.type || 'General'}</td></tr>
                    <tr><td style="font-weight:bold;">Descripción:</td><td>${notification.message}</td></tr>
                    <tr><td style="font-weight:bold;">Fecha del evento:</td><td>${formattedDate}</td></tr>
                    <tr><td style="font-weight:bold;">Hora del evento:</td><td>${formattedTime}</td></tr>
                  </table>
                  ${notification.action_url ? `<div style="margin: 24px 0; text-align: center;">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}${notification.action_url}" style="background: #6b7c45; color: #fff; text-decoration: none; padding: 12px 32px; border-radius: 5px; font-weight: bold;">Ver más</a>
                  </div>` : ''}
                  <hr>
                  <small style="color: #888;">Este mensaje fue generado automáticamente por el sistema Granme.</small>
                </div>
              `;
              await emailService.sendEmail(user.email, subject, html);
            }
          } catch (emailError) {
            console.error('Error al enviar email de notificación automática:', emailError);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error generando notificaciones de partos:', error);
    }
  },

  /**
   * Generar notificaciones para celos pendientes de servicio
   */
  generateHeatNotifications: async () => {
    try {
      console.log('🌡️ Generando notificaciones de celos...');

      // Obtener celos detectados hace más de 1 día sin servicio
      const result = await pool.query(
        `SELECT h.*, s.ear_tag, s.alias, u.id as user_id
         FROM heats h
         JOIN sows s ON h.sow_id = s.id
         CROSS JOIN users u
         WHERE h.status = 'detectado'
           AND h.heat_date < NOW() - INTERVAL '1 day'
           AND h.heat_date > NOW() - INTERVAL '4 days'
           AND u.is_active = TRUE
           AND NOT EXISTS (
             SELECT 1 FROM services srv WHERE srv.heat_id = h.id
           )`
      );

      const heats = result.rows;
      console.log(`   Encontrados ${heats.length} celos sin servicio`);

      if (heats.length === 0) return;

      const notifications = [];
      for (const heat of heats) {
        // Verificar si ya existe notificación reciente (leída o no)
        const existing = await pool.query(
          `SELECT id FROM notifications 
           WHERE user_id = $1 
             AND reference_type = 'heat' 
             AND reference_id = $2 
             AND created_at > NOW() - INTERVAL '12 hours'`,
          [heat.user_id, heat.id]
        );

        if (existing.rows.length > 0) continue;

        const daysSince = Math.floor((new Date() - new Date(heat.heat_date)) / (1000 * 60 * 60 * 24));
        const sowName = heat.alias || heat.ear_tag;

        notifications.push({
          user_id: heat.user_id,
          title: '⚠️ Celo sin servicio',
          message: `La cerda ${sowName} está en celo desde hace ${daysSince} días y no ha sido servida.`,
          type: 'heat',
          priority: daysSince >= 3 ? 'high' : 'normal',
          reference_type: 'heat',
          reference_id: heat.id,
          action_url: `/heats?sow=${heat.sow_id}`,
          heat_date: heat.heat_date
        });
      }

      if (notifications.length > 0) {
        const created = await notificationModel.createBulk(notifications);
        console.log(`   ✅ Creadas ${created.length} notificaciones de celos`);
        for (let i = 0; i < created.length; i++) {
          const notification = created[i];
          const original = notifications[i];
          try {
            const user = await userModel.findById(notification.user_id);
            if (user && user.email && emailService.isAvailable()) {
              const subject = notification.title || 'Nueva notificación';
              let eventDate = null;
              if (original && original.heat_date) {
                eventDate = new Date(original.heat_date);
              }
              const pad = n => n.toString().padStart(2, '0');
              const formattedDate = eventDate ? `${eventDate.getFullYear()}/${pad(eventDate.getMonth()+1)}/${pad(eventDate.getDate())}` : 'No disponible';
              const formattedTime = eventDate ? `${pad(eventDate.getHours())}:${pad(eventDate.getMinutes())}` : 'No disponible';
              const html = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px #eee; padding: 24px;">
                  <h2 style="color: #1a2e02;">Hola ${user.first_name || user.email},</h2>
                  <p style="font-size: 16px;">Tienes una nueva notificación en el sistema Granme:</p>
                  <table style="width:100%; margin: 16px 0; border-collapse: collapse;">
                    <tr><td style="font-weight:bold;">Título:</td><td>${notification.title}</td></tr>
                    <tr><td style="font-weight:bold;">Tipo:</td><td>${notification.type || 'General'}</td></tr>
                    <tr><td style="font-weight:bold;">Descripción:</td><td>${notification.message}</td></tr>
                    <tr><td style="font-weight:bold;">Fecha del evento:</td><td>${formattedDate}</td></tr>
                    <tr><td style="font-weight:bold;">Hora del evento:</td><td>${formattedTime}</td></tr>
                  </table>
                  ${notification.action_url ? `<div style="margin: 24px 0; text-align: center;">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}${notification.action_url}" style="background: #6b7c45; color: #fff; text-decoration: none; padding: 12px 32px; border-radius: 5px; font-weight: bold;">Ver más</a>
                  </div>` : ''}
                  <hr>
                  <small style="color: #888;">Este mensaje fue generado automáticamente por el sistema Granme.</small>
                </div>
              `;
              await emailService.sendEmail(user.email, subject, html);
            }
          } catch (emailError) {
            console.error('Error al enviar email de notificación automática:', emailError);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error generando notificaciones de celos:', error);
    }
  },

  /**
   * Generar notificaciones para gestaciones pendientes de confirmación
   */
  generatePregnancyConfirmationNotifications: async () => {
    try {
      console.log('🔍 Generando notificaciones de confirmación de gestación...');

      // Obtener gestaciones pendientes de confirmación (después de 21-28 días de la concepción)
      const result = await pool.query(
        `SELECT p.*, s.ear_tag, s.alias, u.id as user_id
         FROM pregnancies p
         JOIN sows s ON p.sow_id = s.id
         CROSS JOIN users u
         WHERE p.confirmed = FALSE
           AND p.conception_date < NOW() - INTERVAL '21 days'
           AND u.is_active = TRUE`
      );

      const pregnancies = result.rows;
      console.log(`   Encontradas ${pregnancies.length} gestaciones pendientes de confirmación`);

      if (pregnancies.length === 0) return;

      const notifications = [];
      for (const preg of pregnancies) {
        // Verificar si ya existe notificación
        const existing = await pool.query(
          `SELECT id FROM notifications 
           WHERE user_id = $1 
             AND reference_type = 'pregnancy' 
             AND reference_id = $2 
             AND is_read = FALSE
             AND created_at > NOW() - INTERVAL '7 days'`,
          [preg.user_id, preg.id]
        );

        if (existing.rows.length > 0) continue;

        const daysSince = Math.floor((new Date() - new Date(preg.conception_date)) / (1000 * 60 * 60 * 24));
        const sowName = preg.alias || preg.ear_tag;

        notifications.push({
          user_id: preg.user_id,
          title: '🔍 Confirmar gestación',
          message: `La cerda ${sowName} debe ser examinada para confirmar gestación (${daysSince} días desde la concepción).`,
          type: 'pregnancy',
          priority: 'normal',
          reference_type: 'pregnancy',
          reference_id: preg.id,
          action_url: `/pregnancies/${preg.id}`,
          conception_date: preg.conception_date
        });
      }

      if (notifications.length > 0) {
        const created = await notificationModel.createBulk(notifications);
        console.log(`   ✅ Creadas ${created.length} notificaciones de confirmación`);
        for (let i = 0; i < created.length; i++) {
          const notification = created[i];
          const original = notifications[i];
          try {
            const user = await userModel.findById(notification.user_id);
            if (user && user.email && emailService.isAvailable()) {
              const subject = notification.title || 'Nueva notificación';
              let eventDate = null;
              if (original && original.conception_date) {
                eventDate = new Date(original.conception_date);
              }
              const pad = n => n.toString().padStart(2, '0');
              const formattedDate = eventDate ? `${eventDate.getFullYear()}/${pad(eventDate.getMonth()+1)}/${pad(eventDate.getDate())}` : 'No disponible';
              const formattedTime = eventDate ? `${pad(eventDate.getHours())}:${pad(eventDate.getMinutes())}` : 'No disponible';
              const html = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px #eee; padding: 24px;">
                  <h2 style="color: #1a2e02;">Hola ${user.first_name || user.email},</h2>
                  <p style="font-size: 16px;">Tienes una nueva notificación en el sistema Granme:</p>
                  <table style="width:100%; margin: 16px 0; border-collapse: collapse;">
                    <tr><td style="font-weight:bold;">Título:</td><td>${notification.title}</td></tr>
                    <tr><td style="font-weight:bold;">Tipo:</td><td>${notification.type || 'General'}</td></tr>
                    <tr><td style="font-weight:bold;">Descripción:</td><td>${notification.message}</td></tr>
                    <tr><td style="font-weight:bold;">Fecha del evento:</td><td>${formattedDate}</td></tr>
                    <tr><td style="font-weight:bold;">Hora del evento:</td><td>${formattedTime}</td></tr>
                  </table>
                  ${notification.action_url ? `<div style="margin: 24px 0; text-align: center;">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}${notification.action_url}" style="background: #6b7c45; color: #fff; text-decoration: none; padding: 12px 32px; border-radius: 5px; font-weight: bold;">Ver más</a>
                  </div>` : ''}
                  <hr>
                  <small style="color: #888;">Este mensaje fue generado automáticamente por el sistema Granme.</small>
                </div>
              `;
              await emailService.sendEmail(user.email, subject, html);
            }
          } catch (emailError) {
            console.error('Error al enviar email de notificación automática:', emailError);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error generando notificaciones de confirmación:', error);
    }
  },

  /**
   * Limpiar notificaciones antiguas
   */
  cleanupOldNotifications: async () => {
    try {
      console.log('🧹 Limpiando notificaciones antiguas...');
      
      // Eliminar notificaciones leídas de más de 30 días
      const readDeleted = await notificationModel.deleteOldRead(30);
      console.log(`   Eliminadas ${readDeleted} notificaciones leídas antiguas`);
      
      // Eliminar notificaciones expiradas
      const expiredDeleted = await notificationModel.deleteExpired();
      console.log(`   Eliminadas ${expiredDeleted} notificaciones expiradas`);
    } catch (error) {
      console.error('❌ Error limpiando notificaciones:', error);
    }
  },

  /**
   * Ejecutar todas las tareas de generación de notificaciones
   */
  runAll: async () => {
    console.log('\n🔔 === Iniciando generación de notificaciones === ');
    const startTime = Date.now();

    await notificationJob.generateCalendarNotifications();
    await notificationJob.generateBirthNotifications();
    await notificationJob.generateHeatNotifications();
    await notificationJob.generatePregnancyConfirmationNotifications();
    await notificationJob.cleanupOldNotifications();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ === Notificaciones generadas en ${duration}s ===\n`);
  },

  /**
   * Iniciar job con cron (cada 6 horas)
   */
  start: () => {
    // NO ejecutar inmediatamente al iniciar para evitar duplicados
    // Si necesitas ejecutar manualmente, usa el endpoint POST /api/notifications/generate

    // Ejecutar cada minuto: * * * * *
    const schedule = '* * * * *'; // Cada minuto

    cron.schedule(schedule, () => {
      notificationJob.runAll();
    });

    console.log('✅ Job de notificaciones configurado (cada 10 minutos)');
    console.log('💡 Próxima ejecución automática según el cron schedule');
  }
};

module.exports = { notificationJob };


