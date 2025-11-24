const serviceModel = require('../models/serviceModel');
const sowModel = require('../models/sowModel');
const boarModel = require('../models/boarModel');
const heatModel = require('../models/heatModel');
const { canRegisterService } = require('../utils/reproductiveValidations');

const serviceController = {
  /**
   * GET /api/services - Obtener todos los servicios
   */
  getAll: async (req, res) => {
    try {
      const filters = {
        sow_id: req.query.sow_id,
        boar_id: req.query.boar_id,
        service_type: req.query.service_type,
        start_date: req.query.start_date,
        end_date: req.query.end_date
      };

      const services = await serviceModel.getAll(filters);
      
      res.json({
        success: true,
        data: services
      });
    } catch (error) {
      console.error('Error al obtener servicios:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener servicios',
        error: error.message
      });
    }
  },

  /**
   * GET /api/services/:id - Obtener un servicio por ID
   */
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      
      const service = await serviceModel.getById(id);
      
      if (!service) {
        return res.status(404).json({
          success: false,
          message: 'Servicio no encontrado'
        });
      }

      res.json({
        success: true,
        data: service
      });
    } catch (error) {
      console.error('Error al obtener servicio:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener servicio',
        error: error.message
      });
    }
  },

  /**
   * GET /api/services/sow/:sowId - Obtener servicios de una cerda
   */
  getBySowId: async (req, res) => {
    try {
      const { sowId } = req.params;
      
      const services = await serviceModel.getBySowId(sowId);
      
      res.json({
        success: true,
        data: services
      });
    } catch (error) {
      console.error('Error al obtener servicios de cerda:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener servicios de cerda',
        error: error.message
      });
    }
  },

  /**
   * GET /api/services/heat/:heatId - Obtener servicios de un celo
   */
  getByHeatId: async (req, res) => {
    try {
      const { heatId } = req.params;
      
      const services = await serviceModel.getByHeatId(heatId);
      
      res.json({
        success: true,
        data: services
      });
    } catch (error) {
      console.error('Error al obtener servicios de celo:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener servicios de celo',
        error: error.message
      });
    }
  },

  /**
   * GET /api/services/stats - Obtener estadísticas de servicios
   */
  getStats: async (req, res) => {
    try {
      const filters = {
        start_date: req.query.start_date,
        end_date: req.query.end_date
      };

      const stats = await serviceModel.getStats(filters);
      
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

  /**
   * POST /api/services - Crear un nuevo servicio
   */
  create: async (req, res) => {
    try {
      const serviceData = req.body;

      // Validaciones obligatorias
      const requiredFields = ['sow_id', 'heat_id', 'service_date', 'service_type'];
      const missingFields = requiredFields.filter(field => !serviceData[field]);

      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Faltan campos obligatorios: ${missingFields.join(', ')}`
        });
      }

      // Verificar que la cerda existe y está activa
      const sow = await sowModel.getById(serviceData.sow_id);
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

      // Verificar que el celo existe
      const heat = await heatModel.getById(serviceData.heat_id);
      if (!heat) {
        return res.status(404).json({
          success: false,
          message: 'Celo no encontrado'
        });
      }

      // Verificar que el celo pertenece a la cerda
      if (heat.sow_id !== serviceData.sow_id) {
        return res.status(400).json({
          success: false,
          message: 'El celo no pertenece a la cerda seleccionada'
        });
      }

      // VALIDACIONES REPRODUCTIVAS
      const validation = await canRegisterService(
        serviceData.sow_id, 
        serviceData.heat_id, 
        serviceData.service_date
      );

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: 'No se puede registrar el servicio',
          errors: validation.errors,
          warnings: validation.warnings
        });
      }

      // Si hay advertencias pero es válido, incluirlas en la respuesta
      const responseWarnings = validation.warnings.length > 0 ? validation.warnings : undefined;

      // Sanitizar campos numéricos PRIMERO
      if (serviceData.service_number) {
        serviceData.service_number = parseInt(serviceData.service_number);
      }

      if (serviceData.mating_duration_minutes !== undefined && serviceData.mating_duration_minutes !== null && serviceData.mating_duration_minutes !== '') {
        serviceData.mating_duration_minutes = parseInt(serviceData.mating_duration_minutes);
      } else {
        serviceData.mating_duration_minutes = null;
      }

      if (serviceData.semen_volume_ml !== undefined && serviceData.semen_volume_ml !== null && serviceData.semen_volume_ml !== '') {
        serviceData.semen_volume_ml = parseFloat(serviceData.semen_volume_ml);
      } else {
        serviceData.semen_volume_ml = null;
      }

      if (serviceData.semen_concentration !== undefined && serviceData.semen_concentration !== null && serviceData.semen_concentration !== '') {
        serviceData.semen_concentration = parseFloat(serviceData.semen_concentration);
      } else {
        serviceData.semen_concentration = null;
      }

      // Sanitizar campos de tiempo
      if (serviceData.service_time === '' || serviceData.service_time === null || serviceData.service_time === undefined) {
        serviceData.service_time = null;
      }

      // Sanitizar booleano success
      if (serviceData.success !== undefined && serviceData.success !== null && serviceData.success !== '') {
        serviceData.success = Boolean(serviceData.success);
      } else {
        serviceData.success = null;
      }

      // Validar que el verraco es obligatorio para todos los tipos de servicio
      if (!serviceData.boar_id) {
        return res.status(400).json({
          success: false,
          message: 'El verraco es obligatorio para todos los tipos de servicio'
        });
      }

      // Verificar que el verraco existe y está activo
      const boar = await boarModel.getById(serviceData.boar_id);
      if (!boar) {
        return res.status(404).json({
          success: false,
          message: 'Verraco no encontrado'
        });
      }

      if (boar.status !== 'activo') {
        return res.status(400).json({
          success: false,
          message: 'El verraco no está activo'
        });
      }

      // Limpiar campos específicos según tipo de servicio
      if (serviceData.service_type === 'monta natural') {
        // Limpiar campos de IA (forzar a NULL)
        serviceData.ia_type = null;
        serviceData.semen_dose_code = null;
        serviceData.semen_volume_ml = null;
        serviceData.semen_concentration = null;

      } else if (serviceData.service_type === 'inseminacion artificial') {
        // Limpiar campos de monta natural (forzar a NULL)
        serviceData.mating_duration_minutes = null;
        serviceData.mating_quality = null;
      }

      // Agregar usuario que creó el registro
      if (req.user) {
        serviceData.created_by = req.user.email;
      }

      const newService = await serviceModel.create(serviceData);

      // NOTA: Los siguientes cambios se realizan automáticamente mediante triggers de BD:
      // - El celo asociado cambia su estado a 'servido' (trigger: update_heat_status_on_service)
      // - El estado reproductivo de la cerda se actualiza a 'en servicio' (trigger: update_sow_reproductive_status_on_service)
      // - Se actualiza last_service_date en la cerda
      
      res.status(201).json({
        success: true,
        message: 'Servicio registrado exitosamente',
        data: newService,
        warnings: responseWarnings
      });
    } catch (error) {
      console.error('Error al crear servicio:', error);
      
      // Manejar errores de constraint de base de datos
      if (error.code === '23503') { // foreign_key_violation
        return res.status(400).json({
          success: false,
          message: 'La cerda, verraco o celo especificado no existe'
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
        message: 'Error al crear servicio',
        error: error.message
      });
    }
  },

  /**
   * PUT /api/services/:id - Actualizar un servicio
   */
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const serviceData = req.body;

      // Verificar que el servicio existe
      const existingService = await serviceModel.getById(id);
      if (!existingService) {
        return res.status(404).json({
          success: false,
          message: 'Servicio no encontrado'
        });
      }

      // Validar que no tenga gestación confirmada asociada
      if (existingService.has_confirmed_pregnancy) {
        return res.status(403).json({
          success: false,
          message: 'No se puede modificar un servicio con gestación confirmada'
        });
      }

      // Sanitizar campos numéricos
      if (serviceData.service_number !== undefined) {
        serviceData.service_number = parseInt(serviceData.service_number);
      }

      if (serviceData.mating_duration_minutes !== undefined && serviceData.mating_duration_minutes !== null && serviceData.mating_duration_minutes !== '') {
        serviceData.mating_duration_minutes = parseInt(serviceData.mating_duration_minutes);
      } else if (serviceData.mating_duration_minutes !== undefined) {
        serviceData.mating_duration_minutes = null;
      }

      if (serviceData.semen_volume_ml !== undefined && serviceData.semen_volume_ml !== null && serviceData.semen_volume_ml !== '') {
        serviceData.semen_volume_ml = parseFloat(serviceData.semen_volume_ml);
      } else if (serviceData.semen_volume_ml !== undefined) {
        serviceData.semen_volume_ml = null;
      }

      if (serviceData.semen_concentration !== undefined && serviceData.semen_concentration !== null && serviceData.semen_concentration !== '') {
        serviceData.semen_concentration = parseFloat(serviceData.semen_concentration);
      } else if (serviceData.semen_concentration !== undefined) {
        serviceData.semen_concentration = null;
      }

      // Sanitizar campos de tiempo
      if (serviceData.service_time !== undefined && (serviceData.service_time === '' || serviceData.service_time === null)) {
        serviceData.service_time = null;
      }

      // Sanitizar booleano success
      if (serviceData.success !== undefined && serviceData.success !== null && serviceData.success !== '') {
        serviceData.success = Boolean(serviceData.success);
      } else if (serviceData.success !== undefined) {
        serviceData.success = null;
      }

      // Validar que el verraco existe si se proporciona
      if (serviceData.boar_id) {
        const boar = await boarModel.getById(serviceData.boar_id);
        if (!boar) {
          return res.status(404).json({
            success: false,
            message: 'Verraco no encontrado'
          });
        }

        if (boar.status !== 'activo') {
          return res.status(400).json({
            success: false,
            message: 'El verraco no está activo'
          });
        }
      }

      // Limpiar campos específicos según tipo de servicio
      if (serviceData.service_type === 'monta natural') {
        // Limpiar campos de IA
        serviceData.ia_type = null;
        serviceData.semen_dose_code = null;
        serviceData.semen_volume_ml = null;
        serviceData.semen_concentration = null;
      } else if (serviceData.service_type === 'inseminacion artificial') {
        // Limpiar campos de monta natural (excepto boar_id)
        serviceData.mating_duration_minutes = null;
        serviceData.mating_quality = null;
      }

      const updatedService = await serviceModel.update(id, serviceData);

      res.json({
        success: true,
        message: 'Servicio actualizado exitosamente',
        data: updatedService
      });
    } catch (error) {
      console.error('Error al actualizar servicio:', error);
      
      if (error.code === '23514') { // check_violation
        return res.status(400).json({
          success: false,
          message: 'Datos inválidos: verifique los valores de los campos',
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error al actualizar servicio',
        error: error.message
      });
    }
  },

  /**
   * DELETE /api/services/:id - Eliminar un servicio
   */
  delete: async (req, res) => {
    try {
      const { id } = req.params;
      
      // Verificar que el servicio existe
      const existingService = await serviceModel.getById(id);
      if (!existingService) {
        return res.status(404).json({
          success: false,
          message: 'Servicio no encontrado'
        });
      }

      // Verificar que no tenga gestación asociada
      const hasPregnancy = await serviceModel.hasPregnancy(id);
      if (hasPregnancy) {
        return res.status(400).json({
          success: false,
          message: 'No se puede eliminar un servicio con gestación asociada'
        });
      }

      const deletedService = await serviceModel.delete(id);
      
      res.json({
        success: true,
        message: 'Servicio eliminado exitosamente',
        data: deletedService
      });
    } catch (error) {
      console.error('Error al eliminar servicio:', error);
      
      // Si hay constraint de foreign key (gestación asociada)
      if (error.code === '23503') {
        return res.status(400).json({
          success: false,
          message: 'No se puede eliminar el servicio porque tiene gestaciones asociadas'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error al eliminar servicio',
        error: error.message
      });
    }
  }
};

module.exports = serviceController;
