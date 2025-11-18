
// --- CONSTANTES DE NEGOCIO ---
const EXTRA_HOUR_MULTIPLIER = 1.5;
const HOLIDAY_WORKED_EQUIV_HOURS = 32;
const HOLIDAY_FREE_EQUIV_HOURS = 8;

/**
 * Helper: Calcula las horas equivalentes base según el día de la semana y el turno.
 * @param {number} dayOfWeek - 0 (Domingo) a 6 (Sábado)
 * @param {string} turnType - 'Mañana', 'Tarde', o 'Noche'
 * @returns {{realHours: number, equivalentHours: number, turnBaseName: string}}
 */
function getTurnEquivalencies(dayOfWeek, turnType) {
    let realHours = 8;
    let equivalentHours = 8; 
    let turnBaseName = turnType;
    
    if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Lunes a Viernes
        switch (turnType) {
            case 'Mañana':
            case 'Tarde': equivalentHours = 8; break;
            case 'Noche': equivalentHours = 12; break; // Recargo Nocturno
        }
    } else if (dayOfWeek === 6) { // Sábado
        switch (turnType) {
            case 'Mañana': realHours = 8; equivalentHours = 9; break;
            case 'Tarde': realHours = 9; equivalentHours = 12; break;
            case 'Noche': realHours = 8; equivalentHours = 16; break;
        }
    } else if (dayOfWeek === 0) { // Domingo
        turnBaseName = 'Domingo ' + turnType;
        switch (turnType) {
            case 'Mañana':
            case 'Tarde': realHours = 8; equivalentHours = 24; break; // Recargo Dominical (Triple)
            case 'Noche': realHours = 8; equivalentHours = 28; break; // Recargo Dominical + Nocturno
        }
    }
    return { realHours, equivalentHours, turnBaseName };
}

/**
 * Función central de cálculo: Genera el horario 6x2 y calcula salarios.
 * @param {object} config - La configuración del mes y salario.
 * @param {object} extraHours - Horas extra manuales.
 * @param {object} manualHolidays - Días marcados como feriados.
 * @returns {object|null} El resultado del cálculo o null si faltan datos.
 */
export function calculateSchedule(config, extraHours, manualHolidays) {
    const { month, year, lastFrancoDate, initialTurn, valorHora, discountRate } = config;
    
    if (!lastFrancoDate || !valorHora || isNaN(valorHora) || valorHora <= 0) {
         return null;
    }

    let currentDate = new Date(year, month - 1, 1, 0, 0, 0);
    
    const lastFrancoDay2 = new Date(lastFrancoDate + 'T00:00:00');
    const dayAfterFranco = new Date(lastFrancoDay2.getTime());
    dayAfterFranco.setDate(dayAfterFranco.getDate() + 1); 

    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    let dailyResults = [];
    let francosDates = [];
    
    // Ciclo 6x2 (24 días de rotación)
    const masterCycle = [
        'Mañana', 'Mañana', 'Mañana', 'Mañana', 'Mañana', 'Mañana', 'Franco', 'Franco', 
        'Noche', 'Noche', 'Noche', 'Noche', 'Noche', 'Noche', 'Franco', 'Franco', 
        'Tarde', 'Tarde', 'Tarde', 'Tarde', 'Tarde', 'Tarde', 'Franco', 'Franco'
    ];
    
    let baseOffset = 0;
    if (initialTurn === 'Noche') baseOffset = 8;
    else if (initialTurn === 'Tarde') baseOffset = 16;
    
    // Calcular el desplazamiento inicial basado en la diferencia de días
    const diffTime = currentDate.getTime() - dayAfterFranco.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    let startOffset = (baseOffset + diffDays) % 24; 
    if (startOffset < 0) startOffset += 24;

    let dayCounter = 0;
    const daysInMonth = new Date(year, month, 0).getDate();

    while (dayCounter < daysInMonth) {
        const dateKeyForDisplay = currentDate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const dateKeyForInput = currentDate.toISOString().split('T')[0];
        const dayOfWeek = currentDate.getDay(); 
        
        const isHolidayManual = manualHolidays[dateKeyForDisplay] === true; 
        const cycleStatus = masterCycle[startOffset]; 
        
        let turnBaseName = cycleStatus;
        let realHours = 0;
        let equivalentHours = 0;
        
        if (cycleStatus === 'Franco') {
            if (isHolidayManual) {
                turnBaseName = `FERIADO - Franco`;
                equivalentHours = HOLIDAY_FREE_EQUIV_HOURS; 
                francosDates.push(dateKeyForDisplay + ' (Feriado)');
            } else {
                 turnBaseName = `Franco`;
                 francosDates.push(dateKeyForDisplay);
            }
        } 
        else {
            if (isHolidayManual) {
                turnBaseName = `FERIADO - ${cycleStatus}`;
                realHours = 8; 
                equivalentHours = HOLIDAY_WORKED_EQUIV_HOURS; 
            } else {
                const equivalences = getTurnEquivalencies(dayOfWeek, cycleStatus);
                realHours = equivalences.realHours;
                equivalentHours = equivalences.equivalentHours;
                turnBaseName = equivalences.turnBaseName;
            }
        }
        
        dailyResults.push({
            date: dateKeyForDisplay,
            dateKey: dateKeyForInput,
            day: dayNames[dayOfWeek],
            turn: turnBaseName,
            isHoliday: isHolidayManual,
            realHours: realHours,
            equivHoursBase: equivalentHours, 
        });
        
        startOffset = (startOffset + 1) % 24;
        currentDate.setDate(currentDate.getDate() + 1);
        dayCounter++;
    }
    
    let totalEquivalentHours = 0;
    let totalExtraHoursReal = 0;
    const hourlyRate = parseFloat(valorHora) || 0;

    const finalDailyResults = dailyResults.map(day => {
        const dayExtraReal = extraHours[day.date] || 0; 
        let dayExtraEquivalent = dayExtraReal * EXTRA_HOUR_MULTIPLIER;
        
        totalExtraHoursReal += dayExtraReal;
        
        const finalEquivHours = day.equivHoursBase + dayExtraEquivalent;
        const finalDailyBruto = finalEquivHours * hourlyRate;

        totalEquivalentHours += finalEquivHours;

        return {
            ...day,
            extraReal: dayExtraReal, 
            extraEquiv: dayExtraEquivalent, 
            equivHoursFinal: finalEquivHours, 
            dailyBruto: finalDailyBruto, 
        };
    });

    const totalBruto = totalEquivalentHours * hourlyRate;
    const totalDescuento = totalBruto * discountRate;
    const totalNeto = totalBruto - totalDescuento;

    return {
        dailyResults: finalDailyResults,
        francosDates,
        totalEquivalentHours,
        totalExtraHoursReal,
        totalBruto,
        totalDescuento,
        totalNeto,
        discountRate: discountRate * 100,
    };
}
