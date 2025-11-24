const abortionModel = require('../models/abortionModel');
const sowModel = require('../models/sowModel');
const pregnancyModel = require('../models/pregnancyModel');

const abortionController = {
  // GET /api/abortions - Obtener todos los abortos con filtros opcionales
  getAll: async (req, res) => {
    try {
      const filters = {
        sow_id: req.query.sow_id,
        probable_cause: req.query.probable_cause,
        recovery_status: req.query.recovery_status,
        date_from: req.query.date_from,
        date_to: req.query.date_to,
        farm_name: req.query.farm_name
      };

      // Remover filtros undefined
      Object.keys(filters).forEach(key => {
        if (filters[key] === undefined) delete filters[key];
      });

      const abortions = await abortionModel.getAll(filters);
      
      res.json({
        success: true,
        count: abortions.length,
        data: abortions
      });
    } catch (error) {
      console.error('Error al obtener abortos:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener abortos',
        error: error.message
      });
    }
  },

  // GET /api/abortions/stats - Obtener estadísticas de abortos
  getStats: async (req, res) => {
    try {
      const filters = {
        date_from: req.query.date_from,
        date_to: req.query.date_to
      };

      Object.keys(filters).forEach(key => {
        if (filters[key] === undefined) delete filters[key];
      });

      const stats = await abortionModel.getStats(filters);
      
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

  // GET /api/abortions/recent - Obtener abortos recientes
  getRecent: async (req, res) => {
    try {
      const days = parseInt(req.query.days) || 30;
      const recentAbortions = await abortionModel.getRecent(days);
      
      res.json({
        success: true,
        count: recentAbortions.length,
        data: recentAbortions
      });
    } catch (error) {
      console.error('Error al obtener abortos recientes:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener abortos recientes',
        error: error.message
      });
    }
  },

  // GET /api/abortions/critical - Obtener abortos críticos
  getCritical: async (req, res) => {
    try {
      const criticalAbortions = await abortionModel.getCritical();
      
      res.json({
        success: true,
        count: criticalAbortions.length,
        data: criticalAbortions
      });
    } catch (error) {
      console.error('Error al obtener abortos críticos:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener abortos críticos',
        error: error.message
      });
    }
  },

  // GET /api/abortions/sow/:sowId - Obtener abortos de una cerda
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

      const abortions = await abortionModel.getBySowId(sowId);
      
      res.json({
        success: true,
        count: abortions.length,
        data: abortions
      });
    } catch (error) {
      console.error('Error al obtener abortos de la cerda:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener abortos de la cerda',
        error: error.message
      });
    }
  },

  // GET /api/abortions/sow/:sowId/last - Obtener último aborto de una cerda
  getLastBySowId: async (req, res) => {
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

      const lastAbortion = await abortionModel.getLastBySowId(sowId);
      
      if (!lastAbortion) {
        return res.status(404).json({
          success: false,
          message: 'No se encontraron abortos para esta cerda'
        });
      }

      res.json({
        success: true,
        data: lastAbortion
      });
    } catch (error) {
      console.error('Error al obtener último aborto:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener último aborto',
        error: error.message
      });
    }
  },

  // GET /api/abortions/:id - Obtener un aborto por ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const abortion = await abortionModel.getById(id);

      if (!abortion) {
        return res.status(404).json({
          success: false,
          message: 'Aborto no encontrado'
        });
      }

      res.json({
        success: true,
        data: abortion
      });
    } catch (error) {
      console.error('Error al obtener aborto:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener aborto',
        error: error.message
      });
    }
  },

  // POST /api/abortions - Crear un nuevo registro de aborto
  create: async (req, res) => {
    try {
      const {
        sow_id, pregnancy_id, abortion_date, gestation_days,
        fetuses_expelled, fetus_condition,
        symptoms, fever, vaginal_discharge, anorexia,
        probable_cause, specific_cause,
        laboratory_test, test_results,
        treatment_applied, isolation_required,
        return_to_service_date, recovery_status,
        notes
      } = req.body;

      // Validaciones
      if (!sow_id || !pregnancy_id || !abortion_date || !gestation_days) {
        return res.status(400).json({
          success: false,
          message: 'Faltan campos obligatorios: sow_id, pregnancy_id, abortion_date, gestation_days'
        });
      }

      // Validar que los días de gestación estén en el rango válido
      if (gestation_days <= 0 || gestation_days >= 114) {
        return res.status(400).json({
          success: false,
          message: 'Los días de gestación deben estar entre 1 y 113'
        });
      }

      // Verificar que la cerda existe
      const sow = await sowModel.getById(sow_id);
      if (!sow) {
        return res.status(404).json({
          success: false,
          message: 'Cerda no encontrada'
        });
      }

      // Verificar que la gestación existe
      const pregnancy = await pregnancyModel.getById(pregnancy_id);
      if (!pregnancy) {
        return res.status(404).json({
          success: false,
          message: 'Gestación no encontrada'
        });
      }

      const abortionData = {
        sow_id, pregnancy_id, abortion_date, gestation_days,
        fetuses_expelled, fetus_condition,
        symptoms, fever, vaginal_discharge, anorexia,
        probable_cause, specific_cause,
        laboratory_test, test_results,
        treatment_applied, isolation_required,
        return_to_service_date, recovery_status,
        notes,
        created_by: req.user?.id
      };

      const newAbortion = await abortionModel.create(abortionData);

      res.status(201).json({
        success: true,
        message: 'Aborto registrado exitosamente',
        data: newAbortion
      });
    } catch (error) {
      console.error('Error al crear aborto:', error);
      res.status(500).json({
        success: false,
        message: 'Error al crear aborto',
        error: error.message
      });
    }
  },

  // PUT /api/abortions/:id - Actualizar un aborto completamente
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const {
        abortion_date, gestation_days, fetuses_expelled, fetus_condition,
        symptoms, fever, vaginal_discharge, anorexia,
        probable_cause, specific_cause, laboratory_test, test_results,
        treatment_applied, isolation_required, return_to_service_date,
        recovery_status, notes
      } = req.body;

      // Verificar que el aborto existe
      const existingAbortion = await abortionModel.getById(id);
      if (!existingAbortion) {
        return res.status(404).json({
          success: false,
          message: 'Aborto no encontrado'
        });
      }

      // Validaciones
      if (!abortion_date || !gestation_days) {
        return res.status(400).json({
          success: false,
          message: 'Faltan campos obligatorios: abortion_date, gestation_days'
        });
      }

      // Validar que los días de gestación estén en el rango válido
      if (gestation_days <= 0 || gestation_days >= 114) {
        return res.status(400).json({
          success: false,
          message: 'Los días de gestación deben estar entre 1 y 113'
        });
      }

      const abortionData = {
        abortion_date, gestation_days, fetuses_expelled, fetus_condition,
        symptoms, fever, vaginal_discharge, anorexia,
        probable_cause, specific_cause, laboratory_test, test_results,
        treatment_applied, isolation_required, return_to_service_date,
        recovery_status, notes,
        updated_by: req.user?.id
      };

      const updatedAbortion = await abortionModel.update(id, abortionData);

      res.json({
        success: true,
        message: 'Aborto actualizado exitosamente',
        data: updatedAbortion
      });
    } catch (error) {
      console.error('Error al actualizar aborto:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar aborto',
        error: error.message
      });
    }
  },

  // PATCH /api/abortions/:id - Actualizar parcialmente un aborto
  partialUpdate: async (req, res) => {
    try {
      const { id } = req.params;
      
      // Verificar que el aborto existe
      const existingAbortion = await abortionModel.getById(id);
      if (!existingAbortion) {
        return res.status(404).json({
          success: false,
          message: 'Aborto no encontrado'
        });
      }

      // Si se proporciona gestation_days, validar
      if (req.body.gestation_days !== undefined) {
        if (req.body.gestation_days <= 0 || req.body.gestation_days >= 114) {
          return res.status(400).json({
            success: false,
            message: 'Los días de gestación deben estar entre 1 y 113'
          });
        }
      }

      const abortionData = {
        ...req.body,
        updated_by: req.user?.id
      };

      // No permitir cambiar sow_id o pregnancy_id
      delete abortionData.sow_id;
      delete abortionData.pregnancy_id;

      const updatedAbortion = await abortionModel.partialUpdate(id, abortionData);

      res.json({
        success: true,
        message: 'Aborto actualizado exitosamente',
        data: updatedAbortion
      });
    } catch (error) {
      console.error('Error al actualizar aborto:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar aborto',
        error: error.message
      });
    }
  },

  // DELETE /api/abortions/:id - Eliminar un aborto
  delete: async (req, res) => {
    try {
      const { id } = req.params;

      // Verificar que el aborto existe
      const existingAbortion = await abortionModel.getById(id);
      if (!existingAbortion) {
        return res.status(404).json({
          success: false,
          message: 'Aborto no encontrado'
        });
      }

      await abortionModel.delete(id);

      res.json({
        success: true,
        message: 'Aborto eliminado exitosamente'
      });
    } catch (error) {
      console.error('Error al eliminar aborto:', error);
      res.status(500).json({
        success: false,
        message: 'Error al eliminar aborto',
        error: error.message
      });
    }
  }
};

module.exports = abortionController;

