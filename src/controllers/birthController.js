const birthModel = require('../models/birthModel');
const sowModel = require('../models/sowModel');
const boarModel = require('../models/boarModel');
const pregnancyModel = require('../models/pregnancyModel');
const weaningStatusJob = require('../jobs/weaningStatusJob');

const birthController = {
  // GET /api/births - Obtener todos los partos con filtros opcionales
  getAll: async (req, res) => {
    try {
      const filters = {
        sow_id: req.query.sow_id,
        boar_id: req.query.boar_id,
        birth_type: req.query.birth_type,
        sow_condition: req.query.sow_condition,
        date_from: req.query.date_from,
        date_to: req.query.date_to,
        farm_name: req.query.farm_name
      };

      // Remover filtros undefined
      Object.keys(filters).forEach(key => {
        if (filters[key] === undefined) delete filters[key];
      });

      const births = await birthModel.getAll(filters);
      
      res.json({
        success: true,
        count: births.length,
        data: births
      });
    } catch (error) {
      console.error('Error al obtener partos:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener partos',
        error: error.message
      });
    }
  },

  // GET /api/births/stats - Obtener estadísticas de partos
  getStats: async (req, res) => {
    try {
      const filters = {
        date_from: req.query.date_from,
        date_to: req.query.date_to
      };

      Object.keys(filters).forEach(key => {
        if (filters[key] === undefined) delete filters[key];
      });

      const stats = await birthModel.getStats(filters);
      
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

  // GET /api/births/recent - Obtener partos recientes
  getRecent: async (req, res) => {
    try {
      const days = parseInt(req.query.days) || 30;
      const recentBirths = await birthModel.getRecent(days);
      
      res.json({
        success: true,
        count: recentBirths.length,
        data: recentBirths
      });
    } catch (error) {
      console.error('Error al obtener partos recientes:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener partos recientes',
        error: error.message
      });
    }
  },

  // GET /api/births/problematic - Obtener partos problemáticos
  getProblematic: async (req, res) => {
    try {
      const problematicBirths = await birthModel.getProblematicBirths();
      
      res.json({
        success: true,
        count: problematicBirths.length,
        data: problematicBirths
      });
    } catch (error) {
      console.error('Error al obtener partos problemáticos:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener partos problemáticos',
        error: error.message
      });
    }
  },

  // GET /api/births/:id - Obtener un parto por ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const birth = await birthModel.getById(id);
      
      if (!birth) {
        return res.status(404).json({
          success: false,
          message: 'Parto no encontrado'
        });
      }

      res.json({
        success: true,
        data: birth
      });
    } catch (error) {
      console.error('Error al obtener parto:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener parto',
        error: error.message
      });
    }
  },

  // GET /api/births/sow/:sowId - Obtener partos de una cerda
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

      const births = await birthModel.getBySowId(sowId);
      
      res.json({
        success: true,
        count: births.length,
        data: births,
        sow: {
          id: sow.id,
          ear_tag: sow.ear_tag,
          alias: sow.alias
        }
      });
    } catch (error) {
      console.error('Error al obtener partos de cerda:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener partos de cerda',
        error: error.message
      });
    }
  },

  // GET /api/births/sow/:sowId/last - Obtener último parto de una cerda
  getLastBySowId: async (req, res) => {
    try {
      const { sowId } = req.params;
      
      const birth = await birthModel.getLastBySowId(sowId);
      
      if (!birth) {
        return res.status(404).json({
          success: false,
          message: 'No se encontraron partos para esta cerda'
        });
      }

      res.json({
        success: true,
        data: birth
      });
    } catch (error) {
      console.error('Error al obtener último parto:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener último parto',
        error: error.message
      });
    }
  },

  // POST /api/births - Crear un nuevo registro de parto
  create: async (req, res) => {
    try {
      const birthData = req.body;

      // Validaciones obligatorias
      const requiredFields = ['sow_id', 'pregnancy_id', 'birth_date', 
                             'gestation_days', 'total_born', 'born_alive', 'born_dead'];
      const missingFields = requiredFields.filter(field => !birthData[field] && birthData[field] !== 0);

      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Faltan campos obligatorios: ${missingFields.join(', ')}`
        });
      }

      // Verificar que la cerda existe
      const sow = await sowModel.getById(birthData.sow_id);
      if (!sow) {
        return res.status(404).json({
          success: false,
          message: 'Cerda no encontrada'
        });
      }

      // Verificar que el verraco existe si se proporciona
      if (birthData.boar_id) {
        const boar = await boarModel.getById(birthData.boar_id);
        if (!boar) {
          return res.status(404).json({
            success: false,
            message: 'Verraco no encontrado'
          });
        }
      } else {
        // Si no se proporciona verraco, establecer como null
        birthData.boar_id = null;
      }

      // Verificar que la gestación existe y está en estado 'en curso'
      const pregnancy = await pregnancyModel.getById(birthData.pregnancy_id);
      if (!pregnancy) {
        return res.status(404).json({
          success: false,
          message: 'Gestación no encontrada'
        });
      }

      if (pregnancy.status !== 'en curso') {
        return res.status(400).json({
          success: false,
          message: `La gestación no está en curso (estado actual: ${pregnancy.status})`
        });
      }

      // Validar que total_born = born_alive + born_dead + mummified
      const mummified = birthData.mummified || 0;
      const calculatedTotal = birthData.born_alive + birthData.born_dead + mummified;
      if (birthData.total_born !== calculatedTotal) {
        return res.status(400).json({
          success: false,
          message: `Total nacidos (${birthData.total_born}) debe ser igual a vivos (${birthData.born_alive}) + muertos (${birthData.born_dead}) + momificados (${mummified})`
        });
      }

      // Validar días de gestación (debe estar entre 110 y 120)
      if (birthData.gestation_days < 110 || birthData.gestation_days > 120) {
        return res.status(400).json({
          success: false,
          message: 'Los días de gestación deben estar entre 110 y 120'
        });
      }

      // Validar tiempos (birth_end_time debe ser posterior a birth_start_time)
      if (birthData.birth_start_time && birthData.birth_end_time) {
        if (birthData.birth_end_time < birthData.birth_start_time) {
          return res.status(400).json({
            success: false,
            message: 'La hora de fin no puede ser anterior a la hora de inicio'
          });
        }
      }

      // Sanitizar campos booleanos
      birthData.assistance_required = Boolean(birthData.assistance_required);
      birthData.oxytocin_applied = Boolean(birthData.oxytocin_applied);
      birthData.antibiotics_applied = Boolean(birthData.antibiotics_applied);

      // Sanitizar campos numéricos
      if (birthData.total_litter_weight !== undefined && birthData.total_litter_weight !== null && birthData.total_litter_weight !== '') {
        birthData.total_litter_weight = parseFloat(birthData.total_litter_weight);
      } else {
        birthData.total_litter_weight = null;
      }

      if (birthData.avg_piglet_weight !== undefined && birthData.avg_piglet_weight !== null && birthData.avg_piglet_weight !== '') {
        birthData.avg_piglet_weight = parseFloat(birthData.avg_piglet_weight);
      } else {
        birthData.avg_piglet_weight = null;
      }

      if (birthData.sow_temperature !== undefined && birthData.sow_temperature !== null && birthData.sow_temperature !== '') {
        birthData.sow_temperature = parseFloat(birthData.sow_temperature);
      } else {
        birthData.sow_temperature = null;
      }

      // Sanitizar campos de fecha/hora vacíos
      const dateTimeFields = ['birth_start_time', 'birth_end_time', 'lactation_start_date', 'expected_weaning_date'];
      dateTimeFields.forEach(field => {
        if (birthData[field] === '' || birthData[field] === null || birthData[field] === undefined) {
          birthData[field] = null;
        }
      });

      // Agregar usuario que creó el registro
      if (req.user) {
        birthData.created_by = req.user.email;
      }

      const newBirth = await birthModel.create(birthData);

      res.status(201).json({
        success: true,
        message: 'Parto registrado exitosamente',
        data: newBirth
      });
    } catch (error) {
      console.error('Error al crear parto:', error);
      
      // Manejar errores de constraint de base de datos
      if (error.code === '23503') { // foreign_key_violation
        return res.status(400).json({
          success: false,
          message: 'La cerda, verraco o gestación especificada no existe'
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
        message: 'Error al crear parto',
        error: error.message
      });
    }
  },

  // PUT /api/births/:id - Actualizar un parto
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const birthData = req.body;

      // Verificar que el parto existe
      const existingBirth = await birthModel.getById(id);
      if (!existingBirth) {
        return res.status(404).json({
          success: false,
          message: 'Parto no encontrado'
        });
      }

      // Validar campos obligatorios
      const requiredFields = ['birth_date', 'gestation_days', 'total_born', 'born_alive', 'born_dead'];
      const missingFields = requiredFields.filter(field => !birthData[field] && birthData[field] !== 0);

      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Faltan campos obligatorios: ${missingFields.join(', ')}`
        });
      }

      // Validar que total_born = born_alive + born_dead + mummified
      const mummified = birthData.mummified || 0;
      const calculatedTotal = birthData.born_alive + birthData.born_dead + mummified;
      if (birthData.total_born !== calculatedTotal) {
        return res.status(400).json({
          success: false,
          message: `Total nacidos (${birthData.total_born}) debe ser igual a vivos (${birthData.born_alive}) + muertos (${birthData.born_dead}) + momificados (${mummified})`
        });
      }

      // Validar días de gestación
      if (birthData.gestation_days < 110 || birthData.gestation_days > 120) {
        return res.status(400).json({
          success: false,
          message: 'Los días de gestación deben estar entre 110 y 120'
        });
      }

      // Validar tiempos
      if (birthData.birth_start_time && birthData.birth_end_time) {
        if (birthData.birth_end_time < birthData.birth_start_time) {
          return res.status(400).json({
            success: false,
            message: 'La hora de fin no puede ser anterior a la hora de inicio'
          });
        }
      }

      // Sanitizar campos booleanos
      birthData.assistance_required = Boolean(birthData.assistance_required);
      birthData.oxytocin_applied = Boolean(birthData.oxytocin_applied);
      birthData.antibiotics_applied = Boolean(birthData.antibiotics_applied);

      // Sanitizar campos numéricos
      if (birthData.total_litter_weight !== undefined && birthData.total_litter_weight !== null && birthData.total_litter_weight !== '') {
        birthData.total_litter_weight = parseFloat(birthData.total_litter_weight);
      } else {
        birthData.total_litter_weight = null;
      }

      if (birthData.avg_piglet_weight !== undefined && birthData.avg_piglet_weight !== null && birthData.avg_piglet_weight !== '') {
        birthData.avg_piglet_weight = parseFloat(birthData.avg_piglet_weight);
      } else {
        birthData.avg_piglet_weight = null;
      }

      if (birthData.sow_temperature !== undefined && birthData.sow_temperature !== null && birthData.sow_temperature !== '') {
        birthData.sow_temperature = parseFloat(birthData.sow_temperature);
      } else {
        birthData.sow_temperature = null;
      }

      // Sanitizar campos de fecha/hora vacíos
      const dateTimeFields = ['birth_start_time', 'birth_end_time', 'lactation_start_date', 'expected_weaning_date'];
      dateTimeFields.forEach(field => {
        if (birthData[field] === '' || birthData[field] === null || birthData[field] === undefined) {
          birthData[field] = null;
        }
      });

      // Agregar usuario que actualizó
      if (req.user) {
        birthData.updated_by = req.user.email;
      }

      const updatedBirth = await birthModel.update(id, birthData);

      res.json({
        success: true,
        message: 'Parto actualizado exitosamente',
        data: updatedBirth
      });
    } catch (error) {
      console.error('Error al actualizar parto:', error);
      
      if (error.code === '23514') {
        return res.status(400).json({
          success: false,
          message: 'Datos inválidos: verifique los valores de los campos',
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error al actualizar parto',
        error: error.message
      });
    }
  },

  // PATCH /api/births/:id - Actualizar campos específicos
  partialUpdate: async (req, res) => {
    try {
      const { id } = req.params;
      const birthData = req.body;

      // Verificar que el parto existe
      const existingBirth = await birthModel.getById(id);
      if (!existingBirth) {
        return res.status(404).json({
          success: false,
          message: 'Parto no encontrado'
        });
      }

      // Si se actualizan los conteos, validar la suma
      if (birthData.total_born !== undefined || birthData.born_alive !== undefined || 
          birthData.born_dead !== undefined || birthData.mummified !== undefined) {
        
        const total = birthData.total_born ?? existingBirth.total_born;
        const alive = birthData.born_alive ?? existingBirth.born_alive;
        const dead = birthData.born_dead ?? existingBirth.born_dead;
        const mummified = birthData.mummified ?? existingBirth.mummified ?? 0;
        
        if (total !== (alive + dead + mummified)) {
          return res.status(400).json({
            success: false,
            message: `Total nacidos debe ser igual a vivos + muertos + momificados`
          });
        }
      }

      // Sanitizar campos booleanos
      const booleanFields = ['assistance_required', 'oxytocin_applied', 'antibiotics_applied'];
      booleanFields.forEach(field => {
        if (birthData.hasOwnProperty(field)) {
          birthData[field] = Boolean(birthData[field]);
        }
      });

      // Sanitizar campos numéricos
      const numericFields = ['total_litter_weight', 'avg_piglet_weight', 'sow_temperature'];
      numericFields.forEach(field => {
        if (birthData.hasOwnProperty(field)) {
          if (birthData[field] !== null && birthData[field] !== '' && birthData[field] !== undefined) {
            birthData[field] = parseFloat(birthData[field]);
          } else {
            birthData[field] = null;
          }
        }
      });

      // Sanitizar campos de fecha/hora vacíos
      const dateTimeFields = ['birth_start_time', 'birth_end_time', 'lactation_start_date', 'expected_weaning_date'];
      dateTimeFields.forEach(field => {
        if (birthData.hasOwnProperty(field)) {
          if (birthData[field] === '' || birthData[field] === null || birthData[field] === undefined) {
            birthData[field] = null;
          }
        }
      });

      // Agregar usuario que actualizó
      if (req.user) {
        birthData.updated_by = req.user.email;
      }

      const updatedBirth = await birthModel.partialUpdate(id, birthData);

      res.json({
        success: true,
        message: 'Parto actualizado exitosamente',
        data: updatedBirth
      });
    } catch (error) {
      console.error('Error al actualizar parto:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar parto',
        error: error.message
      });
    }
  },

  // DELETE /api/births/:id - Eliminar un parto
  delete: async (req, res) => {
    try {
      const { id } = req.params;
      
      // Verificar que el parto existe
      const existingBirth = await birthModel.getById(id);
      if (!existingBirth) {
        return res.status(404).json({
          success: false,
          message: 'Parto no encontrado'
        });
      }

      // NOTA: En producción, considerar si los partos deben ser eliminables o solo marcados como inactivos
      // Los partos son registros históricos importantes para la trazabilidad

      const deletedBirth = await birthModel.delete(id);
      
      res.json({
        success: true,
        message: 'Parto eliminado exitosamente',
        data: deletedBirth
      });
    } catch (error) {
      console.error('Error al eliminar parto:', error);
      
      // Si hay constraint de foreign key (lechones asociados)
      if (error.code === '23503') {
        return res.status(400).json({
          success: false,
          message: 'No se puede eliminar el parto porque tiene lechones asociados'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error al eliminar parto',
        error: error.message
      });
    }
  },

  // POST /api/births/:id/wean - Destetar camada completa manualmente
  weanLitter: async (req, res) => {
    try {
      const { id } = req.params;
      
      // Verificar que el parto existe
      const existingBirth = await birthModel.getById(id);
      if (!existingBirth) {
        return res.status(404).json({
          success: false,
          message: 'Parto no encontrado'
        });
      }

      // Procesar el destete
      const result = await weaningStatusJob.processSpecificBirth(id);
      
      res.json({
        success: true,
        message: `Camada destetada exitosamente. ${result.pigletsWeaned} lechones actualizados.`,
        data: result
      });
    } catch (error) {
      console.error('Error al destetar camada:', error);
      res.status(500).json({
        success: false,
        message: 'Error al destetar camada',
        error: error.message
      });
    }
  },

  // POST /api/births/process-weaning - Procesar todos los destetes pendientes (automático)
  processAllWeaning: async (req, res) => {
    try {
      const result = await weaningStatusJob.processWeaningDates();
      
      res.json({
        success: true,
        message: `Proceso completado. ${result.updated.length} cerdas destetadas automáticamente.`,
        data: result
      });
    } catch (error) {
      console.error('Error al procesar destetes automáticos:', error);
      res.status(500).json({
        success: false,
        message: 'Error al procesar destetes automáticos',
        error: error.message
      });
    }
  }
};

module.exports = birthController;
