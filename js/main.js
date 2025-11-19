import { appState } from './state.js';
import { initAuth, saveConfig, saveData, saveProfileDetails } from './auth.js'; 
// CORRECCIÓN: Se añaden populateInputs y renderDashboard de ui.js
import { calculateSalaryData, saveCalculationHistory } from './logic.js'; 
import { renderResults, updateStatus, populateInputs, renderDashboard } from './ui.js'; 
import { generatePDFReport } from './pdf.js';

// ----------------------------------------------------
// 1. FUNCIÓN PRINCIPAL DE RECÁLCULO (EXPORTADA)
// ----------------------------------------------------
/**
 * Ejecuta el cálculo salarial, actualiza la UI y guarda el historial si aplica.
 * @param {boolean} forceSaveHistory - Indica si se debe intentar guardar el historial.
 */
export async function refreshCalculation(forceSaveHistory = false) {
    const result = calculateSalaryData();
    appState.calculationResult = result;
    
    // Actualizar la vista de resultados y el dashboard
    renderResults(result);
    // Nota: renderDashboard debe ser llamado por initAuth cuando se carga el historial, 
    // pero lo incluimos aquí para asegurarnos de que el cálculo actual se refleje en los totales si es necesario.
    // Aunque auth.js lo orquesta, si appState.historicalData cambia, esta es una buena práctica.
    renderDashboard(appState.historicalData);
    
    updateStatus('success', 'Cálculo realizado y actualizado.');
    
    // NUEVA LÍNEA: GUARDAR EN EL HISTORIAL
    // Solo guardamos si hay un neto positivo y si se forzó el guardado (como al presionar "Calcular").
    if (result && result.totalNeto > 0 && forceSaveHistory) {
        await saveCalculationHistory(result);
    }
}


// --- Handlers de Eventos ---

/**
 * Handler para cambios en la configuración mensual.
 */
export function handleConfigChange() {
    const configInputs = document.querySelectorAll('#input-month, #input-year, #input-valorHora, #input-discountRate, #input-lastFrancoDate, #input-initialTurn');
    
    configInputs.forEach(input => {
        const val = input.value;
        const name = input.name;
        
        if (name === 'valorHora' || name === 'discountRate') appState.config[name] = parseFloat(val) || 0;
        else if (name === 'month' || name === 'year') appState.config[name] = parseInt(val);
        else appState.config[name] = val;
    });

    saveConfig(); // Guardar en Firebase
    refreshCalculation();
}

/**
 * Handler para cambios en el perfil de usuario.
 */
export function handleProfileChange() {
    const p = appState.profile;
    const isTechInput = document.getElementById('input-isTechnician');
    const tituloSumInput = document.getElementById('input-tituloSum');

    p.isTechnician = isTechInput.checked;
    p.category = document.getElementById('input-category').value;
    p.tituloSum = parseFloat(tituloSumInput.value) || 0;
    
    // Opcional: Deshabilitar el input de monto si no es técnico
    tituloSumInput.disabled = !p.isTechnician;

    saveProfileDetails(); // Guardar en Firebase
    refreshCalculation(); 
}

/**
 * Handler genérico para cambios en las horas extra o feriados de la tabla.
 */
export function handleDailyTableChange(e) {
    const dateKey = e.target.dataset.date;
    
    if (e.target.classList.contains('holiday-check')) {
        if (e.target.checked) appState.manualHolidays[dateKey] = true;
        else delete appState.manualHolidays[dateKey];
    } else if (e.target.classList.contains('extra-input')) {
        appState.extraHours[dateKey] = parseFloat(e.target.value) || 0;
    }
    
    saveData(); // Guardar datos mensuales (extraHours y manualHolidays)
    refreshCalculation();
}


// ----------------------------------------------------
// 2. INICIALIZACIÓN
// ----------------------------------------------------
window.onload = async () => {
    // 1. Inicializa inputs visualmente (antes de cargar de Firebase)
    populateInputs(); 
    
    // 2. initAuth configura los listeners de Firebase y carga datos.
    // auth.js llamará a refreshCalculation() cuando tenga datos.
    await initAuth(); 
    
    // 3. Setup de Event Listeners Globales
    
    // a) Inputs de Configuración y Perfil (usando la nueva función de delegación)
    document.querySelectorAll('.input-style, input[type="checkbox"]').forEach(input => {
        if (input.id.startsWith('input-')) {
            if (input.name === 'category' || input.name === 'tituloSum' || input.name === 'isTechnician') {
                input.addEventListener('change', handleProfileChange);
            } else {
                input.addEventListener('change', handleConfigChange);
            }
        }
    });
    
    // b) Botón Calcular
    document.getElementById('calculate-schedule-button').addEventListener('click', () => {
        // Al hacer clic, forzamos el guardado en el historial
        refreshCalculation(true); 
    });

    // c) Inputs Dinámicos (Tabla) - Event Delegation
    document.getElementById('daily-detail-tbody').addEventListener('change', handleDailyTableChange);

    // d) PDF
    document.getElementById('generate-pdf-button').addEventListener('click', () => {
        if(appState.calculationResult) {
            generatePDFReport(appState.calculationResult);
        } else {
            updateStatus('error', 'Debe realizar un cálculo primero para generar el PDF.');
        }
    });
};
