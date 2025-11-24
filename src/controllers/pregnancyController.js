const pregnancyModel = require('../models/pregnancyModel');
const sowModel = require('../models/sowModel');
const serviceModel = require('../models/serviceModel');
const { canRegisterPregnancy } = require('../utils/reproductiveValidations');

const pregnancyController = {
  // GET /api/pregnancies - Obtener todas las gestaciones con filtros opcionales
  getAll: async (req, res) => {
    try {
      const filters = {
        sow_id: req.query.sow_id,
        status: req.query.status,
        confirmed: req.query.confirmed,
        confirmation_method: req.query.confirmation_method,
        conception_date_from: req.query.conception_date_from,
        conception_date_to: req.query.conception_date_to,
        expected_farrowing_from: req.query.expected_farrowing_from,
        expected_farrowing_to: req.query.expected_farrowing_to,
        farm_name: req.query.farm_name
      };

      // Remover filtros undefined
      Object.keys(filters).forEach(key => {
        if (filters[key] === undefined) delete filters[key];
      });

      // Convertir confirmed a booleano si existe
      if (filters.confirmed !== undefined) {
        filters.confirmed = filters.confirmed === 'true' || filters.confirmed === true;
      }

      const pregnancies = await pregnancyModel.getAll(filters);
      
      res.json({
        success: true,
        count: pregnancies.length,
        data: pregnancies
      });
    } catch (error) {
      console.error('Error al obtener gestaciones:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener gestaciones',
        error: error.message
      });
    }
  },

  // GET /api/pregnancies/stats - Obtener estadísticas de gestaciones
  getStats: async (req, res) => {
    try {
      const filters = {
        date_from: req.query.date_from,
        date_to: req.query.date_to
      };

      Object.keys(filters).forEach(key => {
        if (filters[key] === undefined) delete filters[key];
      });

      const stats = await pregnancyModel.getStats(filters);
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener estadísticas',
        error: error.message
      });
    }
  },

  // GET /api/pregnancies/upcoming - Obtener gestaciones próximas a parto
  getUpcoming: async (req, res) => {
    try {
      const daysAhead = parseInt(req.query.days) || 7;
      const upcomingFarrowings = await pregnancyModel.getUpcomingFarrowings(daysAhead);
      
      res.json({
        success: true,
        count: upcomingFarrowings.length,
        data: upcomingFarrowings
      });
    } catch (error) {
      console.error('Error al obtener gestaciones próximas:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener gestaciones próximas',
        error: error.message
      });
    }
  },

  // GET /api/pregnancies/overdue - Obtener gestaciones vencidas
  getOverdue: async (req, res) => {
    try {
      const overduePregnancies = await pregnancyModel.getOverduePregnancies();
      
      res.json({
        success: true,
        count: overduePregnancies.length,
        data: overduePregnancies
      });
    } catch (error) {
      console.error('Error al obtener gestaciones vencidas:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener gestaciones vencidas',
        error: error.message
      });
    }
  },

  // GET /api/pregnancies/pending-confirmation - Obtener gestaciones pendientes de confirmación
  getPendingConfirmation: async (req, res) => {
    try {
      const pendingPregnancies = await pregnancyModel.getPendingConfirmation();
      
      res.json({
        success: true,
        count: pendingPregnancies.length,
        data: pendingPregnancies
      });
    } catch (error) {
      console.error('Error al obtener gestaciones pendientes:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener gestaciones pendientes',
        error: error.message
      });
    }
  },

  // GET /api/pregnancies/:id - Obtener una gestación por ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const pregnancy = await pregnancyModel.getById(id);
      
      if (!pregnancy) {
        return res.status(404).json({
          success: false,
          message: 'Gestación no encontrada'
        });
      }

      res.json({
        success: true,
        data: pregnancy
      });
    } catch (error) {
      console.error('Error al obtener gestación:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener gestación',
        error: error.message
      });
    }
  },

  // GET /api/pregnancies/sow/:sowId - Obtener gestaciones de una cerda
  getBySowId: async (req, res) => {
    try {
      const { sowId } = req.params;
      
      // Verificar que la cerda existe
      const sow = await sowModel.getById(sowId);
      if (!sow) {
        return res.status(404).json({
          success: false,
          message: 'Cerda no encontrada'
        });
      }

      const pregnancies = await pregnancyModel.getBySowId(sowId);
      
      res.json({
        success: true,
        count: pregnancies.length,
        data: pregnancies,
        sow: {
          id: sow.id,
          ear_tag: sow.ear_tag,
          alias: sow.alias
        }
      });
    } catch (error) {
      console.error('Error al obtener gestaciones de cerda:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener gestaciones de cerda',
        error: error.message
      });
    }
  },

  // GET /api/pregnancies/sow/:sowId/active - Obtener gestación activa de una cerda
  getActiveBySowId: async (req, res) => {
    try {
      const { sowId } = req.params;
      
      const pregnancy = await pregnancyModel.getActiveBySowId(sowId);
      
      if (!pregnancy) {
        return res.status(404).json({
          success: false,
          message: 'No se encontró gestación activa para esta cerda'
        });
      }

      res.json({
        success: true,
        data: pregnancy
      });
    } catch (error) {
      console.error('Error al obtener gestación activa:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener gestación activa',
        error: error.message
      });
    }
  },

  // POST /api/pregnancies - Crear un nuevo registro de gestación
  create: async (req, res) => {
    try {
      const pregnancyData = req.body;

      // Validaciones obligatorias
      const requiredFields = ['sow_id', 'service_id', 'conception_date'];
      const missingFields = requiredFields.filter(field => !pregnancyData[field]);

      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Faltan campos obligatorios: ${missingFields.join(', ')}`
        });
      }

      // Verificar que la cerda existe y está activa
      const sow = await sowModel.getById(pregnancyData.sow_id);
      if (!sow) {
        return res.status(404).json({
          success: false,
          message: 'Cerda no encontrada'
        });
      }

      if (sow.status !== 'activa') {
        return res.status(400).json({
          success: false,
          message: 'La cerda no está activa'
        });
      }

      // Verificar que no tenga una gestación activa
      const activePregnancy = await pregnancyModel.getActiveBySowId(pregnancyData.sow_id);
      if (activePregnancy) {
        return res.status(400).json({
          success: false,
          message: 'La cerda ya tiene una gestación activa'
        });
      }

      // Verificar que el servicio existe
      const service = await serviceModel.getById(pregnancyData.service_id);
      if (!service) {
        return res.status(404).json({
          success: false,
          message: 'Servicio no encontrado'
        });
      }

      // Verificar que el servicio es de la misma cerda
      if (service.sow_id !== pregnancyData.sow_id) {
        return res.status(400).json({
          success: false,
          message: 'El servicio no corresponde a la cerda seleccionada'
        });
      }

      // VALIDACIONES REPRODUCTIVAS
      const validation = await canRegisterPregnancy(
        pregnancyData.sow_id, 
        pregnancyData.service_id, 
        pregnancyData.conception_date
      );

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: 'No se puede registrar la gestación',
          errors: validation.errors,
          warnings: validation.warnings
        });
      }

      // Si hay advertencias pero es válido, incluirlas en la respuesta
      const responseWarnings = validation.warnings.length > 0 ? validation.warnings : undefined;

      // Validar fecha de concepción
      if (new Date(pregnancyData.conception_date) > new Date()) {
        return res.status(400).json({
          success: false,
          message: 'La fecha de concepción no puede ser futura'
        });
      }

      // Validar que si está confirmada, tenga método y fecha de confirmación
      if (pregnancyData.confirmed === true || pregnancyData.confirmed === 'true') {
        if (!pregnancyData.confirmation_method) {
          return res.status(400).json({
            success: false,
            message: 'Para confirmar la gestación se requiere el método de confirmación'
          });
        }
        if (!pregnancyData.confirmation_date) {
          return res.status(400).json({
            success: false,
            message: 'Para confirmar la gestación se requiere la fecha de confirmación'
          });
        }
      }

      // Sanitizar campos booleanos
      pregnancyData.confirmed = Boolean(pregnancyData.confirmed);

      // Sanitizar campos numéricos
      if (pregnancyData.ultrasound_count !== undefined && pregnancyData.ultrasound_count !== null && pregnancyData.ultrasound_count !== '') {
        pregnancyData.ultrasound_count = parseInt(pregnancyData.ultrasound_count);
      } else {
        pregnancyData.ultrasound_count = 0;
      }

      if (pregnancyData.estimated_piglets !== undefined && pregnancyData.estimated_piglets !== null && pregnancyData.estimated_piglets !== '') {
        pregnancyData.estimated_piglets = parseInt(pregnancyData.estimated_piglets);
      } else {
        pregnancyData.estimated_piglets = null;
      }

      // Sanitizar campos de fecha opcionales
      const dateFields = ['expected_farrowing_date', 'confirmation_date', 'last_ultrasound_date'];
      dateFields.forEach(field => {
        if (pregnancyData[field] === '' || pregnancyData[field] === null || pregnancyData[field] === undefined) {
          pregnancyData[field] = null;
        }
      });

      // Agregar usuario que creó el registro
      if (req.user) {
        pregnancyData.created_by = req.user.email;
      }

      const newPregnancy = await pregnancyModel.create(pregnancyData);

      // Actualizar estado reproductivo de la cerda solo si está confirmada
      if (pregnancyData.confirmed) {
        await sowModel.partialUpdate(pregnancyData.sow_id, {
          reproductive_status: 'gestante',
          expected_farrowing_date: newPregnancy.expected_farrowing_date
        });
      }
      
      res.status(201).json({
        success: true,
        message: 'Gestación registrada exitosamente',
        data: newPregnancy,
        warnings: responseWarnings
      });
    } catch (error) {
      console.error('Error al crear gestación:', error);
      
      // Manejar errores de constraint de base de datos
      if (error.code === '23503') { // foreign_key_violation
        return res.status(400).json({
          success: false,
          message: 'La cerda o el servicio no existen'
        });
      }
      
      if (error.code === '23505') { // unique_violation
        return res.status(400).json({
          success: false,
          message: 'La cerda ya tiene una gestación activa'
        });
      }
      
      if (error.code === '23514') { // check_violation
        return res.status(400).json({
          success: false,
          message: 'Datos inválidos: verifique los valores de los campos',
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error al crear gestación',
        error: error.message
      });
    }
  },

  // PUT /api/pregnancies/:id - Actualizar una gestación
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const pregnancyData = req.body;

      // Verificar que la gestación existe
      const existingPregnancy = await pregnancyModel.getById(id);
      if (!existingPregnancy) {
        return res.status(404).json({
          success: false,
          message: 'Gestación no encontrada'
        });
      }

      // No permitir editar si ya está finalizada
      if (existingPregnancy.status === 'finalizada parto' || existingPregnancy.status === 'finalizada aborto') {
        return res.status(403).json({
          success: false,
          message: 'No se puede modificar una gestación finalizada'
        });
      }

      // Validar que si está confirmada, tenga método y fecha de confirmación
      if (pregnancyData.confirmed === true || pregnancyData.confirmed === 'true') {
        if (!pregnancyData.confirmation_method) {
          return res.status(400).json({
            success: false,
            message: 'Para confirmar la gestación se requiere el método de confirmación'
          });
        }
        if (!pregnancyData.confirmation_date) {
          return res.status(400).json({
            success: false,
            message: 'Para confirmar la gestación se requiere la fecha de confirmación'
          });
        }
      }

      // Sanitizar campos booleanos
      pregnancyData.confirmed = Boolean(pregnancyData.confirmed);

      // Sanitizar campos numéricos
      if (pregnancyData.ultrasound_count !== undefined && pregnancyData.ultrasound_count !== null && pregnancyData.ultrasound_count !== '') {
        pregnancyData.ultrasound_count = parseInt(pregnancyData.ultrasound_count);
      }

      if (pregnancyData.estimated_piglets !== undefined && pregnancyData.estimated_piglets !== null && pregnancyData.estimated_piglets !== '') {
        pregnancyData.estimated_piglets = parseInt(pregnancyData.estimated_piglets);
      } else {
        pregnancyData.estimated_piglets = null;
      }

      // Sanitizar campos de fecha opcionales
      const dateFields = ['expected_farrowing_date', 'confirmation_date', 'last_ultrasound_date'];
      dateFields.forEach(field => {
        if (pregnancyData[field] === '' || pregnancyData[field] === null || pregnancyData[field] === undefined) {
          pregnancyData[field] = null;
        }
      });

      // Agregar usuario que actualizó
      if (req.user) {
        pregnancyData.updated_by = req.user.email;
      }

      const updatedPregnancy = await pregnancyModel.update(id, pregnancyData);

      // Actualizar estado reproductivo de la cerda según confirmación
      if (pregnancyData.confirmed && !existingPregnancy.confirmed) {
        // Se confirmó la gestación → cerda gestante
        await sowModel.partialUpdate(existingPregnancy.sow_id, {
          reproductive_status: 'gestante',
          expected_farrowing_date: updatedPregnancy.expected_farrowing_date
        });
      } else if (!pregnancyData.confirmed && existingPregnancy.confirmed) {
        // Se desconfirmó la gestación → revertir a estado anterior
        // Verificar si tiene otras gestaciones confirmadas
        const activePregnancy = await pregnancyModel.getActiveBySowId(existingPregnancy.sow_id);
        if (!activePregnancy || activePregnancy.id === parseInt(id)) {
          // No tiene otras gestaciones confirmadas → volver a vacía
          await sowModel.partialUpdate(existingPregnancy.sow_id, {
            reproductive_status: 'vacia',
            expected_farrowing_date: null
          });
        }
      }

      res.json({
        success: true,
        message: 'Gestación actualizada exitosamente',
        data: updatedPregnancy
      });
    } catch (error) {
      console.error('Error al actualizar gestación:', error);
      
      if (error.code === '23514') {
        return res.status(400).json({
          success: false,
          message: 'Datos inválidos: verifique los valores de los campos',
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error al actualizar gestación',
        error: error.message
      });
    }
  },

  // PATCH /api/pregnancies/:id/status - Actualizar solo el estado de la gestación
  updateStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;

      if (!status) {
        return res.status(400).json({
          success: false,
          message: 'El estado es obligatorio'
        });
      }

      // Verificar que la gestación existe
      const existingPregnancy = await pregnancyModel.getById(id);
      if (!existingPregnancy) {
        return res.status(404).json({
          success: false,
          message: 'Gestación no encontrada'
        });
      }

      // Validar transiciones de estado
      const validStates = ['en curso', 'finalizada parto', 'finalizada aborto', 'no confirmada'];
      if (!validStates.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Estado inválido'
        });
      }

      const updated_by = req.user ? req.user.email : null;
      const updatedPregnancy = await pregnancyModel.updateStatus(id, status, notes, updated_by);

      res.json({
        success: true,
        message: 'Estado de la gestación actualizado exitosamente',
        data: updatedPregnancy
      });
    } catch (error) {
      console.error('Error al actualizar estado:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar estado',
        error: error.message
      });
    }
  },

  // PATCH /api/pregnancies/:id/confirm - Confirmar gestación
  confirmPregnancy: async (req, res) => {
    try {
      const { id } = req.params;
      const confirmationData = req.body;

      // Verificar que la gestación existe
      const existingPregnancy = await pregnancyModel.getById(id);
      if (!existingPregnancy) {
        return res.status(404).json({
          success: false,
          message: 'Gestación no encontrada'
        });
      }

      // Verificar que no esté ya confirmada
      if (existingPregnancy.confirmed) {
        return res.status(400).json({
          success: false,
          message: 'La gestación ya está confirmada'
        });
      }

      // Validar campos obligatorios
      if (!confirmationData.confirmation_date) {
        return res.status(400).json({
          success: false,
          message: 'La fecha de confirmación es obligatoria'
        });
      }

      if (!confirmationData.confirmation_method) {
        return res.status(400).json({
          success: false,
          message: 'El método de confirmación es obligatorio'
        });
      }

      // Sanitizar campos numéricos
      if (confirmationData.estimated_piglets !== undefined && confirmationData.estimated_piglets !== null && confirmationData.estimated_piglets !== '') {
        confirmationData.estimated_piglets = parseInt(confirmationData.estimated_piglets);
      } else {
        confirmationData.estimated_piglets = null;
      }

      // Agregar usuario
      if (req.user) {
        confirmationData.updated_by = req.user.email;
      }

      const updatedPregnancy = await pregnancyModel.confirmPregnancy(id, confirmationData);

      // Actualizar estado reproductivo de la cerda
      await sowModel.partialUpdate(existingPregnancy.sow_id, {
        reproductive_status: 'gestante',
        expected_farrowing_date: updatedPregnancy.expected_farrowing_date
      });

      res.json({
        success: true,
        message: 'Gestación confirmada exitosamente',
        data: updatedPregnancy
      });
    } catch (error) {
      console.error('Error al confirmar gestación:', error);
      res.status(500).json({
        success: false,
        message: 'Error al confirmar gestación',
        error: error.message
      });
    }
  },

  // PATCH /api/pregnancies/:id - Actualizar campos específicos
  partialUpdate: async (req, res) => {
    try {
      const { id } = req.params;
      const pregnancyData = req.body;

      // Verificar que la gestación existe
      const existingPregnancy = await pregnancyModel.getById(id);
      if (!existingPregnancy) {
        return res.status(404).json({
          success: false,
          message: 'Gestación no encontrada'
        });
      }

      // No permitir editar si ya está finalizada
      if ((existingPregnancy.status === 'finalizada parto' || existingPregnancy.status === 'finalizada aborto') 
          && Object.keys(pregnancyData).some(key => key !== 'notes')) {
        return res.status(403).json({
          success: false,
          message: `Solo se pueden agregar notas a una gestación finalizada`
        });
      }

      // Sanitizar campos booleanos
      if (pregnancyData.hasOwnProperty('confirmed')) {
        pregnancyData.confirmed = Boolean(pregnancyData.confirmed);
      }

      // Sanitizar campos numéricos
      if (pregnancyData.hasOwnProperty('ultrasound_count')) {
        if (pregnancyData.ultrasound_count !== null && pregnancyData.ultrasound_count !== '' && pregnancyData.ultrasound_count !== undefined) {
          pregnancyData.ultrasound_count = parseInt(pregnancyData.ultrasound_count);
        }
      }

      if (pregnancyData.hasOwnProperty('estimated_piglets')) {
        if (pregnancyData.estimated_piglets !== null && pregnancyData.estimated_piglets !== '' && pregnancyData.estimated_piglets !== undefined) {
          pregnancyData.estimated_piglets = parseInt(pregnancyData.estimated_piglets);
        } else {
          pregnancyData.estimated_piglets = null;
        }
      }

      // Sanitizar campos de fecha
      const dateFields = ['conception_date', 'expected_farrowing_date', 'confirmation_date', 'last_ultrasound_date'];
      dateFields.forEach(field => {
        if (pregnancyData.hasOwnProperty(field)) {
          if (pregnancyData[field] === '' || pregnancyData[field] === null || pregnancyData[field] === undefined) {
            pregnancyData[field] = null;
          }
        }
      });

      // Agregar usuario
      if (req.user) {
        pregnancyData.updated_by = req.user.email;
      }

      const updatedPregnancy = await pregnancyModel.partialUpdate(id, pregnancyData);

      res.json({
        success: true,
        message: 'Gestación actualizada exitosamente',
        data: updatedPregnancy
      });
    } catch (error) {
      console.error('Error al actualizar gestación:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar gestación',
        error: error.message
      });
    }
  },

  // DELETE /api/pregnancies/:id - Eliminar una gestación
  delete: async (req, res) => {
    try {
      const { id } = req.params;
      
      // Verificar que la gestación existe
      const existingPregnancy = await pregnancyModel.getById(id);
      if (!existingPregnancy) {
        return res.status(404).json({
          success: false,
          message: 'Gestación no encontrada'
        });
      }

      // No permitir eliminar si ya está finalizada
      if (existingPregnancy.status === 'finalizada parto' || existingPregnancy.status === 'finalizada aborto') {
        return res.status(400).json({
          success: false,
          message: `No se puede eliminar una gestación con estado "${existingPregnancy.status}"`
        });
      }

      const deletedPregnancy = await pregnancyModel.delete(id);
      
      // Si la cerda estaba en estado gestante, cambiarla a vacía
      if (existingPregnancy.confirmed) {
        await sowModel.partialUpdate(existingPregnancy.sow_id, {
          reproductive_status: 'vacia',
          expected_farrowing_date: null
        });
      }

      res.json({
        success: true,
        message: 'Gestación eliminada exitosamente',
        data: deletedPregnancy
      });
    } catch (error) {
      console.error('Error al eliminar gestación:', error);
      
      // Si hay constraint de foreign key (partos o abortos asociados)
      if (error.code === '23503') {
        return res.status(400).json({
          success: false,
          message: 'No se puede eliminar la gestación porque tiene partos o abortos asociados'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error al eliminar gestación',
        error: error.message
      });
    }
  }
};

module.exports = pregnancyController;
