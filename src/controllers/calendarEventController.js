const calendarEventModel = require('../models/calendarEventModel');
const notificationModel = require('../models/notificationModel');

const calendarEventController = {
  // GET /api/calendar-events - Obtener todos los eventos
  getAll: async (req, res) => {
    try {
      const filters = {
        status: req.query.status,
        event_type: req.query.event_type,
        start_date: req.query.start_date,
        end_date: req.query.end_date
      };

      // Remover filtros undefined
      Object.keys(filters).forEach(key => {
        if (filters[key] === undefined) delete filters[key];
      });

      const events = await calendarEventModel.getAll(filters);
      
      res.json({
        success: true,
        count: events.length,
        data: events
      });
    } catch (error) {
      console.error('Error al obtener eventos:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener eventos del calendario',
        error: error.message
      });
    }
  },

  // GET /api/calendar-events/month/:year/:month - Obtener eventos de un mes
  getByMonth: async (req, res) => {
    try {
      const { year, month } = req.params;
      const events = await calendarEventModel.getByMonth(parseInt(year), parseInt(month));
      
      res.json({
        success: true,
        count: events.length,
        data: events
      });
    } catch (error) {
      console.error('Error al obtener eventos del mes:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener eventos del mes',
        error: error.message
      });
    }
  },

  // GET /api/calendar-events/upcoming - Obtener eventos próximos
  getUpcoming: async (req, res) => {
    try {
      const days = parseInt(req.query.days) || 7;
      const events = await calendarEventModel.getUpcoming(days);
      
      res.json({
        success: true,
        count: events.length,
        data: events
      });
    } catch (error) {
      console.error('Error al obtener eventos próximos:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener eventos próximos',
        error: error.message
      });
    }
  },

  // GET /api/calendar-events/:id - Obtener un evento por ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const event = await calendarEventModel.getById(id);

      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Evento no encontrado'
        });
      }

      res.json({
        success: true,
        data: event
      });
    } catch (error) {
      console.error('Error al obtener evento:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener evento',
        error: error.message
      });
    }
  },

  // POST /api/calendar-events - Crear un nuevo evento
  create: async (req, res) => {
    try {
      const {
        title, event_date, event_type, description, notes,
        status, reminder_days
      } = req.body;

      // Validaciones
      if (!title || !event_date) {
        return res.status(400).json({
          success: false,
          message: 'Faltan campos obligatorios: title, event_date'
        });
      }

      const eventData = {
        title,
        event_date,
        event_type: event_type || 'custom',
        description,
        notes,
        status: status || 'pending',
        reminder_days: reminder_days || 0,
        created_by: req.user?.id
      };

      const newEvent = await calendarEventModel.create(eventData);

      res.status(201).json({
        success: true,
        message: 'Evento creado exitosamente',
        data: newEvent
      });
    } catch (error) {
      console.error('Error al crear evento:', error);
      res.status(500).json({
        success: false,
        message: 'Error al crear evento',
        error: error.message
      });
    }
  },

  // PUT /api/calendar-events/:id - Actualizar un evento
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const {
        title, event_date, event_type, description, notes,
        status, reminder_days
      } = req.body;

      // Verificar que el evento existe
      const existingEvent = await calendarEventModel.getById(id);
      if (!existingEvent) {
        return res.status(404).json({
          success: false,
          message: 'Evento no encontrado'
        });
      }

      // Validaciones
      if (!title || !event_date) {
        return res.status(400).json({
          success: false,
          message: 'Faltan campos obligatorios: title, event_date'
        });
      }

      const eventData = {
        title,
        event_date,
        event_type,
        description,
        notes,
        status,
        reminder_days,
        updated_by: req.user?.id
      };

      const updatedEvent = await calendarEventModel.update(id, eventData);

      res.json({
        success: true,
        message: 'Evento actualizado exitosamente',
        data: updatedEvent
      });
    } catch (error) {
      console.error('Error al actualizar evento:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar evento',
        error: error.message
      });
    }
  },

  // DELETE /api/calendar-events/:id - Eliminar un evento
  delete: async (req, res) => {
    try {
      const { id } = req.params;

      // Verificar que el evento existe
      const existingEvent = await calendarEventModel.getById(id);
      if (!existingEvent) {
        return res.status(404).json({
          success: false,
          message: 'Evento no encontrado'
        });
      }

      // Eliminar el evento
      await calendarEventModel.delete(id);

      // Eliminar notificaciones asociadas al evento
      await notificationModel.deleteByReference('calendar_event', id);

      res.json({
        success: true,
        message: 'Evento eliminado exitosamente'
      });
    } catch (error) {
      console.error('Error al eliminar evento:', error);
      res.status(500).json({
        success: false,
        message: 'Error al eliminar evento',
        error: error.message
      });
    }
  }
};

module.exports = calendarEventController;

