/**
 * Middleware para validar que un parámetro ID sea un número válido
 */
const validateId = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName];
    
    // Validar que el ID sea un número entero válido
    if (!id || isNaN(parseInt(id)) || parseInt(id) <= 0) {
      console.error(`❌ [validateId] ID inválido: "${id}" (parámetro: ${paramName})`);
      return res.status(400).json({
        success: false,
        message: `ID inválido: "${id}". El ID debe ser un número entero positivo.`,
        error: `El parámetro "${paramName}" debe ser un número válido`
      });
    }
    
    // ID es válido, continuar
    next();
  };
};

module.exports = { validateId };

