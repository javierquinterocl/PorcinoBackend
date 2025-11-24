const cron = require('node-cron');
const pool = require('../config/db');

/**
 * Procesa los destetes automáticos basados en la fecha esperada de destete
 * @returns {Promise<Object>} Resultado con las camadas destetadas
 */
const processWeaningDates = async () => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('🔍 Buscando partos listos para destete automático...');
    
    // Buscar partos donde la fecha esperada de destete ya pasó
    // y que aún no han sido completamente destetados
    const birthsToWean = await client.query(`
      SELECT 
        b.id,
        b.sow_id,
        b.expected_weaning_date,
        s.ear_tag as sow_ear_tag,
        b.born_alive,
        COUNT(p.id) as total_piglets,
        COUNT(CASE WHEN p.current_status = 'destetado' THEN 1 END) as weaned_count
      FROM births b
      INNER JOIN sows s ON b.sow_id = s.id
      LEFT JOIN piglets p ON p.birth_id = b.id
      WHERE b.expected_weaning_date <= CURRENT_DATE
        AND b.born_alive > 0
      GROUP BY b.id, b.sow_id, b.expected_weaning_date, s.ear_tag, b.born_alive
      HAVING COUNT(CASE WHEN p.current_status = 'destetado' THEN 1 END) < COUNT(p.id)
         OR COUNT(p.id) = 0
    `);

    if (birthsToWean.rows.length === 0) {
      console.log('✅ No hay partos pendientes de destete automático.');
      await client.query('COMMIT');
      return { 
        success: true, 
        processed: 0, 
        births: [] 
      };
    }

    console.log(`📋 Encontrados ${birthsToWean.rows.length} partos para destete automático`);

    const processedBirths = [];

    for (const birth of birthsToWean.rows) {
      console.log(`\n🐷 Procesando destete de camada ${birth.id} - Cerda ${birth.sow_ear_tag}`);
      console.log(`   Fecha esperada de destete: ${birth.expected_weaning_date}`);
      console.log(`   Lechones vivos registrados: ${birth.born_alive}`);
      console.log(`   Lechones en BD: ${birth.total_piglets} (${birth.weaned_count} ya destetados)`);

      // Actualizar todos los lechones de este parto a estado 'destetado'
      // usando la fecha esperada de destete como weaning_date
      const updateResult = await client.query(`
        UPDATE piglets
        SET 
          current_status = 'destetado',
          weaning_date = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE birth_id = $2
          AND current_status != 'destetado'
        RETURNING id, ear_tag
      `, [birth.expected_weaning_date, birth.id]);

      console.log(`   ✅ ${updateResult.rows.length} lechones destetados automáticamente`);

      // El trigger de la base de datos se encargará de:
      // 1. Actualizar el estado de la cerda a 'vacia'
      // 2. Establecer last_weaning_date
      // Los triggers se disparan automáticamente al actualizar los piglets

      processedBirths.push({
        birthId: birth.id,
        sowId: birth.sow_id,
        sowEarTag: birth.sow_ear_tag,
        weaningDate: birth.expected_weaning_date,
        pigletsWeaned: updateResult.rows.length,
        piglets: updateResult.rows
      });
    }

    await client.query('COMMIT');
    
    console.log(`\n✅ Destete automático completado: ${processedBirths.length} camadas procesadas`);
    
    return {
      success: true,
      processed: processedBirths.length,
      births: processedBirths
    };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error en destete automático:', error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Procesa el destete de una camada específica de forma manual
 * Útil para destetar inmediatamente sin esperar a la fecha programada
 * @param {number} birthId - ID del parto a destetar
 * @returns {Promise<Object>} Resultado del destete
 */
const processSpecificBirth = async (birthId) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Obtener información del parto
    const birthInfo = await client.query(`
      SELECT 
        b.id,
        b.sow_id,
        b.expected_weaning_date,
        s.ear_tag as sow_ear_tag,
        b.born_alive,
        COUNT(p.id) as total_piglets,
        COUNT(CASE WHEN p.current_status = 'destetado' THEN 1 END) as weaned_count
      FROM births b
      INNER JOIN sows s ON b.sow_id = s.id
      LEFT JOIN piglets p ON p.birth_id = b.id
      WHERE b.id = $1
      GROUP BY b.id, b.sow_id, b.expected_weaning_date, s.ear_tag, b.born_alive
    `, [birthId]);

    if (birthInfo.rows.length === 0) {
      throw new Error(`Parto con ID ${birthId} no encontrado`);
    }

    const birth = birthInfo.rows[0];

    if (birth.weaned_count === birth.total_piglets && birth.total_piglets > 0) {
      console.log(`⚠️ Todos los lechones de la camada ${birthId} ya están destetados`);
      return {
        success: true,
        alreadyWeaned: true,
        message: 'Todos los lechones ya estaban destetados'
      };
    }

    console.log(`🐷 Destetando manualmente camada ${birthId} - Cerda ${birth.sow_ear_tag}`);

    // Usar la fecha esperada de destete para el weaning_date
    const weaningDate = birth.expected_weaning_date;

    // Actualizar lechones no destetados
    const updateResult = await client.query(`
      UPDATE piglets
      SET 
        current_status = 'destetado',
        weaning_date = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE birth_id = $2
        AND current_status != 'destetado'
      RETURNING id, ear_tag
    `, [weaningDate, birthId]);

    console.log(`   ✅ ${updateResult.rows.length} lechones destetados`);

    await client.query('COMMIT');

    return {
      success: true,
      alreadyWeaned: false,
      birthId: birth.id,
      sowId: birth.sow_id,
      sowEarTag: birth.sow_ear_tag,
      weaningDate: weaningDate,
      pigletsWeaned: updateResult.rows.length,
      piglets: updateResult.rows
    };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`❌ Error al destetar camada ${birthId}:`, error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Job que se ejecuta diariamente para procesar destetes automáticos
 * Se ejecuta todos los días a las 3:00 AM
 */
const weaningStatusJob = cron.schedule('0 3 * * *', async () => {
  try {
    console.log('🔄 Ejecutando job: Destete automático de camadas...');
    
    const result = await processWeaningDates();
    
    if (result.processed > 0) {
      console.log(`✅ Se procesaron ${result.processed} camadas para destete:`);
      result.births.forEach(birth => {
        console.log(`   - Camada ID ${birth.birthId}: Cerda ${birth.sowEarTag}, ${birth.pigletsWeaned} lechones destetados`);
      });
    } else {
      console.log('✅ No hay camadas pendientes de destete.');
    }
  } catch (error) {
    console.error('❌ Error en job de destete automático:', error);
  }
}, {
  scheduled: false, // No iniciar automáticamente
  timezone: "America/Bogota"
});

module.exports = {
  weaningStatusJob,
  processWeaningDates,
  processSpecificBirth
};
