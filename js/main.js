import { appState } from './state.js';
import { initAuth, saveConfig, saveData } from './auth.js'; // Asume que creas este archivo para lógica auth/db
import { calculateSalaryData } from './logic.js';
import { updateStatus, renderResults, populateInputs } from './ui.js';
import { generatePDFReport } from './pdf.js';

// --- Event Listeners ---

// 1. Inicialización
window.onload = async () => {
    populateInputs();
    // initAuth configurará los listeners de Firebase y cargará datos,
    // luego llamará a refreshCalculation() cuando los datos lleguen.
    await initAuth(); 
};

// 2. Recálculo Global
window.refreshCalculation = (initial = false) => {
    appState.calculationResult = calculateSalaryData();
    renderResults(appState.calculationResult);
    if(initial && appState.calculationResult) updateStatus('success', 'Cálculo realizado.');
};

// 3. Botón Calcular
document.getElementById('calculate-schedule-button').addEventListener('click', () => {
    refreshCalculation(true);
});

// 4. Inputs de Configuración (Delegación simplificada)
['input-month', 'input-year', 'input-valorHora', 'input-discountRate', 'input-lastFrancoDate', 'input-initialTurn'].forEach(id => {
    document.getElementById(id).addEventListener('change', (e) => {
        const val = e.target.value;
        if(id === 'input-valorHora' || id === 'input-discountRate') appState.config[e.target.name] = parseFloat(val);
        else if(id === 'input-month' || id === 'input-year') appState.config[e.target.name] = parseInt(val);
        else appState.config[e.target.name] = val;
        
        saveConfig(); // Guardar en Firebase
        refreshCalculation();
    });
});

// 5. Inputs Dinámicos (Tabla) - Event Delegation
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

// 6. PDF
document.getElementById('generate-pdf-button').addEventListener('click', generatePDFReport);
