const sowModel = require('../models/sowModel');
const { getReproductiveStatus } = require('../utils/reproductiveValidations');

const sowController = {
  // GET /api/sows - Obtener todas las cerdas con filtros opcionales
  getAll: async (req, res) => {
    try {
      const filters = {
        status: req.query.status,
        breed: req.query.breed,
        reproductive_status: req.query.reproductive_status,
        farm_name: req.query.farm_name
      };

      // Remover filtros undefined
      Object.keys(filters).forEach(key => {
        if (filters[key] === undefined) delete filters[key];
      });

      const sows = await sowModel.getAll(filters);
      
      res.json({
        success: true,
        count: sows.length,
        data: sows
      });
    } catch (error) {
      console.error('Error al obtener cerdas:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener cerdas',
        error: error.message
      });
    }
  },

  // GET /api/sows/stats - Obtener estadísticas
  getStats: async (req, res) => {
    try {
      const stats = await sowModel.getStats();
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

  // GET /api/sows/:id - Obtener una cerda por ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const sow = await sowModel.getById(id);
      
      if (!sow) {
        return res.status(404).json({
          success: false,
          message: 'Cerda no encontrada'
        });
      }

      res.json({
        success: true,
        data: sow
      });
    } catch (error) {
      console.error('Error al obtener cerda:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener cerda',
        error: error.message
      });
    }
  },

  // GET /api/sows/ear-tag/:ear_tag - Obtener cerda por arete
  getByEarTag: async (req, res) => {
    try {
      const { ear_tag } = req.params;
      const sow = await sowModel.getByEarTag(ear_tag);
      
      if (!sow) {
        return res.status(404).json({
          success: false,
          message: 'Cerda no encontrada'
        });
      }

      res.json({
        success: true,
        data: sow
      });
    } catch (error) {
      console.error('Error al obtener cerda:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener cerda',
        error: error.message
      });
    }
  },

  // POST /api/sows - Crear una nueva cerda
  create: async (req, res) => {
    try {
      const sowData = req.body;

      // Validaciones obligatorias
      const requiredFields = ['ear_tag', 'id_type', 'breed', 'birth_date', 'entry_date', 'farm_name', 'current_weight', 'body_condition'];
      const missingFields = requiredFields.filter(field => !sowData[field]);

      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Faltan campos obligatorios: ${missingFields.join(', ')}`
        });
      }

      // Verificar que el ear_tag no exista
      const existingSow = await sowModel.getByEarTag(sowData.ear_tag);
      if (existingSow) {
        return res.status(409).json({
          success: false,
          message: 'El arete (ear_tag) ya está registrado'
        });
      }

      // Sanitizar campos numéricos - convertir cadenas vacías a null o valores por defecto
      const numericFields = [
        'generation', 'parity_count', 'total_piglets_born', 
        'total_piglets_alive', 'total_piglets_dead', 'total_abortions',
        'current_weight', 'min_service_weight', 'body_condition', 'avg_piglets_alive'
      ];
      
      numericFields.forEach(field => {
        if (sowData.hasOwnProperty(field)) {
          if (sowData[field] === '' || sowData[field] === null || sowData[field] === undefined) {
            // Para campos con default 0 en la BD, mantener el default
            if (['parity_count', 'total_piglets_born', 'total_piglets_alive', 
                 'total_piglets_dead', 'total_abortions'].includes(field)) {
              sowData[field] = 0;
            } else {
              sowData[field] = null;
            }
          } else if (typeof sowData[field] === 'string') {
            // Convertir strings numéricos a números
            const parsed = parseFloat(sowData[field]);
            sowData[field] = isNaN(parsed) ? null : parsed;
          }
        }
      });

      // Sanitizar campos de fecha - convertir cadenas vacías a null
      const dateFields = [
        'birth_date', 'entry_date', 'last_weight_date', 
        'last_service_date', 'last_parturition_date', 
        'expected_farrowing_date', 'last_weaning_date'
      ];
      
      dateFields.forEach(field => {
        if (sowData.hasOwnProperty(field)) {
          if (sowData[field] === '' || sowData[field] === null || sowData[field] === undefined) {
            sowData[field] = null;
          }
        }
      });

      // Agregar usuario que creó el registro
      if (req.user) {
        sowData.created_by = req.user.email;
      }

      const newSow = await sowModel.create(sowData);
      
      res.status(201).json({
        success: true,
        message: 'Cerda creada exitosamente',
        data: newSow
      });
    } catch (error) {
      console.error('Error al crear cerda:', error);
      
      // Manejar errores de constraint de base de datos
      if (error.code === '23505') { // unique_violation
        return res.status(409).json({
          success: false,
          message: 'El arete ya está registrado'
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
        message: 'Error al crear cerda',
        error: error.message
      });
    }
  },

  // PUT /api/sows/:id - Actualizar una cerda completamente
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const sowData = req.body;

      // Verificar que la cerda existe
      const existingSow = await sowModel.getById(id);
      if (!existingSow) {
        return res.status(404).json({
          success: false,
          message: 'Cerda no encontrada'
        });
      }

      // Validar que la cerda no esté descartada
      if (existingSow.status === 'descartada') {
        return res.status(403).json({
          success: false,
          message: 'No se puede modificar una cerda descartada. El descarte es un estado final.'
        });
      }

      // Si se cambia el ear_tag, verificar que no exista
      if (sowData.ear_tag && sowData.ear_tag !== existingSow.ear_tag) {
        const earTagExists = await sowModel.getByEarTag(sowData.ear_tag);
        if (earTagExists) {
          return res.status(409).json({
            success: false,
            message: 'El arete ya está registrado en otra cerda'
          });
        }
      }

      // Sanitizar campos numéricos - convertir cadenas vacías a null o valores por defecto
      const numericFields = [
        'generation', 'parity_count', 'total_piglets_born', 
        'total_piglets_alive', 'total_piglets_dead', 'total_abortions',
        'current_weight', 'min_service_weight', 'body_condition', 'avg_piglets_alive'
      ];
      
      numericFields.forEach(field => {
        if (sowData[field] === '' || sowData[field] === null || sowData[field] === undefined) {
          // Para campos con default 0 en la BD, mantener el default
          if (['parity_count', 'total_piglets_born', 'total_piglets_alive', 
               'total_piglets_dead', 'total_abortions'].includes(field)) {
            sowData[field] = 0;
          } else {
            sowData[field] = null;
          }
        } else if (typeof sowData[field] === 'string') {
          // Convertir strings numéricos a números
          const parsed = parseFloat(sowData[field]);
          sowData[field] = isNaN(parsed) ? null : parsed;
        }
      });

      // Sanitizar campos de fecha - convertir cadenas vacías a null
      const dateFields = [
        'birth_date', 'entry_date', 'last_weight_date', 
        'last_service_date', 'last_parturition_date', 
        'expected_farrowing_date', 'last_weaning_date'
      ];
      
      dateFields.forEach(field => {
        if (sowData[field] === '' || sowData[field] === null || sowData[field] === undefined) {
          sowData[field] = null;
        }
      });

      // Agregar usuario que actualizó
      if (req.user) {
        sowData.updated_by = req.user.email;
      }

      const updatedSow = await sowModel.update(id, sowData);

      res.json({
        success: true,
        message: 'Cerda actualizada exitosamente',
        data: updatedSow
      });
    } catch (error) {
      console.error('Error al actualizar cerda:', error);
      
      if (error.code === '23505') {
        return res.status(409).json({
          success: false,
          message: 'El arete ya está registrado'
        });
      }

      if (error.code === '23514') {
        return res.status(400).json({
          success: false,
          message: 'Datos inválidos: verifique los valores de los campos',
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error al actualizar cerda',
        error: error.message
      });
    }
  },

  // PATCH /api/sows/:id - Actualizar campos específicos
  partialUpdate: async (req, res) => {
    try {
      const { id } = req.params;
      const sowData = req.body;

      // Verificar que la cerda existe
      const existingSow = await sowModel.getById(id);
      if (!existingSow) {
        return res.status(404).json({
          success: false,
          message: 'Cerda no encontrada'
        });
      }

      // Validar que la cerda no esté descartada
      if (existingSow.status === 'descartada') {
        return res.status(403).json({
          success: false,
          message: 'No se puede modificar una cerda descartada. El descarte es un estado final.'
        });
      }

      // Sanitizar campos numéricos - convertir cadenas vacías a null o valores por defecto
      const numericFields = [
        'generation', 'parity_count', 'total_piglets_born', 
        'total_piglets_alive', 'total_piglets_dead', 'total_abortions',
        'current_weight', 'min_service_weight', 'body_condition', 'avg_piglets_alive'
      ];
      
      numericFields.forEach(field => {
        if (sowData.hasOwnProperty(field)) {
          if (sowData[field] === '' || sowData[field] === null || sowData[field] === undefined) {
            // Para campos con default 0 en la BD, mantener el default
            if (['parity_count', 'total_piglets_born', 'total_piglets_alive', 
                 'total_piglets_dead', 'total_abortions'].includes(field)) {
              sowData[field] = 0;
            } else {
              sowData[field] = null;
            }
          } else if (typeof sowData[field] === 'string') {
            // Convertir strings numéricos a números
            const parsed = parseFloat(sowData[field]);
            sowData[field] = isNaN(parsed) ? null : parsed;
          }
        }
      });

      // Sanitizar campos de fecha - convertir cadenas vacías a null
      const dateFields = [
        'birth_date', 'entry_date', 'last_weight_date', 
        'last_service_date', 'last_parturition_date', 
        'expected_farrowing_date', 'last_weaning_date'
      ];
      
      dateFields.forEach(field => {
        if (sowData.hasOwnProperty(field)) {
          if (sowData[field] === '' || sowData[field] === null || sowData[field] === undefined) {
            sowData[field] = null;
          }
        }
      });

      // Agregar usuario que actualizó
      if (req.user) {
        sowData.updated_by = req.user.email;
      }

      const updatedSow = await sowModel.partialUpdate(id, sowData);

      res.json({
        success: true,
        message: 'Cerda actualizada exitosamente',
        data: updatedSow
      });
    } catch (error) {
      console.error('Error al actualizar cerda:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar cerda',
        error: error.message
      });
    }
  },

  // DELETE /api/sows/:id - Descartar cerda (soft delete)
  softDelete: async (req, res) => {
    try {
      const { id } = req.params;
      
      // Verificar que la cerda existe y su estado actual
      const existingSow = await sowModel.getById(id);
      if (!existingSow) {
        return res.status(404).json({
          success: false,
          message: 'Cerda no encontrada'
        });
      }

      // Validar que la cerda no esté ya descartada
      if (existingSow.status === 'descartada') {
        return res.status(400).json({
          success: false,
          message: 'Esta cerda ya está descartada. No se puede volver a descartar.'
        });
      }

      const deletedSow = await sowModel.softDelete(id);
      
      if (!deletedSow) {
        return res.status(404).json({
          success: false,
          message: 'Cerda no encontrada'
        });
      }

      res.json({
        success: true,
        message: 'Cerda descartada exitosamente',
        data: deletedSow
      });
    } catch (error) {
      console.error('Error al descartar cerda:', error);
      res.status(500).json({
        success: false,
        message: 'Error al descartar cerda',
        error: error.message
      });
    }
  },

  // DELETE /api/sows/:id/permanent - Eliminar cerda permanentemente
  delete: async (req, res) => {
    try {
      const { id } = req.params;
      const deletedSow = await sowModel.delete(id);
      
      if (!deletedSow) {
        return res.status(404).json({
          success: false,
          message: 'Cerda no encontrada'
        });
      }

      res.json({
        success: true,
        message: 'Cerda eliminada permanentemente',
        data: deletedSow
      });
    } catch (error) {
      console.error('Error al eliminar cerda:', error);
      res.status(500).json({
        success: false,
        message: 'Error al eliminar cerda',
        error: error.message
      });
    }
  },

  // POST /api/sows/upload-photo - Subir foto de cerda
  uploadPhoto: async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No se proporcionó ningún archivo'
        });
      }

      // Convertir imagen a base64
      const imageBuffer = req.file.buffer;
      const base64Image = imageBuffer.toString('base64');
      const mimeType = req.file.mimetype;
      
      // Crear data URL completa
      const imageDataUrl = `data:${mimeType};base64,${base64Image}`;

      res.json({
        success: true,
        message: 'Imagen cargada exitosamente',
        data: {
          photo_url: imageDataUrl,
          size: req.file.size,
          mimetype: mimeType
        }
      });
    } catch (error) {
      console.error('Error al cargar imagen:', error);
      res.status(500).json({
        success: false,
        message: 'Error al cargar imagen',
        error: error.message
      });
    }
  },

  // GET /api/sows/:id/reproductive-status - Obtener estado reproductivo completo
  getReproductiveStatusById: async (req, res) => {
    try {
      const { id } = req.params;
      
      const status = await getReproductiveStatus(id);
      
      if (!status) {
        return res.status(404).json({
          success: false,
          message: 'Cerda no encontrada'
        });
      }

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      console.error('Error al obtener estado reproductivo:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener estado reproductivo',
        error: error.message
      });
    }
  }
};

module.exports = sowController;
