import { appState } from './state.js';

const EXTRA_HOUR_MULTIPLIER = 1.5;
const HOLIDAY_WORKED_EQUIV_HOURS = 32;
const HOLIDAY_FREE_EQUIV_HOURS = 8;
const PAYMENT_LAG_DAYS = 4; // Días hábiles de retraso para el pago

// --- Funciones de Utilidad ---

// Calcula el día de pago hábil (4 días después del corte)
function calculatePayday(cutOffDate) {
    let payday = new Date(cutOffDate);
    payday.setDate(payday.getDate() + 1); // Empezamos a contar desde el día después del corte
    
    let daysToAdd = PAYMENT_LAG_DAYS;
    
    while (daysToAdd > 0) {
        payday.setDate(payday.getDate() + 1);
        const dayOfWeek = payday.getDay();
        
        // Días hábiles son Lunes (1) a Viernes (5)
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
            daysToAdd--;
        }
    }
    return payday.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getTurnEquivalencies(dayOfWeek, turnType) {
    let realHours = 8;
    let equivalentHours = 8;
    let turnBaseName = turnType;
    
    // ... (Mantener la lógica de equivalencias por día/turno exactamente igual)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) { 
        if (turnType === 'Noche') equivalentHours = 12;
    } else if (dayOfWeek === 6) { 
        if (turnType === 'Mañana') { realHours = 8; equivalentHours = 9; }
        if (turnType === 'Tarde') { realHours = 9; equivalentHours = 12; }
        if (turnType === 'Noche') { realHours = 8; equivalentHours = 16; }
    } else if (dayOfWeek === 0) { 
        turnBaseName = 'Domingo ' + turnType;
        if (turnType !== 'Noche') equivalentHours = 24;
        else equivalentHours = 28;
    }
    return { realHours, equivalentHours, turnBaseName };
}


// --- Función Principal de Cálculo ---

export function calculateSalaryData() {
    const { month, year, lastFrancoDate, initialTurn, valorHora, discountRate } = appState.config;
    if (!lastFrancoDate || !valorHora) return null;

    // (Lógica de inicialización de fechas y offset, se mantiene igual)
    let currentDate = new Date(year, month - 1, 1, 0, 0, 0);
    const lastFrancoDay2 = new Date(lastFrancoDate + 'T00:00:00');
    const dayAfterFranco = new Date(lastFrancoDay2.getTime());
    dayAfterFranco.setDate(dayAfterFranco.getDate() + 1);

    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const masterCycle = [
        'Mañana', 'Mañana', 'Mañana', 'Mañana', 'Mañana', 'Mañana', 'Franco', 'Franco',
        'Noche', 'Noche', 'Noche', 'Noche', 'Noche', 'Noche', 'Franco', 'Franco',
        'Tarde', 'Tarde', 'Tarde', 'Tarde', 'Tarde', 'Tarde', 'Franco', 'Franco'
    ];

    let baseOffset = initialTurn === 'Noche' ? 8 : initialTurn === 'Tarde' ? 16 : 0;
    const diffTime = currentDate.getTime() - dayAfterFranco.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    let startOffset = (baseOffset + diffDays) % 24;
    if (startOffset < 0) startOffset += 24;

    let dailyResults = [];
    let francosDates = [];
    const daysInMonth = new Date(year, month, 0).getDate();

    // Variables de Agregación Quincenal
    let q1TotalEquivHours = 0;
    let q1TotalExtraHoursReal = 0;
    let q2TotalEquivHours = 0;
    let q2TotalExtraHoursReal = 0;
    
    // ----------------------------------------------------
    // LOOP DIARIO
    // ----------------------------------------------------
    for (let i = 0; i < daysInMonth; i++) {
        const dayOfMonth = i + 1;
        const dayOfWeek = currentDate.getDay();
        const dateKeyForSave = currentDate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const isHolidayManual = appState.manualHolidays[dateKeyForSave] === true;
        const cycleStatus = masterCycle[startOffset];

        // ... (Cálculo de turnos, horas equivalentes y extras, se mantiene igual)
        let turnBaseName = cycleStatus;
        let realHours = 0;
        let equivalentHours = 0;
        
        // Determinar horas base y equivalentes (Franco, Feriado, Normal)
        if (cycleStatus === 'Franco') {
            if (isHolidayManual) {
                turnBaseName = `FERIADO - Franco`;
                equivalentHours = HOLIDAY_FREE_EQUIV_HOURS;
            } else {
                turnBaseName = `Franco`;
                francosDates.push(dateKeyForSave);
            }
        } else {
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

        // Calcular Extras
        const dayExtraReal = appState.extraHours[dateKeyForSave] || 0;
        const dayExtraEquivalent = dayExtraReal * EXTRA_HOUR_MULTIPLIER;
        const finalEquivHours = equivalentHours + dayExtraEquivalent;
        const dailyBruto = finalEquivHours * valorHora;
        
        // AGREGACIÓN QUINCENAL
        if (dayOfMonth <= 15) {
            q1TotalEquivHours += finalEquivHours;
            q1TotalExtraHoursReal += dayExtraReal;
        } else {
            q2TotalEquivHours += finalEquivHours;
            q2TotalExtraHoursReal += dayExtraReal;
        }


        // Registrar resultado diario
        dailyResults.push({
            date: dateKeyForSave,
            day: dayNames[dayOfWeek],
            turn: turnBaseName,
            isHoliday: isHolidayManual,
            equivHoursBase: equivalentHours,
            extraReal: dayExtraReal,
            equivHoursFinal: finalEquivHours,
            dailyBruto: dailyBruto,
            quincena: dayOfMonth <= 15 ? 1 : 2 // Marcar la quincena
        });

        startOffset = (startOffset + 1) % 24;
        currentDate.setDate(currentDate.getDate() + 1);
    }
    // ----------------------------------------------------
    // FIN LOOP DIARIO
    // ----------------------------------------------------
    
   // ... (Código anterior de calculateSalaryData hasta el final del LOOP DIARIO)

    // ----------------------------------------------------
    // CÁLCULO DE TOTALES QUINCENALES
    // ----------------------------------------------------
    const q1Bruto = q1TotalEquivHours * valorHora;
    const q1Descuento = q1Bruto * discountRate;
    const q1Neto = q1Bruto - q1Descuento;
    const q1CutOffDate = new Date(year, month - 1, 15);
    
    // --- LÓGICA DE SUMA DEL TÍTULO (NUEVA) ---
    const tituloSum = appState.profile?.isTechnician 
                      ? Number(appState.profile.tituloSum || 0) 
                      : 0;
    
    // El monto bruto de la Quincena 2 incluye las horas más el bono de título
    let q2BaseBruto = q2TotalEquivHours * valorHora;
    let q2Bruto = q2BaseBruto + tituloSum; // <--- SUMA A LA SEGUNDA QUINCENA
    
    const q2Descuento = q2Bruto * discountRate;
    const q2Neto = q2Bruto - q2Descuento;
    const q2CutOffDate = new Date(year, month, 0); 
    
    // Totales Mensuales (Suma de Quincenas)
    // ... (El resto del cálculo mensual se mantiene igual)

    return {
        // ... (El resto del objeto return se mantiene igual)
        
        // NUEVOS DATOS QUINCENALES
        quincena1: {
            // ... (Igual que antes)
        },
        quincena2: {
            // ... (Igual que antes)
            bruto: q2Bruto, // Ahora incluye Suma del Título
            neto: q2Neto, // Ahora incluye Suma del Título
            tituloSumApplied: tituloSum, // NUEVO CAMPO para el dashboard
            payDate: calculatePayday(q2CutOffDate),
            cutOffDate: q2CutOffDate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        },
    };
}
