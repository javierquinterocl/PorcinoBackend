const boarModel = require('../models/boarModel');

const boarController = {
  // GET /api/boars - Obtener todos los verracos con filtros opcionales
  getAll: async (req, res) => {
    try {
      const filters = {
        status: req.query.status,
        breed: req.query.breed,
        boar_type: req.query.boar_type,
        farm_name: req.query.farm_name
      };

      // Remover filtros undefined
      Object.keys(filters).forEach(key => {
        if (filters[key] === undefined) delete filters[key];
      });

      const boars = await boarModel.getAll(filters);
      
      res.json({
        success: true,
        count: boars.length,
        data: boars
      });
    } catch (error) {
      console.error('Error al obtener verracos:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener verracos',
        error: error.message
      });
    }
  },

  // GET /api/boars/stats - Obtener estadísticas
  getStats: async (req, res) => {
    try {
      const stats = await boarModel.getStats();
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

  // GET /api/boars/:id - Obtener un verraco por ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const boar = await boarModel.getById(id);
      
      if (!boar) {
        return res.status(404).json({
          success: false,
          message: 'Verraco no encontrado'
        });
      }

      res.json({
        success: true,
        data: boar
      });
    } catch (error) {
      console.error('Error al obtener verraco:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener verraco',
        error: error.message
      });
    }
  },

  // GET /api/boars/ear-tag/:ear_tag - Obtener verraco por arete
  getByEarTag: async (req, res) => {
    try {
      const { ear_tag } = req.params;
      const boar = await boarModel.getByEarTag(ear_tag);
      
      if (!boar) {
        return res.status(404).json({
          success: false,
          message: 'Verraco no encontrado'
        });
      }

      res.json({
        success: true,
        data: boar
      });
    } catch (error) {
      console.error('Error al obtener verraco:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener verraco',
        error: error.message
      });
    }
  },

  // POST /api/boars - Crear un nuevo verraco
  create: async (req, res) => {
    try {
      const boarData = req.body;

      // Validaciones obligatorias comunes
      const requiredFields = ['ear_tag', 'id_type', 'breed', 'boar_type'];
      const missingFields = requiredFields.filter(field => !boarData[field]);

      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Faltan campos obligatorios: ${missingFields.join(', ')}`
        });
      }

      // Validaciones específicas según el tipo de verraco
      if (boarData.boar_type === 'fisico') {
        const requiredPhysicalFields = ['birth_date', 'entry_date', 'farm_name'];
        const missingPhysicalFields = requiredPhysicalFields.filter(field => !boarData[field]);
        
        if (missingPhysicalFields.length > 0) {
          return res.status(400).json({
            success: false,
            message: `Para verracos físicos se requieren: ${missingPhysicalFields.join(', ')}`
          });
        }
      } else if (boarData.boar_type === 'semen comprado') {
        if (!boarData.supplier_name) {
          return res.status(400).json({
            success: false,
            message: 'Para semen comprado se requiere el nombre del proveedor'
          });
        }
      }

      // Verificar que el ear_tag no exista
      const existingBoar = await boarModel.getByEarTag(boarData.ear_tag);
      if (existingBoar) {
        return res.status(409).json({
          success: false,
          message: 'El arete (ear_tag) ya está registrado'
        });
      }

      // Sanitizar campos numéricos - convertir cadenas vacías a null
      const numericFields = ['generation', 'current_weight', 'total_services'];
      
      numericFields.forEach(field => {
        if (boarData.hasOwnProperty(field)) {
          if (boarData[field] === '' || boarData[field] === null || boarData[field] === undefined) {
            boarData[field] = null;
          } else if (typeof boarData[field] === 'string') {
            const parsed = parseFloat(boarData[field]);
            boarData[field] = isNaN(parsed) ? null : parsed;
          }
        }
      });

      // Sanitizar campos de fecha - convertir cadenas vacías a null
      const dateFields = ['birth_date', 'entry_date', 'last_service_date'];
      
      dateFields.forEach(field => {
        if (boarData.hasOwnProperty(field)) {
          if (boarData[field] === '' || boarData[field] === null || boarData[field] === undefined) {
            boarData[field] = null;
          }
        }
      });

      // Agregar usuario que creó el registro
      if (req.user) {
        boarData.created_by = req.user.email;
      }

      const newBoar = await boarModel.create(boarData);
      
      res.status(201).json({
        success: true,
        message: 'Verraco creado exitosamente',
        data: newBoar
      });
    } catch (error) {
      console.error('Error al crear verraco:', error);
      
      // Manejar errores de constraint de base de datos
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
        message: 'Error al crear verraco',
        error: error.message
      });
    }
  },

  // PUT /api/boars/:id - Actualizar un verraco completamente
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const boarData = req.body;

      // Verificar que el verraco existe
      const existingBoar = await boarModel.getById(id);
      if (!existingBoar) {
        return res.status(404).json({
          success: false,
          message: 'Verraco no encontrado'
        });
      }

      // Validar que el verraco no esté descartado
      if (existingBoar.status === 'descartado') {
        return res.status(403).json({
          success: false,
          message: 'No se puede modificar un verraco descartado. El descarte es un estado final.'
        });
      }

      // Si se cambia el ear_tag, verificar que no exista
      if (boarData.ear_tag && boarData.ear_tag !== existingBoar.ear_tag) {
        const earTagExists = await boarModel.getByEarTag(boarData.ear_tag);
        if (earTagExists) {
          return res.status(409).json({
            success: false,
            message: 'El arete ya está registrado en otro verraco'
          });
        }
      }

      // Sanitizar campos numéricos
      const numericFields = ['generation', 'current_weight', 'total_services'];
      
      numericFields.forEach(field => {
        if (boarData[field] === '' || boarData[field] === null || boarData[field] === undefined) {
          boarData[field] = null;
        } else if (typeof boarData[field] === 'string') {
          const parsed = parseFloat(boarData[field]);
          boarData[field] = isNaN(parsed) ? null : parsed;
        }
      });

      // Sanitizar campos de fecha
      const dateFields = ['birth_date', 'entry_date', 'last_service_date'];
      
      dateFields.forEach(field => {
        if (boarData[field] === '' || boarData[field] === null || boarData[field] === undefined) {
          boarData[field] = null;
        }
      });

      // Agregar usuario que actualizó
      if (req.user) {
        boarData.updated_by = req.user.email;
      }

      const updatedBoar = await boarModel.update(id, boarData);

      res.json({
        success: true,
        message: 'Verraco actualizado exitosamente',
        data: updatedBoar
      });
    } catch (error) {
      console.error('Error al actualizar verraco:', error);
      
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
        message: 'Error al actualizar verraco',
        error: error.message
      });
    }
  },

  // PATCH /api/boars/:id - Actualizar campos específicos
  partialUpdate: async (req, res) => {
    try {
      const { id } = req.params;
      const boarData = req.body;

      // Verificar que el verraco existe
      const existingBoar = await boarModel.getById(id);
      if (!existingBoar) {
        return res.status(404).json({
          success: false,
          message: 'Verraco no encontrado'
        });
      }

      // Validar que el verraco no esté descartado
      if (existingBoar.status === 'descartado') {
        return res.status(403).json({
          success: false,
          message: 'No se puede modificar un verraco descartado. El descarte es un estado final.'
        });
      }

      // Sanitizar campos numéricos
      const numericFields = ['generation', 'current_weight', 'total_services'];
      
      numericFields.forEach(field => {
        if (boarData.hasOwnProperty(field)) {
          if (boarData[field] === '' || boarData[field] === null || boarData[field] === undefined) {
            boarData[field] = null;
          } else if (typeof boarData[field] === 'string') {
            const parsed = parseFloat(boarData[field]);
            boarData[field] = isNaN(parsed) ? null : parsed;
          }
        }
      });

      // Sanitizar campos de fecha
      const dateFields = ['birth_date', 'entry_date', 'last_service_date'];
      
      dateFields.forEach(field => {
        if (boarData.hasOwnProperty(field)) {
          if (boarData[field] === '' || boarData[field] === null || boarData[field] === undefined) {
            boarData[field] = null;
          }
        }
      });

      // Agregar usuario que actualizó
      if (req.user) {
        boarData.updated_by = req.user.email;
      }

      const updatedBoar = await boarModel.partialUpdate(id, boarData);

      res.json({
        success: true,
        message: 'Verraco actualizado exitosamente',
        data: updatedBoar
      });
    } catch (error) {
      console.error('Error al actualizar verraco:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar verraco',
        error: error.message
      });
    }
  },

  // DELETE /api/boars/:id - Descartar verraco (soft delete)
  softDelete: async (req, res) => {
    try {
      const { id } = req.params;
      
      // Verificar que el verraco existe y su estado actual
      const existingBoar = await boarModel.getById(id);
      if (!existingBoar) {
        return res.status(404).json({
          success: false,
          message: 'Verraco no encontrado'
        });
      }

      // Validar que el verraco no esté ya descartado
      if (existingBoar.status === 'descartado') {
        return res.status(400).json({
          success: false,
          message: 'Este verraco ya está descartado. No se puede volver a descartar.'
        });
      }

      const deletedBoar = await boarModel.softDelete(id);
      
      if (!deletedBoar) {
        return res.status(404).json({
          success: false,
          message: 'Verraco no encontrado'
        });
      }

      res.json({
        success: true,
        message: 'Verraco descartado exitosamente',
        data: deletedBoar
      });
    } catch (error) {
      console.error('Error al descartar verraco:', error);
      res.status(500).json({
        success: false,
        message: 'Error al descartar verraco',
        error: error.message
      });
    }
  },

  // DELETE /api/boars/:id/permanent - Eliminar verraco permanentemente
  delete: async (req, res) => {
    try {
      const { id } = req.params;
      const deletedBoar = await boarModel.delete(id);
      
      if (!deletedBoar) {
        return res.status(404).json({
          success: false,
          message: 'Verraco no encontrado'
        });
      }

      res.json({
        success: true,
        message: 'Verraco eliminado permanentemente',
        data: deletedBoar
      });
    } catch (error) {
      console.error('Error al eliminar verraco:', error);
      res.status(500).json({
        success: false,
        message: 'Error al eliminar verraco',
        error: error.message
      });
    }
  },

  // POST /api/boars/upload-photo - Subir foto de verraco
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
  }
};

module.exports = boarController;
