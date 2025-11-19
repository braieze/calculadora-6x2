import { appState } from './state.js';

const EXTRA_HOUR_MULTIPLIER = 1.5;
const HOLIDAY_WORKED_EQUIV_HOURS = 32;
const HOLIDAY_FREE_EQUIV_HOURS = 8;

// Utilidad interna
function getTurnEquivalencies(dayOfWeek, turnType) {
    let realHours = 8;
    let equivalentHours = 8;
    let turnBaseName = turnType;
    
    if (dayOfWeek >= 1 && dayOfWeek <= 5) { // L-V
        if (turnType === 'Noche') equivalentHours = 12;
    } else if (dayOfWeek === 6) { // Sábado
        if (turnType === 'Mañana') { realHours = 8; equivalentHours = 9; }
        if (turnType === 'Tarde') { realHours = 9; equivalentHours = 12; }
        if (turnType === 'Noche') { realHours = 8; equivalentHours = 16; }
    } else if (dayOfWeek === 0) { // Domingo
        turnBaseName = 'Domingo ' + turnType;
        if (turnType !== 'Noche') equivalentHours = 24;
        else equivalentHours = 28;
    }
    return { realHours, equivalentHours, turnBaseName };
}

export function calculateSalaryData() {
    const { month, year, lastFrancoDate, initialTurn, valorHora, discountRate } = appState.config;

    if (!lastFrancoDate || !valorHora) return null;

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

    for (let i = 0; i < daysInMonth; i++) {
        const dayOfWeek = currentDate.getDay();
        const dateKeyForSave = currentDate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const isHolidayManual = appState.manualHolidays[dateKeyForSave] === true;
        const cycleStatus = masterCycle[startOffset];

        let turnBaseName = cycleStatus;
        let realHours = 0;
        let equivalentHours = 0;

        if (cycleStatus === 'Franco') {
            if (isHolidayManual) {
                turnBaseName = `FERIADO - Franco`;
                equivalentHours = HOLIDAY_FREE_EQUIV_HOURS;
                francosDates.push(dateKeyForSave + ' (Feriado)');
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

        dailyResults.push({
            date: dateKeyForSave,
            day: dayNames[dayOfWeek],
            turn: turnBaseName,
            isHoliday: isHolidayManual,
            equivHoursBase: equivalentHours,
            extraReal: dayExtraReal,
            equivHoursFinal: finalEquivHours,
            dailyBruto: dailyBruto
        });

        startOffset = (startOffset + 1) % 24;
        currentDate.setDate(currentDate.getDate() + 1);
    }

    const totalEquivalentHours = dailyResults.reduce((acc, d) => acc + d.equivHoursFinal, 0);
    const totalExtraHoursReal = dailyResults.reduce((acc, d) => acc + d.extraReal, 0);
    const totalBruto = totalEquivalentHours * valorHora;
    const totalDescuento = totalBruto * discountRate;
    const totalNeto = totalBruto - totalDescuento;

    return {
        dailyResults,
        francosDates,
        totalEquivalentHours,
        totalExtraHoursReal,
        totalBruto,
        totalDescuento,
        totalNeto,
        discountRate: discountRate * 100
    };
}
