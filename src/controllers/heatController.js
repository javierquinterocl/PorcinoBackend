const heatModel = require('../models/heatModel');
const sowModel = require('../models/sowModel');
const { canRegisterHeat, canInduceHeat } = require('../utils/reproductiveValidations');

const heatController = {
  // GET /api/heats - Obtener todos los celos con filtros opcionales
  getAll: async (req, res) => {
    try {
      const filters = {
        sow_id: req.query.sow_id,
        status: req.query.status,
        heat_type: req.query.heat_type,
        intensity: req.query.intensity,
        date_from: req.query.date_from,
        date_to: req.query.date_to,
        farm_name: req.query.farm_name
      };

      // Remover filtros undefined
      Object.keys(filters).forEach(key => {
        if (filters[key] === undefined) delete filters[key];
      });

      const heats = await heatModel.getAll(filters);
      
      res.json({
        success: true,
        count: heats.length,
        data: heats
      });
    } catch (error) {
      console.error('Error al obtener celos:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener celos',
        error: error.message
      });
    }
  },

  // GET /api/heats/stats - Obtener estadísticas de celos
  getStats: async (req, res) => {
    try {
      const filters = {
        date_from: req.query.date_from,
        date_to: req.query.date_to
      };

      Object.keys(filters).forEach(key => {
        if (filters[key] === undefined) delete filters[key];
      });

      const stats = await heatModel.getStats(filters);
      
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

  // GET /api/heats/pending - Obtener celos pendientes de servicio
  getPending: async (req, res) => {
    try {
      const pendingHeats = await heatModel.getPendingHeats();
      
      res.json({
        success: true,
        count: pendingHeats.length,
        data: pendingHeats
      });
    } catch (error) {
      console.error('Error al obtener celos pendientes:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener celos pendientes',
        error: error.message
      });
    }
  },

  // GET /api/heats/:id - Obtener un celo por ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const heat = await heatModel.getById(id);
      
      if (!heat) {
        return res.status(404).json({
          success: false,
          message: 'Celo no encontrado'
        });
      }

      res.json({
        success: true,
        data: heat
      });
    } catch (error) {
      console.error('Error al obtener celo:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener celo',
        error: error.message
      });
    }
  },

  // GET /api/heats/sow/:sowId - Obtener celos de una cerda
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

      const heats = await heatModel.getBySowId(sowId);
      
      res.json({
        success: true,
        count: heats.length,
        data: heats,
        sow: {
          id: sow.id,
          ear_tag: sow.ear_tag,
          alias: sow.alias
        }
      });
    } catch (error) {
      console.error('Error al obtener celos de cerda:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener celos de cerda',
        error: error.message
      });
    }
  },

  // GET /api/heats/sow/:sowId/last - Obtener último celo de una cerda
  getLastBySowId: async (req, res) => {
    try {
      const { sowId } = req.params;
      
      const heat = await heatModel.getLastBySowId(sowId);
      
      if (!heat) {
        return res.status(404).json({
          success: false,
          message: 'No se encontraron celos para esta cerda'
        });
      }

      res.json({
        success: true,
        data: heat
      });
    } catch (error) {
      console.error('Error al obtener último celo:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener último celo',
        error: error.message
      });
    }
  },

  // POST /api/heats - Crear un nuevo registro de celo
  create: async (req, res) => {
    try {
      const heatData = req.body;

      // Validaciones obligatorias
      const requiredFields = ['sow_id', 'heat_date'];
      const missingFields = requiredFields.filter(field => !heatData[field]);

      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Faltan campos obligatorios: ${missingFields.join(', ')}`
        });
      }

      // Verificar que la cerda existe y está activa
      const sow = await sowModel.getById(heatData.sow_id);
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

      // Validar que si es inducido, tenga protocolo y fecha
      if (heatData.heat_type === 'inducido') {
        if (!heatData.induction_protocol || !heatData.induction_date) {
          return res.status(400).json({
            success: false,
            message: 'Para celos inducidos se requiere protocolo y fecha de inducción'
          });
        }
      }

      // VALIDACIONES REPRODUCTIVAS
      const validation = heatData.heat_type === 'inducido' 
        ? await canInduceHeat(heatData.sow_id, heatData.heat_date)
        : await canRegisterHeat(heatData.sow_id, heatData.heat_date);

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: 'No se puede registrar el celo',
          errors: validation.errors,
          warnings: validation.warnings
        });
      }

      // Si hay advertencias pero es válido, incluirlas en la respuesta
      const responseWarnings = validation.warnings.length > 0 ? validation.warnings : undefined;

      // Sanitizar campos booleanos
      const booleanFields = [
        'standing_reflex', 'vulva_swelling', 'vulva_discharge', 'mounting_behavior',
        'restlessness', 'loss_of_appetite', 'vocalization', 'ear_erection',
        'tail_deviation', 'frequent_urination', 'sniffing_genital', 'back_arching'
      ];
      
      booleanFields.forEach(field => {
        if (heatData[field] !== undefined) {
          heatData[field] = Boolean(heatData[field]);
        }
      });

      // Sanitizar campos numéricos
      if (heatData.duration_hours !== undefined && heatData.duration_hours !== null && heatData.duration_hours !== '') {
        heatData.duration_hours = parseFloat(heatData.duration_hours);
      } else {
        heatData.duration_hours = null;
      }

      if (heatData.boar_detector_id !== undefined && heatData.boar_detector_id !== null && heatData.boar_detector_id !== '') {
        heatData.boar_detector_id = parseInt(heatData.boar_detector_id);
      } else {
        heatData.boar_detector_id = null;
      }

      // Sanitizar campos de fecha/hora
      const dateTimeFields = ['heat_end_date', 'induction_date', 'peak_estrus_date', 'detection_time', 'peak_estrus_time'];
      dateTimeFields.forEach(field => {
        if (heatData[field] === '' || heatData[field] === null || heatData[field] === undefined) {
          heatData[field] = null;
        }
      });

      // Agregar usuario que creó el registro
      if (req.user) {
        heatData.created_by = req.user.email;
      }

      const newHeat = await heatModel.create(heatData);

      // Actualizar estado reproductivo de la cerda
      await sowModel.partialUpdate(heatData.sow_id, {
        reproductive_status: 'en celo'
      });
      
      res.status(201).json({
        success: true,
        message: 'Celo registrado exitosamente',
        data: newHeat,
        warnings: responseWarnings
      });
    } catch (error) {
      console.error('Error al crear celo:', error);
      
      // Manejar errores de constraint de base de datos
      if (error.code === '23503') { // foreign_key_violation
        return res.status(400).json({
          success: false,
          message: 'La cerda o el verraco detector no existen'
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
        message: 'Error al crear celo',
        error: error.message
      });
    }
  },

  // PUT /api/heats/:id - Actualizar un celo (solo si no está servido)
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const heatData = req.body;

      // Verificar que el celo existe
      const existingHeat = await heatModel.getById(id);
      if (!existingHeat) {
        return res.status(404).json({
          success: false,
          message: 'Celo no encontrado'
        });
      }

      // Validar que el celo no esté servido o cancelado (política: celos servidos/cancelados no se editan)
      if (existingHeat.status === 'servido') {
        return res.status(403).json({
          success: false,
          message: 'No se puede modificar un celo que ya fue servido. Los celos servidos son registros históricos.'
        });
      }

      if (existingHeat.status === 'cancelado') {
        return res.status(403).json({
          success: false,
          message: 'No se puede modificar un celo cancelado. Los celos cancelados son registros históricos.'
        });
      }

      // Sanitizar campos booleanos
      const booleanFields = [
        'standing_reflex', 'vulva_swelling', 'vulva_discharge', 'mounting_behavior',
        'restlessness', 'loss_of_appetite', 'vocalization', 'ear_erection',
        'tail_deviation', 'frequent_urination', 'sniffing_genital', 'back_arching'
      ];
      
      booleanFields.forEach(field => {
        if (heatData[field] !== undefined) {
          heatData[field] = Boolean(heatData[field]);
        }
      });

      // Sanitizar campos numéricos
      if (heatData.duration_hours !== undefined && heatData.duration_hours !== null && heatData.duration_hours !== '') {
        heatData.duration_hours = parseFloat(heatData.duration_hours);
      } else {
        heatData.duration_hours = null;
      }

      if (heatData.boar_detector_id !== undefined && heatData.boar_detector_id !== null && heatData.boar_detector_id !== '') {
        heatData.boar_detector_id = parseInt(heatData.boar_detector_id);
      } else {
        heatData.boar_detector_id = null;
      }

      // Sanitizar campos de fecha/hora
      const dateTimeFields = ['heat_end_date', 'induction_date', 'peak_estrus_date', 'detection_time', 'peak_estrus_time'];
      dateTimeFields.forEach(field => {
        if (heatData[field] === '' || heatData[field] === null || heatData[field] === undefined) {
          heatData[field] = null;
        }
      });

      const updatedHeat = await heatModel.update(id, heatData);

      res.json({
        success: true,
        message: 'Celo actualizado exitosamente',
        data: updatedHeat
      });
    } catch (error) {
      console.error('Error al actualizar celo:', error);
      
      if (error.code === '23514') {
        return res.status(400).json({
          success: false,
          message: 'Datos inválidos: verifique los valores de los campos',
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error al actualizar celo',
        error: error.message
      });
    }
  },

  // PATCH /api/heats/:id/status - Actualizar solo el estado del celo
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

      // Verificar que el celo existe
      const existingHeat = await heatModel.getById(id);
      if (!existingHeat) {
        return res.status(404).json({
          success: false,
          message: 'Celo no encontrado'
        });
      }

      // Validar transiciones de estado
      const validTransitions = {
        'detectado': ['servido', 'no servido', 'cancelado'],
        'servido': [], // No se puede cambiar una vez servido
        'no servido': ['detectado', 'cancelado'],
        'cancelado': []
      };

      const allowedStates = validTransitions[existingHeat.status] || [];
      
      if (!allowedStates.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `No se puede cambiar el estado de '${existingHeat.status}' a '${status}'`
        });
      }

      const updatedHeat = await heatModel.updateStatus(id, status, notes);

      res.json({
        success: true,
        message: 'Estado del celo actualizado exitosamente',
        data: updatedHeat
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

  // PATCH /api/heats/:id - Actualizar campos específicos
  partialUpdate: async (req, res) => {
    try {
      const { id } = req.params;
      const heatData = req.body;

      // Verificar que el celo existe
      const existingHeat = await heatModel.getById(id);
      if (!existingHeat) {
        return res.status(404).json({
          success: false,
          message: 'Celo no encontrado'
        });
      }

      // Validar que el celo no esté servido o cancelado
      if ((existingHeat.status === 'servido' || existingHeat.status === 'cancelado') && Object.keys(heatData).some(key => key !== 'notes')) {
        return res.status(403).json({
          success: false,
          message: `Solo se pueden agregar notas a un celo ${existingHeat.status}`
        });
      }

      // Sanitizar campos booleanos
      const booleanFields = [
        'standing_reflex', 'vulva_swelling', 'vulva_discharge', 'mounting_behavior',
        'restlessness', 'loss_of_appetite', 'vocalization', 'ear_erection',
        'tail_deviation', 'frequent_urination', 'sniffing_genital', 'back_arching'
      ];
      
      booleanFields.forEach(field => {
        if (heatData.hasOwnProperty(field)) {
          heatData[field] = Boolean(heatData[field]);
        }
      });

      // Sanitizar campos numéricos
      if (heatData.hasOwnProperty('duration_hours')) {
        if (heatData.duration_hours !== null && heatData.duration_hours !== '' && heatData.duration_hours !== undefined) {
          heatData.duration_hours = parseFloat(heatData.duration_hours);
        } else {
          heatData.duration_hours = null;
        }
      }

      if (heatData.hasOwnProperty('boar_detector_id')) {
        if (heatData.boar_detector_id !== null && heatData.boar_detector_id !== '' && heatData.boar_detector_id !== undefined) {
          heatData.boar_detector_id = parseInt(heatData.boar_detector_id);
        } else {
          heatData.boar_detector_id = null;
        }
      }

      // Sanitizar campos de fecha/hora
      const dateTimeFields = ['heat_end_date', 'induction_date', 'peak_estrus_date', 'detection_time', 'peak_estrus_time'];
      dateTimeFields.forEach(field => {
        if (heatData.hasOwnProperty(field)) {
          if (heatData[field] === '' || heatData[field] === null || heatData[field] === undefined) {
            heatData[field] = null;
          }
        }
      });

      const updatedHeat = await heatModel.partialUpdate(id, heatData);

      res.json({
        success: true,
        message: 'Celo actualizado exitosamente',
        data: updatedHeat
      });
    } catch (error) {
      console.error('Error al actualizar celo:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar celo',
        error: error.message
      });
    }
  },

  // DELETE /api/heats/:id - Eliminar un celo (solo si no tiene servicios asociados)
  delete: async (req, res) => {
    try {
      const { id } = req.params;
      
      // Verificar que el celo existe
      const existingHeat = await heatModel.getById(id);
      if (!existingHeat) {
        return res.status(404).json({
          success: false,
          message: 'Celo no encontrado'
        });
      }

      // Verificar que no esté servido o cancelado
      if (existingHeat.status === 'servido' || existingHeat.status === 'cancelado') {
        return res.status(400).json({
          success: false,
          message: `No se puede eliminar un celo con estado "${existingHeat.status}"`
        });
      }

      const deletedHeat = await heatModel.delete(id);
      
      res.json({
        success: true,
        message: 'Celo eliminado exitosamente',
        data: deletedHeat
      });
    } catch (error) {
      console.error('Error al eliminar celo:', error);
      
      // Si hay constraint de foreign key (servicios asociados)
      if (error.code === '23503') {
        return res.status(400).json({
          success: false,
          message: 'No se puede eliminar el celo porque tiene servicios asociados'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error al eliminar celo',
        error: error.message
      });
    }
  }
};

module.exports = heatController;
