const pool = require('../config/db');

/**
 * Constantes de períodos de tiempo (en días)
 */
const PERIODS = {
  HEAT_CYCLE_DAYS: 21,           // Ciclo estral normal (celo cada 21 días)
  MIN_HEAT_INTERVAL: 18,         // Mínimo entre celos (18-24 días es normal)
  POST_PARTURITION_RECOVERY: 21, // Recuperación post-parto (21-28 días)
  POST_ABORTION_RECOVERY: 14,    // Recuperación post-aborto (14-21 días)
  SERVICE_WINDOW: 3,             // Ventana para múltiples servicios en mismo celo (3 días)
  GESTATION_PERIOD: 114          // Duración gestación (114 días promedio)
};

/**
 * Valida si una cerda puede entrar en celo
 */
const canRegisterHeat = async (sowId, heatDate) => {
  const errors = [];
  const warnings = [];
  
  try {
    // 1. Verificar si la cerda existe y está activa
    const sowResult = await pool.query(
      'SELECT * FROM sows WHERE id = $1',
      [sowId]
    );
    
    if (!sowResult.rows[0]) {
      errors.push('Cerda no encontrada');
      return { valid: false, errors, warnings };
    }
    
    const sow = sowResult.rows[0];
    
    if (sow.status !== 'activa') {
      errors.push(`La cerda no está activa (Estado actual: ${sow.status})`);
    }
    
    // 2. Verificar si tiene gestación activa y confirmada
    const pregnancyResult = await pool.query(
      `SELECT * FROM pregnancies 
       WHERE sow_id = $1 
       AND status = 'en curso' 
       AND confirmed = true
       ORDER BY created_at DESC 
       LIMIT 1`,
      [sowId]
    );
    
    if (pregnancyResult.rows.length > 0) {
      const pregnancy = pregnancyResult.rows[0];
      errors.push(
        `La cerda tiene una gestación activa confirmada. ` +
        `Fecha esperada de parto: ${pregnancy.expected_farrowing_date ? 
          new Date(pregnancy.expected_farrowing_date).toLocaleDateString('es-ES') : 'No definida'}`
      );
    }
    
    // 3. Verificar si está en lactancia (tiene parto reciente, menos de 28 días)
    const birthResult = await pool.query(
      `SELECT b.* FROM births b
       WHERE b.sow_id = $1
       AND b.birth_date >= CURRENT_DATE - INTERVAL '28 days'
       ORDER BY b.birth_date DESC
       LIMIT 1`,
      [sowId]
    );
    
    if (birthResult.rows.length > 0) {
      const birth = birthResult.rows[0];
      const daysSinceBirth = Math.floor(
        (new Date(heatDate) - new Date(birth.birth_date)) / (1000 * 60 * 60 * 24)
      );
      
      // Solo considerar en lactancia si han pasado menos de 21 días
      if (daysSinceBirth < PERIODS.POST_PARTURITION_RECOVERY) {
        errors.push(
          `La cerda está en período de lactancia (Parto: ${new Date(birth.birth_date).toLocaleDateString('es-ES')}, ` +
          `hace ${daysSinceBirth} días). Mínimo recomendado: ${PERIODS.POST_PARTURITION_RECOVERY} días post-parto.`
        );
      }
    }
    
    // 4. Verificar último celo (no debe tener celo reciente)
    const lastHeatResult = await pool.query(
      `SELECT * FROM heats 
       WHERE sow_id = $1 
       AND status IN ('detectado', 'servido')
       ORDER BY heat_date DESC 
       LIMIT 1`,
      [sowId]
    );
    
    if (lastHeatResult.rows.length > 0) {
      const lastHeat = lastHeatResult.rows[0];
      const daysSinceLastHeat = Math.floor(
        (new Date(heatDate) - new Date(lastHeat.heat_date)) / (1000 * 60 * 60 * 24)
      );
      
      if (daysSinceLastHeat < PERIODS.MIN_HEAT_INTERVAL) {
        errors.push(
          `Intervalo muy corto desde el último celo (${daysSinceLastHeat} días). ` +
          `El intervalo normal es de ${PERIODS.MIN_HEAT_INTERVAL}-24 días.`
        );
      } else if (daysSinceLastHeat < PERIODS.HEAT_CYCLE_DAYS) {
        warnings.push(
          `Intervalo menor al ciclo estral normal (${daysSinceLastHeat} días vs ${PERIODS.HEAT_CYCLE_DAYS} días esperados). ` +
          `Verifique que sea correcto.`
        );
      }
    }
    
    // 5. Esta validación ya está cubierta en el paso 3 (lactancia)
    // No es necesario duplicarla
    
    // 6. Verificar período de recuperación post-aborto
    const lastAbortionResult = await pool.query(
      `SELECT * FROM abortions 
       WHERE sow_id = $1 
       ORDER BY abortion_date DESC 
       LIMIT 1`,
      [sowId]
    );
    
    if (lastAbortionResult.rows.length > 0) {
      const lastAbortion = lastAbortionResult.rows[0];
      const daysSinceAbortion = Math.floor(
        (new Date(heatDate) - new Date(lastAbortion.abortion_date)) / (1000 * 60 * 60 * 24)
      );
      
      if (daysSinceAbortion < PERIODS.POST_ABORTION_RECOVERY) {
        errors.push(
          `La cerda está en período de recuperación post-aborto ` +
          `(${daysSinceAbortion} días transcurridos, mínimo recomendado: ${PERIODS.POST_ABORTION_RECOVERY} días).`
        );
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      reproductiveStatus: sow.reproductive_status
    };
    
  } catch (error) {
    console.error('Error en validación de celo:', error);
    throw error;
  }
};

/**
 * Valida si se puede registrar un servicio para un celo
 */
const canRegisterService = async (sowId, heatId, serviceDate) => {
  const errors = [];
  const warnings = [];
  
  try {
    // 1. Verificar que la cerda existe y está activa
    const sowResult = await pool.query(
      'SELECT * FROM sows WHERE id = $1',
      [sowId]
    );
    
    if (!sowResult.rows[0]) {
      errors.push('Cerda no encontrada');
      return { valid: false, errors, warnings };
    }
    
    const sow = sowResult.rows[0];
    
    if (sow.status !== 'activa') {
      errors.push(`La cerda no está activa (Estado actual: ${sow.status})`);
    }
    
    // 2. Verificar que el celo existe y pertenece a la cerda
    const heatResult = await pool.query(
      'SELECT * FROM heats WHERE id = $1',
      [heatId]
    );
    
    if (!heatResult.rows[0]) {
      errors.push('Celo no encontrado');
      return { valid: false, errors, warnings };
    }
    
    const heat = heatResult.rows[0];
    
    if (heat.sow_id !== sowId) {
      errors.push('El celo no corresponde a la cerda seleccionada');
    }
    
    // 3. Verificar si el celo ya fue servido
    if (heat.status === 'servido') {
      // Verificar cuántos servicios tiene
      const servicesResult = await pool.query(
        'SELECT * FROM services WHERE heat_id = $1 ORDER BY service_date',
        [heatId]
      );
      
      if (servicesResult.rows.length > 0) {
        const lastService = servicesResult.rows[servicesResult.rows.length - 1];
        const daysSinceLastService = Math.floor(
          (new Date(serviceDate) - new Date(lastService.service_date)) / (1000 * 60 * 60 * 24)
        );
        
        // Permitir múltiples servicios dentro de la ventana del mismo celo
        if (daysSinceLastService > PERIODS.SERVICE_WINDOW) {
          errors.push(
            `El celo ya fue servido hace ${daysSinceLastService} días. ` +
            `Para múltiples servicios, deben estar dentro de ${PERIODS.SERVICE_WINDOW} días del celo.`
          );
        } else {
          warnings.push(
            `Este es un servicio adicional para el mismo celo (Servicio #${servicesResult.rows.length + 1}).`
          );
        }
      }
    }
    
    if (heat.status === 'no servido' || heat.status === 'cancelado') {
      warnings.push(`El celo tiene estado "${heat.status}". Verifique si es correcto registrar un servicio.`);
    }
    
    // 4. Verificar si tiene gestación activa
    const pregnancyResult = await pool.query(
      `SELECT * FROM pregnancies 
       WHERE sow_id = $1 
       AND status = 'en curso' 
       AND confirmed = true
       ORDER BY created_at DESC 
       LIMIT 1`,
      [sowId]
    );
    
    if (pregnancyResult.rows.length > 0) {
      errors.push('La cerda ya tiene una gestación activa confirmada. No se puede registrar un servicio.');
    }
    
    // 5. Verificar si está en lactancia (parto reciente, menos de 21 días)
    const birthResult = await pool.query(
      `SELECT * FROM births 
       WHERE sow_id = $1 
       AND birth_date >= CURRENT_DATE - INTERVAL '28 days'
       ORDER BY birth_date DESC 
       LIMIT 1`,
      [sowId]
    );
    
    if (birthResult.rows.length > 0) {
      const birth = birthResult.rows[0];
      const daysSinceBirth = Math.floor(
        (new Date(serviceDate) - new Date(birth.birth_date)) / (1000 * 60 * 60 * 24)
      );
      
      if (daysSinceBirth < PERIODS.POST_PARTURITION_RECOVERY) {
        errors.push(
          `La cerda está en período de lactancia (Parto: ${new Date(birth.birth_date).toLocaleDateString('es-ES')}, ` +
          `hace ${daysSinceBirth} días). Debe esperar al menos ${PERIODS.POST_PARTURITION_RECOVERY} días post-parto.`
        );
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
    
  } catch (error) {
    console.error('Error en validación de servicio:', error);
    throw error;
  }
};

/**
 * Valida si se puede registrar una gestación
 */
const canRegisterPregnancy = async (sowId, serviceId, conceptionDate) => {
  const errors = [];
  const warnings = [];
  
  try {
    // 1. Verificar que la cerda existe y está activa
    const sowResult = await pool.query(
      'SELECT * FROM sows WHERE id = $1',
      [sowId]
    );
    
    if (!sowResult.rows[0]) {
      errors.push('Cerda no encontrada');
      return { valid: false, errors, warnings };
    }
    
    const sow = sowResult.rows[0];
    
    if (sow.status !== 'activa') {
      errors.push(`La cerda no está activa (Estado actual: ${sow.status})`);
    }
    
    // 2. Verificar si tiene gestación activa
    const activePregnancyResult = await pool.query(
      `SELECT * FROM pregnancies 
       WHERE sow_id = $1 
       AND status = 'en curso'
       ORDER BY created_at DESC 
       LIMIT 1`,
      [sowId]
    );
    
    if (activePregnancyResult.rows.length > 0) {
      const pregnancy = activePregnancyResult.rows[0];
      errors.push(
        `La cerda ya tiene una gestación activa. ` +
        `${pregnancy.confirmed ? 'Confirmada' : 'Pendiente de confirmar'} - ` +
        `Fecha esperada de parto: ${pregnancy.expected_farrowing_date ? 
          new Date(pregnancy.expected_farrowing_date).toLocaleDateString('es-ES') : 'No definida'}`
      );
    }
    
    // 3. Verificar si está en lactancia (parto reciente, menos de 21 días)
    const birthResult = await pool.query(
      `SELECT * FROM births 
       WHERE sow_id = $1 
       AND birth_date >= CURRENT_DATE - INTERVAL '28 days'
       ORDER BY birth_date DESC 
       LIMIT 1`,
      [sowId]
    );
    
    if (birthResult.rows.length > 0) {
      const birth = birthResult.rows[0];
      const daysSinceBirth = Math.floor(
        (new Date(conceptionDate) - new Date(birth.birth_date)) / (1000 * 60 * 60 * 24)
      );
      
      if (daysSinceBirth < PERIODS.POST_PARTURITION_RECOVERY) {
        errors.push(
          `La cerda está en período de lactancia (Parto: ${new Date(birth.birth_date).toLocaleDateString('es-ES')}, ` +
          `hace ${daysSinceBirth} días). Debe esperar al menos ${PERIODS.POST_PARTURITION_RECOVERY} días post-parto.`
        );
      }
    }
    
    // 4. Verificar que el servicio existe y pertenece a la cerda
    const serviceResult = await pool.query(
      'SELECT * FROM services WHERE id = $1',
      [serviceId]
    );
    
    if (!serviceResult.rows[0]) {
      errors.push('Servicio no encontrado');
      return { valid: false, errors, warnings };
    }
    
    const service = serviceResult.rows[0];
    
    if (service.sow_id !== sowId) {
      errors.push('El servicio no corresponde a la cerda seleccionada');
    }
    
    // 5. Verificar si el servicio ya tiene gestación asociada
    const existingPregnancyResult = await pool.query(
      'SELECT * FROM pregnancies WHERE service_id = $1',
      [serviceId]
    );
    
    if (existingPregnancyResult.rows.length > 0) {
      warnings.push('Este servicio ya tiene una gestación registrada.');
    }
    
    // 6. Verificar período de recuperación post-aborto
    const lastAbortionResult = await pool.query(
      `SELECT * FROM abortions 
       WHERE sow_id = $1 
       ORDER BY abortion_date DESC 
       LIMIT 1`,
      [sowId]
    );
    
    if (lastAbortionResult.rows.length > 0) {
      const lastAbortion = lastAbortionResult.rows[0];
      const daysSinceAbortion = Math.floor(
        (new Date(conceptionDate) - new Date(lastAbortion.abortion_date)) / (1000 * 60 * 60 * 24)
      );
      
      if (daysSinceAbortion < PERIODS.POST_ABORTION_RECOVERY) {
        warnings.push(
          `Gestación registrada poco después de un aborto ` +
          `(${daysSinceAbortion} días, recomendado: ${PERIODS.POST_ABORTION_RECOVERY}+ días).`
        );
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
    
  } catch (error) {
    console.error('Error en validación de gestación:', error);
    throw error;
  }
};

/**
 * Valida si se puede inducir un celo
 */
const canInduceHeat = async (sowId, inductionDate) => {
  const errors = [];
  const warnings = [];
  
  try {
    // Usar las mismas validaciones que para celo natural
    const naturalHeatValidation = await canRegisterHeat(sowId, inductionDate);
    
    // Para celo inducido, podemos ser más flexibles con ciertos intervalos
    if (!naturalHeatValidation.valid) {
      // Filtrar algunos errores que pueden ser menos estrictos para inducción
      naturalHeatValidation.errors.forEach(error => {
        if (error.includes('Intervalo muy corto')) {
          warnings.push(`Celo inducido: ${error}`);
        } else {
          errors.push(error);
        }
      });
    }
    
    warnings.push(...naturalHeatValidation.warnings);
    warnings.push('Celo inducido: asegúrese de registrar el protocolo y fecha de inducción.');
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
    
  } catch (error) {
    console.error('Error en validación de inducción:', error);
    throw error;
  }
};

/**
 * Obtiene el estado reproductivo completo de una cerda
 */
const getReproductiveStatus = async (sowId) => {
  try {
    const sow = await pool.query('SELECT * FROM sows WHERE id = $1', [sowId]);
    if (!sow.rows[0]) {
      return null;
    }
    
    const [lastHeat, lastService, activePregnancy, lastBirth, lastAbortion, activeLactation] = await Promise.all([
      pool.query(
        'SELECT * FROM heats WHERE sow_id = $1 ORDER BY heat_date DESC LIMIT 1',
        [sowId]
      ),
      pool.query(
        'SELECT * FROM services WHERE sow_id = $1 ORDER BY service_date DESC LIMIT 1',
        [sowId]
      ),
      pool.query(
        'SELECT * FROM pregnancies WHERE sow_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 1',
        [sowId, 'en curso']
      ),
      pool.query(
        'SELECT * FROM births WHERE sow_id = $1 ORDER BY birth_date DESC LIMIT 1',
        [sowId]
      ),
      pool.query(
        'SELECT * FROM abortions WHERE sow_id = $1 ORDER BY abortion_date DESC LIMIT 1',
        [sowId]
      ),
      pool.query(
        'SELECT * FROM births WHERE sow_id = $1 AND birth_date >= CURRENT_DATE - INTERVAL \'28 days\' ORDER BY birth_date DESC LIMIT 1',
        [sowId]
      )
    ]);
    
    // Determinar si está lactando (parto reciente, menos de 21 días)
    let isLactating = false;
    if (activeLactation.rows.length > 0) {
      const birth = activeLactation.rows[0];
      const daysSinceBirth = Math.floor(
        (new Date() - new Date(birth.birth_date)) / (1000 * 60 * 60 * 24)
      );
      isLactating = daysSinceBirth < 21; // 21 días de lactancia
    }
    
    return {
      sow: sow.rows[0],
      lastHeat: lastHeat.rows[0] || null,
      lastService: lastService.rows[0] || null,
      activePregnancy: activePregnancy.rows[0] || null,
      lastBirth: lastBirth.rows[0] || null,
      lastAbortion: lastAbortion.rows[0] || null,
      isLactating: isLactating,
      currentStatus: sow.rows[0].reproductive_status
    };
    
  } catch (error) {
    console.error('Error obteniendo estado reproductivo:', error);
    throw error;
  }
};

module.exports = {
  PERIODS,
  canRegisterHeat,
  canRegisterService,
  canRegisterPregnancy,
  canInduceHeat,
  getReproductiveStatus
};

