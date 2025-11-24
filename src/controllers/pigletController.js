const pigletModel = require('../models/pigletModel');
const sowModel = require('../models/sowModel');
const boarModel = require('../models/boarModel');
const birthModel = require('../models/birthModel');

const pigletController = {
  // GET /api/piglets - Obtener todos los lechones con filtros opcionales
  getAll: async (req, res) => {
    try {
      const filters = {
        birth_id: req.query.birth_id,
        sow_id: req.query.sow_id,
        sire_id: req.query.sire_id,
        sex: req.query.sex,
        birth_status: req.query.birth_status,
        current_status: req.query.current_status
      };

      // Remover filtros undefined
      Object.keys(filters).forEach(key => {
        if (filters[key] === undefined) delete filters[key];
      });

      const piglets = await pigletModel.getAll(filters);
      
      res.json({
        success: true,
        count: piglets.length,
        data: piglets
      });
    } catch (error) {
      console.error('Error al obtener lechones:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener lechones',
        error: error.message
      });
    }
  },

  // GET /api/piglets/stats - Obtener estadísticas de lechones
  getStats: async (req, res) => {
    try {
      const filters = {
        birth_id: req.query.birth_id,
        sow_id: req.query.sow_id
      };

      Object.keys(filters).forEach(key => {
        if (filters[key] === undefined) delete filters[key];
      });

      const stats = await pigletModel.getStats(filters);
      
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

  // GET /api/piglets/ready-weaning - Obtener lechones listos para destete
  getReadyForWeaning: async (req, res) => {
    try {
      const minDays = parseInt(req.query.min_days) || 21;
      const piglets = await pigletModel.getReadyForWeaning(minDays);
      
      res.json({
        success: true,
        count: piglets.length,
        data: piglets
      });
    } catch (error) {
      console.error('Error al obtener lechones para destete:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener lechones para destete',
        error: error.message
      });
    }
  },

  // GET /api/piglets/birth/:birthId - Obtener lechones de un parto
  getByBirthId: async (req, res) => {
    try {
      const { birthId } = req.params;

      // Verificar que el parto existe
      const birth = await birthModel.getById(birthId);
      if (!birth) {
        return res.status(404).json({
          success: false,
          message: 'Parto no encontrado'
        });
      }

      const piglets = await pigletModel.getByBirthId(birthId);
      
      res.json({
        success: true,
        count: piglets.length,
        data: piglets
      });
    } catch (error) {
      console.error('Error al obtener lechones del parto:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener lechones del parto',
        error: error.message
      });
    }
  },

  // GET /api/piglets/sow/:sowId - Obtener lechones de una cerda
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

      const piglets = await pigletModel.getBySowId(sowId);
      
      res.json({
        success: true,
        count: piglets.length,
        data: piglets
      });
    } catch (error) {
      console.error('Error al obtener lechones de la cerda:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener lechones de la cerda',
        error: error.message
      });
    }
  },

  // GET /api/piglets/ear-tag/:ear_tag - Buscar lechón por arete
  getByEarTag: async (req, res) => {
    try {
      const { ear_tag } = req.params;
      const piglet = await pigletModel.getByEarTag(ear_tag);

      if (!piglet) {
        return res.status(404).json({
          success: false,
          message: 'Lechón no encontrado'
        });
      }

      res.json({
        success: true,
        data: piglet
      });
    } catch (error) {
      console.error('Error al buscar lechón:', error);
      res.status(500).json({
        success: false,
        message: 'Error al buscar lechón',
        error: error.message
      });
    }
  },

  // GET /api/piglets/:id - Obtener un lechón por ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const piglet = await pigletModel.getById(id);

      if (!piglet) {
        return res.status(404).json({
          success: false,
          message: 'Lechón no encontrado'
        });
      }

      res.json({
        success: true,
        data: piglet
      });
    } catch (error) {
      console.error('Error al obtener lechón:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener lechón',
        error: error.message
      });
    }
  },

  // POST /api/piglets - Crear un nuevo lechón
  create: async (req, res) => {
    try {
      const {
        birth_id, sow_id, sire_id, ear_tag, temporary_id,
        birth_order, sex, birth_weight, current_weight, birth_status, current_status,
        adoptive_sow_id, adoption_date, adoption_reason,
        weaning_date, weaning_weight, weaning_age_days,
        death_date, death_age_days, death_cause,
        special_care, notes
      } = req.body;

      // Validaciones
      if (!birth_id || !sow_id || !sire_id || !sex) {
        return res.status(400).json({
          success: false,
          message: 'Faltan campos obligatorios: birth_id, sow_id, sire_id, sex'
        });
      }

      // Verificar que el parto existe
      const birth = await birthModel.getById(birth_id);
      if (!birth) {
        return res.status(404).json({
          success: false,
          message: 'Parto no encontrado'
        });
      }

      // Verificar que no se exceda el número de lechones registrados en el parto
      const existingPiglets = await pigletModel.getByBirthId(birth_id);
      if (existingPiglets.length >= birth.total_born) {
        return res.status(400).json({
          success: false,
          message: `No se pueden registrar más lechones. El parto tiene registrado un total de ${birth.total_born} lechones y ya hay ${existingPiglets.length} registrados.`
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

      // Verificar que el verraco existe
      const boar = await boarModel.getById(sire_id);
      if (!boar) {
        return res.status(404).json({
          success: false,
          message: 'Verraco no encontrado'
        });
      }

      // Verificar ear_tag único si se proporciona
      if (ear_tag) {
        const existing = await pigletModel.getByEarTag(ear_tag);
        if (existing) {
          return res.status(400).json({
            success: false,
            message: 'El arete ya está registrado'
          });
        }
      }

      const pigletData = {
        birth_id, sow_id, sire_id, ear_tag, temporary_id,
        birth_order, sex, birth_weight, current_weight, birth_status, current_status,
        adoptive_sow_id, adoption_date, adoption_reason,
        weaning_date, weaning_weight, weaning_age_days,
        death_date, death_age_days, death_cause,
        special_care, notes,
        created_by: req.user?.id
      };

      const newPiglet = await pigletModel.create(pigletData);

      res.status(201).json({
        success: true,
        message: 'Lechón registrado exitosamente',
        data: newPiglet
      });
    } catch (error) {
      console.error('Error al crear lechón:', error);
      res.status(500).json({
        success: false,
        message: 'Error al crear lechón',
        error: error.message
      });
    }
  },

  // PUT /api/piglets/:id - Actualizar un lechón completamente
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const {
        ear_tag, temporary_id, birth_order, sex, birth_weight, current_weight, birth_status,
        current_status, adoptive_sow_id, adoption_date, adoption_reason,
        weaning_date, weaning_weight, weaning_age_days,
        death_date, death_age_days, death_cause,
        special_care, notes
      } = req.body;

      // Verificar que el lechón existe
      const existingPiglet = await pigletModel.getById(id);
      if (!existingPiglet) {
        return res.status(404).json({
          success: false,
          message: 'Lechón no encontrado'
        });
      }

      // Validaciones
      if (!sex) {
        return res.status(400).json({
          success: false,
          message: 'El sexo es obligatorio'
        });
      }

      // Verificar ear_tag único si se proporciona y es diferente
      if (ear_tag && ear_tag !== existingPiglet.ear_tag) {
        const existing = await pigletModel.getByEarTag(ear_tag);
        if (existing) {
          return res.status(400).json({
            success: false,
            message: 'El arete ya está registrado'
          });
        }
      }

      const pigletData = {
        ear_tag, temporary_id, birth_order, sex, birth_weight, current_weight, birth_status,
        current_status, adoptive_sow_id, adoption_date, adoption_reason,
        weaning_date, weaning_weight, weaning_age_days,
        death_date, death_age_days, death_cause,
        special_care, notes,
        updated_by: req.user?.id
      };

      const updatedPiglet = await pigletModel.update(id, pigletData);

      res.json({
        success: true,
        message: 'Lechón actualizado exitosamente',
        data: updatedPiglet
      });
    } catch (error) {
      console.error('Error al actualizar lechón:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar lechón',
        error: error.message
      });
    }
  },

  // PATCH /api/piglets/:id - Actualizar parcialmente un lechón
  partialUpdate: async (req, res) => {
    try {
      const { id } = req.params;
      
      // Verificar que el lechón existe
      const existingPiglet = await pigletModel.getById(id);
      if (!existingPiglet) {
        return res.status(404).json({
          success: false,
          message: 'Lechón no encontrado'
        });
      }

      // Verificar ear_tag único si se proporciona
      if (req.body.ear_tag && req.body.ear_tag !== existingPiglet.ear_tag) {
        const existing = await pigletModel.getByEarTag(req.body.ear_tag);
        if (existing) {
          return res.status(400).json({
            success: false,
            message: 'El arete ya está registrado'
          });
        }
      }

      const pigletData = {
        ...req.body,
        updated_by: req.user?.id
      };

      // No permitir cambiar birth_id, sow_id, sire_id
      delete pigletData.birth_id;
      delete pigletData.sow_id;
      delete pigletData.sire_id;

      const updatedPiglet = await pigletModel.partialUpdate(id, pigletData);

      res.json({
        success: true,
        message: 'Lechón actualizado exitosamente',
        data: updatedPiglet
      });
    } catch (error) {
      console.error('Error al actualizar lechón:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar lechón',
        error: error.message
      });
    }
  },

  // DELETE /api/piglets/:id/soft - Soft delete (marcar como vendido/muerto)
  softDelete: async (req, res) => {
    try {
      const { id } = req.params;
      const { reason = 'vendido' } = req.body;

      // Verificar que el lechón existe
      const existingPiglet = await pigletModel.getById(id);
      if (!existingPiglet) {
        return res.status(404).json({
          success: false,
          message: 'Lechón no encontrado'
        });
      }

      await pigletModel.softDelete(id, reason);

      res.json({
        success: true,
        message: 'Estado del lechón actualizado exitosamente'
      });
    } catch (error) {
      console.error('Error al actualizar estado del lechón:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar estado del lechón',
        error: error.message
      });
    }
  },

  // DELETE /api/piglets/:id - Eliminar permanentemente un lechón (solo admin)
  delete: async (req, res) => {
    try {
      const { id } = req.params;

      // Verificar que el lechón existe
      const existingPiglet = await pigletModel.getById(id);
      if (!existingPiglet) {
        return res.status(404).json({
          success: false,
          message: 'Lechón no encontrado'
        });
      }

      await pigletModel.delete(id);

      res.json({
        success: true,
        message: 'Lechón eliminado exitosamente'
      });
    } catch (error) {
      console.error('Error al eliminar lechón:', error);
      res.status(500).json({
        success: false,
        message: 'Error al eliminar lechón',
        error: error.message
      });
    }
  }
};

module.exports = pigletController;

