import { appState } from './state.js';
// ¡IMPORTANTE! Hemos añadido saveProfileDetails al import
import { initAuth, saveConfig, saveData, saveProfileDetails } from './auth.js'; 
import { calculateSalaryData, saveCalculationHistory } from './logic.js'; // Importar la nueva función
import { renderResults, updateStatus } from './ui.js';
import { generatePDFReport } from './pdf.js';

// ----------------------------------------------------
// 1. FUNCIÓN PRINCIPAL DE RECÁLCULO (AHORA EXPORTADA)
// ----------------------------------------------------
// Eliminamos la asignación a 'window' y usamos 'export'
export async function refreshCalculation(initial = false) {
const result = calculateSalaryData();
    appState.calculationResult = result;
    renderResults(result);
    updateStatus('success', 'Cálculo realizado.');
    
    // NUEVA LÍNEA: GUARDAR EN EL HISTORIAL
    if (result && result.totalNeto > 0) {
        await saveCalculationHistory(result); // Llama a la función de guardado
}


// --- Event Listeners and Initialization ---

// 2. Inicialización
window.onload = async () => {
    // Inicializa inputs visualmente (antes de cargar de Firebase)
    populateInputs(); 
    // initAuth configura los listeners de Firebase y carga datos.
    // auth.js llamará a refreshCalculation() cuando tenga datos.
    await initAuth();  
};


// 3. Botón Calcular
document.getElementById('calculate-schedule-button').addEventListener('click', () => {
    refreshCalculation(true);
});

// 4. Inputs de Configuración
['input-month', 'input-year', 'input-valorHora', 'input-discountRate', 'input-lastFrancoDate', 'input-initialTurn'].forEach(id => {
    document.getElementById(id).addEventListener('change', (e) => {
        const val = e.target.value;
        if(id === 'input-valorHora' || id === 'input-discountRate') appState.config[e.target.name] = parseFloat(val);
        else if(id === 'input-month' || id === 'input-year') appState.config[e.target.name] = parseInt(val);
        else appState.config[e.target.name] = val;
        
        saveConfig(); // Guardar en Firebase
        refreshCalculation(); // Llamar a la función exportada
    });
});

// 5. Inputs de PERFIL
['input-category', 'input-tituloSum', 'input-isTechnician'].forEach(id => {
    document.getElementById(id).addEventListener('change', (e) => {
        const val = e.target.value;
        const name = e.target.name;

        // Manejar el checkbox
        if (name === 'isTechnician') {
            appState.profile[name] = e.target.checked;
        } 
        // Manejar números/texto
        else if (name === 'tituloSum') {
            appState.profile[name] = parseFloat(val) || 0;
        } 
        else {
            appState.profile[name] = val;
        }

        saveProfileDetails(); // <-- Correcto, ya importado
        refreshCalculation(); // <-- Llamar a la función exportada
    });
});

// 6. Inputs Dinámicos (Tabla) - Event Delegation
document.getElementById('daily-detail-tbody').addEventListener('change', (e) => {
    const dateKey = e.target.dataset.date;
    if (e.target.classList.contains('holiday-check')) {
        if (e.target.checked) appState.manualHolidays[dateKey] = true;
        else delete appState.manualHolidays[dateKey];
    } 
    else if (e.target.classList.contains('extra-input')) {
        appState.extraHours[dateKey] = parseFloat(e.target.value) || 0;
    }
    saveData(); // Guardar datos mensuales
    refreshCalculation();
});

// 7. PDF
document.getElementById('generate-pdf-button').addEventListener('click', generatePDFReport);
