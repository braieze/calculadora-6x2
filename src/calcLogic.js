// Constantes de cálculo
const HOURS_PER_TURN = 12.0;
const EQUIVALENT_HOURS = 1.66; // Multiplicador para horas base y feriados
const EXTRA_HOUR_MULTIPLIER = 1.5; // Multiplicador para horas extra
const TECNHICIAN_BONUS = 0.20; // 20% de la Hora Equivalente para el título

/**
 * Genera el calendario de turnos 2x2.
 * @param {number} year - Año del cálculo.
 * @param {number} month - Mes del cálculo (1-12).
 * @param {string} lastFrancoDate - Fecha del último franco del mes anterior (YYYY-MM-DD).
 * @param {string} initialTurn - Turno de inicio si no hay fecha de franco ('Mañana' o 'Tarde').
 * @param {Array<Object> | null} previousSchedule - Horario del mes anterior si está disponible.
 * @returns {Array<Object>} El array con el calendario diario.
 */
function generateSchedule(year, month, lastFrancoDate, initialTurn, previousSchedule) {
    const schedule = [];
    const daysInMonth = new Date(year, month, 0).getDate();
    let currentDate = new Date(year, month - 1, 1);
    let currentDayIndex = 0; // Índice para el ciclo 2x2

    // Determinar el índice inicial basado en la fecha del último franco o el turno inicial
    if (previousSchedule && previousSchedule.length > 0) {
        // Encontrar el último turno del mes anterior
        const lastDay = previousSchedule[previousSchedule.length - 1];
        if (lastDay) {
             // El ciclo es (M, M, T, T, F1, F2). El índice 0 es M.
             const cycle = ['Mañana', 'Mañana', 'Tarde', 'Tarde', 'Franco (Día 1)', 'Franco (Día 2)'];
             const lastIndex = cycle.indexOf(lastDay.turn);
             // El índice de inicio para el mes actual es el siguiente en el ciclo (circular)
             currentDayIndex = (lastIndex + 1) % cycle.length; 
        }
    } else if (lastFrancoDate) {
        // 1. Calcular el ciclo basado en la fecha del último franco (si se proporcionó)
        // Esto requiere una lógica compleja de rotación de fechas, la simplificaremos
        // asumiendo que el día siguiente al franco es un turno Mañana (índice 0).
        // Si el usuario da el último FRANCO, el día 1 del mes es el turno (Franco + 1) % 6
        
        // Convertir la fecha del último franco a objeto Date
        const lastFranco = new Date(lastFrancoDate);
        if (!isNaN(lastFranco)) {
            // El ciclo es de 6 días. El día siguiente al franco es Día de Mañana (índice 0)
            const dayAfterFranco = new Date(lastFranco);
            dayAfterFranco.setDate(lastFranco.getDate() + 1);
            
            // Contar cuántos días han pasado hasta el día 1 del mes actual
            let dayCount = 0;
            let tempDate = new Date(dayAfterFranco);
            const firstDayOfMonth = new Date(year, month - 1, 1);
            
            // Solo si la fecha del franco es en el mes anterior o el mismo día que el inicio
            if (dayAfterFranco <= firstDayOfMonth) {
                while (tempDate < firstDayOfMonth) {
                    tempDate.setDate(tempDate.getDate() + 1);
                    dayCount++;
                }
                currentDayIndex = dayCount % 6;
            }
        }
    } else {
        // 2. Si no hay franco ni mes anterior, usar el turno inicial (Mañana = 0, Tarde = 2)
        currentDayIndex = initialTurn === 'Mañana' ? 0 : 2;
    }

    const cycle = ['Mañana', 'Mañana', 'Tarde', 'Tarde', 'Franco (Día 1)', 'Franco (Día 2)'];

    for (let i = 0; i < daysInMonth; i++) {
        const turn = cycle[currentDayIndex];
        
        schedule.push({
            date: new Date(currentDate), // Clonar la fecha para evitar referencias
            turn: turn,
            baseHours: turn.includes('Franco') ? 0.0 : HOURS_PER_TURN,
            extraHours: 0.0, // Inicialmente 0, se carga de previousData si existe
            isHoliday: false, // Inicialmente false, se carga de previousData si existe
            totalHoursEq: 0.0,
            bruto: 0.0
        });

        currentDate.setDate(currentDate.getDate() + 1);
        currentDayIndex = (currentDayIndex + 1) % cycle.length;
    }

    return schedule;
}

/**
 * Calcula las fechas de cobro (4to día hábil después del 15 y 31).
 * @param {number} year - Año.
 * @param {number} month - Mes (1-12).
 * @returns {Array<{quincenaEndDay: number, date: Date}>} Array con las fechas de pago.
 */
function calculatePaymentDates(year, month) {
    const paymentDates = [];
    const date15 = new Date(year, month - 1, 15); // Quincena 1
    const dateEndOfMonth = new Date(year, month, 0); // Quincena 2
    
    // Fechas de finalización de quincena para el cálculo del pago
    const quincenaEnds = [
        { quincenaEndDay: 15, date: date15 },
        { quincenaEndDay: dateEndOfMonth.getDate(), date: dateEndOfMonth }
    ];

    /**
     * Encuentra el N-ésimo día hábil después de una fecha.
     * @param {Date} startDate - Fecha a partir de la cual empezar a contar.
     * @param {number} offset - Número de días hábiles a contar (ej: 4to día).
     */
    const findNthWorkingDay = (startDate, offset) => {
        let currentDate = new Date(startDate);
        let workingDaysFound = 0;
        let daysPassed = 0;
        
        // Empezar a buscar DESPUÉS de la fecha de corte (startDate + 1)
        currentDate.setDate(currentDate.getDate() + 1);
        
        while (workingDaysFound < offset) {
            // El 0 es Domingo, el 6 es Sábado (Días no hábiles)
            const dayOfWeek = currentDate.getDay(); 
            if (dayOfWeek !== 0 && dayOfWeek !== 6) { 
                workingDaysFound++;
            }
            
            if (workingDaysFound < offset) {
                currentDate.setDate(currentDate.getDate() + 1);
            }
        }
        return currentDate;
    };

    quincenaEnds.forEach(q => {
        const paymentDate = findNthWorkingDay(q.date, 4); // 4to día hábil
        paymentDates.push({
            quincenaEndDay: q.quincenaEndDay,
            date: paymentDate
        });
    });

    return paymentDates;
}


/**
 * Función principal para generar el horario y calcular el salario.
 * @param {Object} config - Configuración de la aplicación.
 * @param {Object | null} previousData - Datos del cálculo anterior.
 * @param {Object | null} profile - Datos de perfil del usuario.
 * @returns {Object} El objeto de resultados de cálculo.
 */
export function calculateSchedule(config, previousData, profile) {
    const { year, month, valorHora, discountRate, lastFrancoDate, initialTurn } = config;
    
    // 1. Generar el horario base (o usar el anterior si existe)
    let schedule = [];
    
    const previousSchedule = previousData && previousData.schedule ? previousData.schedule : null;
    
    // Si no hay horario previo (o si cambiamos de mes/año), generamos el nuevo
    if (!previousSchedule || previousData.month !== month || previousData.year !== year) {
        // Generar horario 2x2 basado en el último franco o turno inicial
        schedule = generateSchedule(year, month, lastFrancoDate, initialTurn, previousSchedule);
    } else {
        // Si hay datos previos para este mes, usarlos (ya estarán convertidos a Date por firebase.js)
        schedule = previousData.schedule;
    }

    // 2. Recalcular valores para cada día (considerando feriados y horas extra modificadas por el usuario)
    let totalHorasEq = 0.0;
    let totalHorasExtra = 0.0;
    let totalBruto = 0.0;
    let totalFeriadoEq = 0.0;
    let technicianTitleBonus = 0.0;
    
    const isTechnician = profile?.isTechnician || false;
    const daysInMonth = new Date(year, month, 0).getDate();

    schedule.forEach(day => {
        // Sincronizar Horas Extra y Feriados con los datos guardados/modificados por el usuario
        const previousDay = previousSchedule ? previousSchedule.find(d => 
            d.date.getDate() === day.date.getDate()
        ) : null;
        
        // Si hay datos previos, cargamos las horas extra y el estado de feriado.
        if (previousDay) {
            day.extraHours = previousDay.extraHours || 0.0;
            day.isHoliday = previousDay.isHoliday || false;
        }

        // --- CALCULO POR DÍA ---
        
        let baseHoursEq = 0.0;
        let extraHoursEq = 0.0;
        let feriadoHoursEq = 0.0;

        // Las horas base se multiplican por el factor equivalente
        if (day.baseHours > 0) {
            baseHoursEq = day.baseHours * EQUIVALENT_HOURS;
        }

        // Las horas extra se multiplican por 1.5 y por el factor equivalente
        if (day.extraHours > 0) {
            extraHoursEq = day.extraHours * EXTRA_HOUR_MULTIPLIER * EQUIVALENT_HOURS;
            totalHorasExtra += day.extraHours;
        }

        // Si es feriado, todas las horas (base + extra) se pagan como feriado (200%), 
        // pero para simplificar el modelo (horas equivalentes), sumamos las horas base 
        // a las horas extra equivalentes y le añadimos un extra por ser feriado.
        // Método más sencillo: si es feriado, las horas se pagan al doble (200% o factor 2.0).
        if (day.isHoliday && day.baseHours > 0) {
            // Horas equivalentes de feriado = Base * Factor Feriado (2.0)
            feriadoHoursEq = day.baseHours * 2.0; 
            baseHoursEq = 0.0; // Ya están cubiertas por el pago de feriado
            totalFeriadoEq += feriadoHoursEq;
        }

        // Horas equivalentes totales del día
        day.totalHoursEq = baseHoursEq + extraHoursEq + feriadoHoursEq;
        
        // Monto bruto del día
        day.bruto = day.totalHoursEq * valorHora;
        
        // Acumular totales
        totalHorasEq += day.totalHoursEq;
        totalBruto += day.bruto;
    });
    
    // --- 3. CALCULO DE BONOS Y DESCUENTOS GLOBALES ---

    // 3.1. Bono de Título de Técnico (20% del valor de la hora equivalente)
    const horaEquivalente = valorHora * EQUIVALENT_HOURS;
    const valorBonoPorDia = horaEquivalente * TECNHICIAN_BONUS;

    // El bono se paga sobre las horas equivalentes de la SEGUNDA QUINCENA.
    if (isTechnician) {
        // Días de la segunda quincena (16 hasta fin de mes)
        const daysSecondQuincena = schedule.filter(day => day.date.getDate() > 15 && !day.turn.includes('Franco'));
        
        // Asumimos que la cantidad de días de trabajo en la 2da quincena es el número de horas base
        const totalBaseHoursSecondQuincena = daysSecondQuincena.reduce((sum, day) => sum + day.baseHours, 0);
        
        // Multiplicamos el valor del bono por las horas base trabajadas en la 2da quincena
        technicianTitleBonus = totalBaseHoursSecondQuincena * valorBonoPorDia; 
        
        // Sumar al bruto total
        totalBruto += technicianTitleBonus;
    }


    // 3.2. Descuento Estimado (Afiliación/Jubilación, etc.)
    const totalNeto = totalBruto * (1 - discountRate);

    // 4. Calcular Fechas de Cobro
    const paymentDates = calculatePaymentDates(year, month);


    // 5. Devolver resultados
    return {
        year,
        month,
        schedule,
        paymentDates, // NUEVO
        summary: {
            totalHorasEq: totalHorasEq,
            totalHorasExtra: totalHorasExtra,
            totalFeriadoEq: totalFeriadoEq,
            totalBruto: totalBruto,
            totalNeto: totalNeto,
            technicianTitleBonus: technicianTitleBonus // NUEVO
        }
    };
}
