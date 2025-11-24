const sowModel = require('../models/sowModel');
const boarModel = require('../models/boarModel');
const pigletModel = require('../models/pigletModel');
const heatModel = require('../models/heatModel');
const serviceModel = require('../models/serviceModel');
const pregnancyModel = require('../models/pregnancyModel');
const birthModel = require('../models/birthModel');
const abortionModel = require('../models/abortionModel');

const reportController = {
  /**
   * Obtener estadísticas completas de reproductores (cerdas, verracos, lechones)
   */
  getReproductorsStats: async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      // Obtener datos de cerdas
      const allSows = await sowModel.getAll();
      const activeSows = allSows.filter(s => s.status === 'activa');
      
      const sowsStats = {
        total: allSows.length,
        active: activeSows.length,
        pregnant: allSows.filter(s => s.reproductive_status === 'gestante').length,
        lactating: allSows.filter(s => s.reproductive_status === 'lactante').length,
        empty: allSows.filter(s => s.reproductive_status === 'vacia').length,
        inHeat: allSows.filter(s => s.reproductive_status === 'en celo').length,
        discarded: allSows.filter(s => s.status === 'descartada').length,
      };

      // Detalles adicionales de cerdas
      if (activeSows.length > 0) {
        const totalAge = activeSows.reduce((sum, s) => {
          if (s.birth_date) {
            const ageMonths = (new Date() - new Date(s.birth_date)) / (1000 * 60 * 60 * 24 * 30);
            return sum + ageMonths;
          }
          return sum;
        }, 0);

        const totalParities = activeSows.reduce((sum, s) => sum + (s.parity_count || 0), 0);

        sowsStats.avgAge = activeSows.length > 0 ? totalAge / activeSows.length : 0;
        sowsStats.avgParities = activeSows.length > 0 ? totalParities / activeSows.length : 0;
        sowsStats.firstParity = activeSows.filter(s => (s.parity_count || 0) === 0 || (s.parity_count || 0) === 1).length;
        sowsStats.multiparous = activeSows.filter(s => (s.parity_count || 0) > 1).length;
        
        // Calcular promedio real de partos por cerda desde la tabla births
        const allBirths = await birthModel.getAll();
        const birthsPerSow = {};
        allBirths.forEach(birth => {
          if (!birthsPerSow[birth.sow_id]) {
            birthsPerSow[birth.sow_id] = 0;
          }
          birthsPerSow[birth.sow_id]++;
        });
        
        const sowsWithBirths = Object.keys(birthsPerSow).length;
        const totalBirths = Object.values(birthsPerSow).reduce((sum, count) => sum + count, 0);
        sowsStats.avgBirthsPerSow = sowsWithBirths > 0 ? totalBirths / sowsWithBirths : 0;
        
        // Calcular promedio de lechones por cerda
        const pigletsPerSow = {};
        const allPiglets = await pigletModel.getAll();
        allPiglets.forEach(piglet => {
          if (!pigletsPerSow[piglet.sow_id]) {
            pigletsPerSow[piglet.sow_id] = 0;
          }
          pigletsPerSow[piglet.sow_id]++;
        });
        
        const totalPiglets = Object.values(pigletsPerSow).reduce((sum, count) => sum + count, 0);
        sowsStats.avgPigletsPerSow = activeSows.length > 0 ? totalPiglets / activeSows.length : 0;
        
        // Calcular sumatorias de indicadores productivos (desde los campos actualizados por triggers)
        sowsStats.totalParities = activeSows.reduce((sum, s) => sum + (s.parity_count || 0), 0);
        sowsStats.totalPigletsBorn = activeSows.reduce((sum, s) => sum + (s.total_piglets_born || 0), 0);
        sowsStats.totalPigletsAlive = activeSows.reduce((sum, s) => sum + (s.total_piglets_alive || 0), 0);
        sowsStats.totalPigletsDead = activeSows.reduce((sum, s) => sum + (s.total_piglets_dead || 0), 0);
        sowsStats.totalAbortions = activeSows.reduce((sum, s) => sum + (s.total_abortions || 0), 0);
      }

      // Obtener datos de verracos
      const allBoars = await boarModel.getAll();
      const activeBoars = allBoars.filter(b => b.status === 'activo');
      
      // Obtener servicios para calcular servicios por verraco
      const allServices = await serviceModel.getAll();
      const totalServices = allServices.length;
      
      const boarsStats = {
        total: allBoars.length,
        active: activeBoars.length,
        totalServices: totalServices,
        avgServicesPerBoar: activeBoars.length > 0 ? totalServices / activeBoars.length : 0,
      };

      // Obtener datos de lechones
      const allPiglets = await pigletModel.getAll();
      const activePiglets = allPiglets.filter(p => p.current_status !== 'muerto' && p.current_status !== 'vendido');
      
      const pigletsStats = {
        total: activePiglets.length,
        males: activePiglets.filter(p => p.sex === 'macho').length,
        females: activePiglets.filter(p => p.sex === 'hembra').length,
        weaned: activePiglets.filter(p => p.current_status === 'destetado').length,
        lactating: activePiglets.filter(p => p.current_status === 'lactante').length,
        sold: allPiglets.filter(p => p.current_status === 'vendido').length,
        dead: allPiglets.filter(p => p.current_status === 'muerto').length,
        mummified: allPiglets.filter(p => p.birth_status === 'momificado').length,
        bornDead: allPiglets.filter(p => p.birth_status === 'muerto').length,
      };

      // Calcular peso promedio al nacer desde birth_weight de cada lechón
      const pigletsWithBirthWeight = allPiglets.filter(p => 
        p.birth_weight !== null && 
        p.birth_weight !== undefined && 
        parseFloat(p.birth_weight) > 0
      );
      
      if (pigletsWithBirthWeight.length > 0) {
        const totalBirthWeight = pigletsWithBirthWeight.reduce((sum, p) => sum + parseFloat(p.birth_weight), 0);
        pigletsStats.avgBirthWeight = totalBirthWeight / pigletsWithBirthWeight.length;
      } else {
        pigletsStats.avgBirthWeight = null;
      }

      // Calcular peso actual promedio de todos los lechones (vivos)
      const pigletsWithCurrentWeight = activePiglets.filter(p => 
        p.current_weight !== null && 
        p.current_weight !== undefined && 
        parseFloat(p.current_weight) > 0
      );
      
      if (pigletsWithCurrentWeight.length > 0) {
        const totalCurrentWeight = pigletsWithCurrentWeight.reduce((sum, p) => sum + parseFloat(p.current_weight), 0);
        pigletsStats.avgCurrentWeight = totalCurrentWeight / pigletsWithCurrentWeight.length;
      } else {
        pigletsStats.avgCurrentWeight = null;
      }

      res.json({
        success: true,
        data: {
          sows: sowsStats,
          boars: boarsStats,
          piglets: pigletsStats,
        }
      });
    } catch (error) {
      console.error('Error en getReproductorsStats:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener estadísticas de reproductores',
        error: error.message
      });
    }
  },

  /**
   * Obtener estadísticas de datos reproductivos (celos, servicios, gestaciones, partos, abortos)
   */
  getReproductiveStats: async (req, res) => {
    try {
      const { sowId, startDate, endDate } = req.query;

      // Obtener todos los datos o filtrados por cerda
      let heats, services, pregnancies, births, abortions;

      if (sowId) {
        heats = await heatModel.getBySowId(sowId);
        services = await serviceModel.getBySowId(sowId);
        pregnancies = await pregnancyModel.getBySowId(sowId);
        births = await birthModel.getBySowId(sowId);
        abortions = await abortionModel.getBySowId(sowId);
      } else {
        heats = await heatModel.getAll();
        services = await serviceModel.getAll();
        pregnancies = await pregnancyModel.getAll();
        births = await birthModel.getAll();
        abortions = await abortionModel.getAll();
      }

      // Filtrar por fechas si se proporcionan
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);

        heats = heats.filter(h => {
          const date = new Date(h.heat_date);
          return date >= start && date <= end;
        });

        services = services.filter(s => {
          const date = new Date(s.service_date);
          return date >= start && date <= end;
        });

        pregnancies = pregnancies.filter(p => {
          const date = new Date(p.conception_date || p.created_at);
          return date >= start && date <= end;
        });

        births = births.filter(b => {
          const date = new Date(b.birth_date);
          return date >= start && date <= end;
        });

        abortions = abortions.filter(a => {
          const date = new Date(a.abortion_date);
          return date >= start && date <= end;
        });
      }

      // Calcular estadísticas de celos
      const heatsStats = {
        total: heats.length,
        pending: heats.filter(h => h.status === 'detectado' || h.status === 'no servido').length,
        serviced: heats.filter(h => h.status === 'servido').length,
        serviceRate: heats.length > 0 ? (heats.filter(h => h.status === 'servido').length / heats.length) * 100 : 0,
      };

      // Calcular intervalo promedio entre celos
      if (heats.length > 1) {
        const sortedHeats = [...heats].sort((a, b) => new Date(a.heat_date) - new Date(b.heat_date));
        let totalInterval = 0;
        let intervals = 0;

        for (let i = 1; i < sortedHeats.length; i++) {
          const prevDate = new Date(sortedHeats[i - 1].heat_date);
          const currentDate = new Date(sortedHeats[i].heat_date);
          const daysDiff = (currentDate - prevDate) / (1000 * 60 * 60 * 24);
          
          if (daysDiff < 60) { // Solo considerar intervalos razonables
            totalInterval += daysDiff;
            intervals++;
          }
        }

        heatsStats.avgInterval = intervals > 0 ? totalInterval / intervals : null;
      }

      // Calcular estadísticas de servicios
      const servicesStats = {
        total: services.length,
        natural: services.filter(s => s.service_type === 'monta natural').length,
        artificial: services.filter(s => s.service_type === 'inseminacion artificial').length,
      };

      // Relacionar servicios con gestaciones confirmadas para calcular tasa de éxito
      const successfulServices = services.filter(s => {
        return pregnancies.some(p => p.service_id === s.id && p.confirmed === true);
      });

      servicesStats.successful = successfulServices.length;
      servicesStats.successRate = services.length > 0 ? (successfulServices.length / services.length) * 100 : 0;

      // Calcular estadísticas de gestaciones
      const pregnanciesStats = {
        total: pregnancies.length,
        confirmed: pregnancies.filter(p => p.confirmed === true).length,
        active: pregnancies.filter(p => p.status === 'en curso').length,
        completed: pregnancies.filter(p => p.status === 'finalizada parto' || p.status === 'finalizada aborto').length,
        failed: pregnancies.filter(p => p.status === 'no confirmada' && p.confirmed === false).length,
      };

      // Calcular duración promedio de gestaciones completadas (basado en partos)
      if (pregnanciesStats.completed > 0 && births.length > 0) {
        const completedWithBirth = pregnancies.filter(p => {
          const hasBirth = births.some(b => b.pregnancy_id === p.id);
          return hasBirth && p.conception_date;
        });

        if (completedWithBirth.length > 0) {
          const totalDuration = completedWithBirth.reduce((sum, p) => {
            const birth = births.find(b => b.pregnancy_id === p.id);
            if (birth && birth.birth_date) {
              const start = new Date(p.conception_date);
              const end = new Date(birth.birth_date);
              return sum + (end - start) / (1000 * 60 * 60 * 24);
            }
            return sum;
          }, 0);

          pregnanciesStats.avgDuration = totalDuration / completedWithBirth.length;
        }
      }

      // Calcular estadísticas de partos
      const birthsStats = {
        total: births.length,
        natural: births.filter(b => b.birth_type === 'normal').length,
        assisted: births.filter(b => b.birth_type === 'asistido').length,
        complicated: births.filter(b => b.birth_type === 'distocico' || b.birth_type === 'cesarea').length,
        totalBorn: births.reduce((sum, b) => sum + (b.total_born || 0), 0),
      };

      if (births.length > 0) {
        const totalBornAlive = births.reduce((sum, b) => sum + (b.born_alive || 0), 0);
        const totalBornDead = births.reduce((sum, b) => sum + (b.born_dead || 0), 0);
        const totalMummified = births.reduce((sum, b) => sum + (b.mummified || 0), 0);

        birthsStats.totalBornAlive = totalBornAlive;
        birthsStats.totalBornDead = totalBornDead;
        birthsStats.totalMummified = totalMummified;
        birthsStats.avgBornAlive = totalBornAlive / births.length;
        birthsStats.avgBornDead = totalBornDead / births.length;
        birthsStats.avgTotalBorn = birthsStats.totalBorn / births.length;
        birthsStats.mortalityRate = birthsStats.totalBorn > 0 ? (totalBornDead / birthsStats.totalBorn) * 100 : 0;
      }

      // Calcular estadísticas de abortos
      const abortionsStats = {
        total: abortions.length,
        rate: pregnancies.length > 0 ? (abortions.length / pregnancies.length) * 100 : 0,
        early: abortions.filter(a => {
          // Usar gestation_days que viene directamente del registro de aborto
          return a.gestation_days && a.gestation_days < 60;
        }).length,
        late: abortions.filter(a => {
          // Usar gestation_days que viene directamente del registro de aborto
          return a.gestation_days && a.gestation_days >= 60;
        }).length,
      };

      res.json({
        success: true,
        data: {
          heats: heatsStats,
          services: servicesStats,
          pregnancies: pregnanciesStats,
          births: birthsStats,
          abortions: abortionsStats,
        }
      });
    } catch (error) {
      console.error('Error en getReproductiveStats:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener estadísticas reproductivas',
        error: error.message
      });
    }
  },

  /**
   * Obtener KPIs productivos
   */
  getProductivityKPIs: async (req, res) => {
    try {
      const { sowId, startDate, endDate } = req.query;

      // Obtener datos necesarios
      let services, pregnancies, births, abortions, piglets;

      if (sowId) {
        services = await serviceModel.getBySowId(sowId);
        pregnancies = await pregnancyModel.getBySowId(sowId);
        births = await birthModel.getBySowId(sowId);
        abortions = await abortionModel.getBySowId(sowId);
        piglets = await pigletModel.getBySowId(sowId);
      } else {
        services = await serviceModel.getAll();
        pregnancies = await pregnancyModel.getAll();
        births = await birthModel.getAll();
        abortions = await abortionModel.getAll();
        piglets = await pigletModel.getAll();
      }

      // Filtrar por fechas si se proporcionan
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);

        services = services.filter(s => new Date(s.service_date) >= start && new Date(s.service_date) <= end);
        pregnancies = pregnancies.filter(p => new Date(p.conception_date || p.created_at) >= start && new Date(p.conception_date || p.created_at) <= end);
        births = births.filter(b => new Date(b.birth_date) >= start && new Date(b.birth_date) <= end);
        abortions = abortions.filter(a => new Date(a.abortion_date) >= start && new Date(a.abortion_date) <= end);
      }

      const kpis = {};

      // Tasa de Fertilidad (servicios que resultaron en gestación confirmada)
      const confirmedPregnancies = pregnancies.filter(p => p.confirmed === true);
      kpis.fertilityRate = services.length > 0 ? (confirmedPregnancies.length / services.length) * 100 : 0;

      // Tasa de Concepción (servicios que resultaron en gestación vs total de servicios)
      kpis.conceptionRate = services.length > 0 ? (pregnancies.length / services.length) * 100 : 0;

      // Tasa de Partos (gestaciones que terminaron en parto vs total de gestaciones)
      kpis.farrowingRate = pregnancies.length > 0 ? (births.length / pregnancies.length) * 100 : 0;

      // Lechones Nacidos Vivos por Parto
      if (births.length > 0) {
        const totalBornAlive = births.reduce((sum, b) => sum + (b.born_alive || 0), 0);
        kpis.avgBornAlive = totalBornAlive / births.length;

        const totalBorn = births.reduce((sum, b) => sum + (b.total_born || 0), 0);
        kpis.avgTotalBorn = totalBorn / births.length;

        // Mortalidad al nacer
        const totalBornDead = births.reduce((sum, b) => sum + (b.born_dead || 0), 0);
        kpis.birthMortality = totalBorn > 0 ? (totalBornDead / totalBorn) * 100 : 0;
      } else {
        kpis.avgBornAlive = 0;
        kpis.avgTotalBorn = 0;
        kpis.birthMortality = 0;
      }

      // Lechones Destetados por Parto
      // Contar lechones destetados que pertenecen a los partos en el rango de fechas
      const birthIds = births.map(b => b.id);
      const weanedPiglets = piglets.filter(p => 
        birthIds.includes(p.birth_id) && 
        (p.current_status === 'destetado' || p.weaning_date)
      );
      kpis.avgWeaned = births.length > 0 ? weanedPiglets.length / births.length : 0;

      // Mortalidad Pre-Destete
      const totalBornAlive = births.reduce((sum, b) => sum + (b.born_alive || 0), 0);
      // Contar lechones que murieron antes del destete (nunca fueron destetados o murieron antes de la fecha de destete)
      // Solo considerar lechones de los partos en el rango de fechas
      const deadBeforeWeaning = piglets.filter(p => {
        // Solo considerar lechones de los partos en análisis
        if (!birthIds.includes(p.birth_id)) return false;
        
        // Solo considerar lechones que nacieron vivos
        if (p.birth_status !== 'vivo') return false;
        
        // Si el lechón está muerto
        if (p.current_status === 'muerto') {
          // Si nunca fue destetado (weaning_date es null), entonces murió pre-destete
          if (!p.weaning_date) return true;
          
          // Si tiene fecha de muerte y fecha de destete, verificar que murió antes del destete
          if (p.death_date && new Date(p.death_date) < new Date(p.weaning_date)) return true;
        }
        
        return false;
      }).length;
      kpis.preWeaningMortality = totalBornAlive > 0 ? (deadBeforeWeaning / totalBornAlive) * 100 : 0;

      // Tasa de Abortos
      kpis.abortionRate = pregnancies.length > 0 ? (abortions.length / pregnancies.length) * 100 : 0;

      // Indicadores Temporales
      // Intervalo entre Partos
      if (births.length > 1 && !sowId) {
        // Para todas las cerdas, calcular promedio general
        const sowBirths = {};
        births.forEach(birth => {
          if (!sowBirths[birth.sow_id]) sowBirths[birth.sow_id] = [];
          sowBirths[birth.sow_id].push(birth);
        });

        let totalIntervals = 0;
        let intervalCount = 0;

        Object.values(sowBirths).forEach(sowBirthList => {
          if (sowBirthList.length > 1) {
            const sorted = sowBirthList.sort((a, b) => new Date(a.birth_date) - new Date(b.birth_date));
            for (let i = 1; i < sorted.length; i++) {
              const days = (new Date(sorted[i].birth_date) - new Date(sorted[i-1].birth_date)) / (1000 * 60 * 60 * 24);
              totalIntervals += days;
              intervalCount++;
            }
          }
        });

        if (intervalCount > 0) {
          kpis.farrowingInterval = totalIntervals / intervalCount;
        }
      } else if (births.length > 1 && sowId) {
        // Para una cerda específica
        const sortedBirths = [...births].sort((a, b) => new Date(a.birth_date) - new Date(b.birth_date));
        let totalInterval = 0;
        
        for (let i = 1; i < sortedBirths.length; i++) {
          const prevDate = new Date(sortedBirths[i - 1].birth_date);
          const currentDate = new Date(sortedBirths[i].birth_date);
          totalInterval += (currentDate - prevDate) / (1000 * 60 * 60 * 24);
        }

        kpis.farrowingInterval = totalInterval / (sortedBirths.length - 1);
      }

      // Calcular Intervalo Destete-Servicio
      // Obtener celos para calcular intervalo destete-celo
      let heats;
      if (sowId) {
        heats = await heatModel.getBySowId(sowId);
      } else {
        heats = await heatModel.getAll();
      }

      // Filtrar heats por fechas si aplica
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        heats = heats.filter(h => new Date(h.heat_date) >= start && new Date(h.heat_date) <= end);
      }

      // Calcular intervalo destete-servicio
      if (services.length > 0 && births.length > 0) {
        let weanToServiceIntervals = [];
        
        services.forEach(service => {
          // Buscar el último parto antes del servicio de la misma cerda
          const previousBirths = births.filter(b => 
            b.sow_id === service.sow_id && 
            new Date(b.birth_date) < new Date(service.service_date)
          );
          
          if (previousBirths.length > 0) {
            // Ordenar por fecha y tomar el más reciente
            const lastBirth = previousBirths.sort((a, b) => 
              new Date(b.birth_date) - new Date(a.birth_date)
            )[0];
            
            // Usar expected_weaning_date si existe, sino asumir 21 días después del parto
            let weaningDate;
            if (lastBirth.expected_weaning_date) {
              weaningDate = new Date(lastBirth.expected_weaning_date);
            } else {
              weaningDate = new Date(lastBirth.birth_date);
              weaningDate.setDate(weaningDate.getDate() + 21); // Destete estándar a 21 días
            }
            
            const serviceDate = new Date(service.service_date);
            const daysInterval = (serviceDate - weaningDate) / (1000 * 60 * 60 * 24);
            
            if (daysInterval >= 0 && daysInterval < 90) { // Validar rangos razonables (aumentado a 90 días)
              weanToServiceIntervals.push(daysInterval);
            }
          }
        });

        if (weanToServiceIntervals.length > 0) {
          kpis.weanToServiceInterval = weanToServiceIntervals.reduce((a, b) => a + b, 0) / weanToServiceIntervals.length;
        }
      }

      // Calcular intervalo destete-celo
      if (heats.length > 0 && births.length > 0) {
        let weanToHeatIntervals = [];
        
        heats.forEach(heat => {
          const previousBirths = births.filter(b => 
            b.sow_id === heat.sow_id && 
            new Date(b.birth_date) < new Date(heat.heat_date)
          );
          
          if (previousBirths.length > 0) {
            const lastBirth = previousBirths.sort((a, b) => 
              new Date(b.birth_date) - new Date(a.birth_date)
            )[0];
            
            // Usar expected_weaning_date si existe, sino asumir 21 días después del parto
            let weaningDate;
            if (lastBirth.expected_weaning_date) {
              weaningDate = new Date(lastBirth.expected_weaning_date);
            } else {
              weaningDate = new Date(lastBirth.birth_date);
              weaningDate.setDate(weaningDate.getDate() + 21);
            }
            
            const heatDate = new Date(heat.heat_date);
            const daysInterval = (heatDate - weaningDate) / (1000 * 60 * 60 * 24);
            
            if (daysInterval >= 0 && daysInterval < 60) { // Validar rangos razonables
              weanToHeatIntervals.push(daysInterval);
            }
          }
        });

        if (weanToHeatIntervals.length > 0) {
          kpis.weanToHeatInterval = weanToHeatIntervals.reduce((a, b) => a + b, 0) / weanToHeatIntervals.length;
        }
      }

      // Días No Productivos (días entre destete y siguiente servicio efectivo)
      if (kpis.weanToServiceInterval) {
        kpis.nonProductiveDays = kpis.weanToServiceInterval;
      } else {
        kpis.nonProductiveDays = 0;
      }

      // Inicializar indicadores temporales en 0 si no se calcularon
      if (!kpis.weanToServiceInterval) kpis.weanToServiceInterval = 0;
      if (!kpis.weanToHeatInterval) kpis.weanToHeatInterval = 0;
      if (!kpis.farrowingInterval) kpis.farrowingInterval = 0;

      // Productividad Anual
      // Calcular para un año completo si hay suficientes datos
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const birthsLastYear = births.filter(b => new Date(b.birth_date) >= oneYearAgo);
      
      if (sowId) {
        kpis.farrowingsPerSowPerYear = birthsLastYear.length;
        kpis.pigletsPerSowPerYear = birthsLastYear.reduce((sum, b) => sum + (b.born_alive || 0), 0);
        kpis.weanedPerSowPerYear = piglets.filter(p => 
          (p.current_status === 'destetado' || p.weaning_date) &&
          p.weaning_date && new Date(p.weaning_date) >= oneYearAgo
        ).length;
      } else {
        const activeSows = await sowModel.getAll();
        const activeSowsCount = activeSows.filter(s => s.status === 'activa').length;
        
        if (activeSowsCount > 0) {
          kpis.farrowingsPerSowPerYear = birthsLastYear.length / activeSowsCount;
          const totalPigletsLastYear = birthsLastYear.reduce((sum, b) => sum + (b.born_alive || 0), 0);
          kpis.pigletsPerSowPerYear = totalPigletsLastYear / activeSowsCount;
          
          const weanedLastYear = piglets.filter(p => 
            (p.current_status === 'destetado' || p.weaning_date) &&
            p.weaning_date && new Date(p.weaning_date) >= oneYearAgo
          ).length;
          kpis.weanedPerSowPerYear = weanedLastYear / activeSowsCount;
        } else {
          // Si no hay cerdas activas, inicializar en 0
          kpis.farrowingsPerSowPerYear = 0;
          kpis.pigletsPerSowPerYear = 0;
          kpis.weanedPerSowPerYear = 0;
        }
      }

      // Asegurar que todos los KPIs tengan valores numéricos (no undefined)
      if (!kpis.farrowingsPerSowPerYear) kpis.farrowingsPerSowPerYear = 0;
      if (!kpis.pigletsPerSowPerYear) kpis.pigletsPerSowPerYear = 0;
      if (!kpis.weanedPerSowPerYear) kpis.weanedPerSowPerYear = 0;

      res.json({
        success: true,
        data: kpis
      });
    } catch (error) {
      console.error('Error en getProductivityKPIs:', error);
      res.status(500).json({
        success: false,
        message: 'Error al calcular KPIs productivos',
        error: error.message
      });
    }
  },
};

module.exports = reportController;
