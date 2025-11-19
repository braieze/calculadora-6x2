import { appState } from './state.js';
import { saveData } from './auth.js'; // Necesario para guardar cambios de tabla diaria

// Variable global para mantener la instancia del gráfico Chart.js
let chartInstance = null; 

// --- Funciones de Utilidad de UI ---

const formatCurrency = (amount) => {
    // Asegura que es un número antes de formatear
    const num = parseFloat(amount) || 0;
    return num.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
};

// --- Manejo de Estado y Errores ---

/**
 * Muestra mensajes de estado y errores en la parte superior.
 * @param {string} type - 'success', 'error', 'info'.
 * @param {string} message - El mensaje a mostrar.
 */
export function updateStatus(type, message) {
    const statusEl = document.getElementById('status-message');
    statusEl.textContent = message;
    statusEl.className = 'p-3 rounded-lg text-sm transition-all duration-300';
    
    switch (type) {
        case 'success':
            statusEl.classList.add('bg-green-100', 'text-green-800');
            break;
        case 'error':
            statusEl.classList.add('bg-red-100', 'text-red-800');
            break;
        case 'info':
        default:
            statusEl.classList.add('bg-blue-100', 'text-blue-800');
            break;
    }
}


// --- Llenado de Inputs (Configuración y Perfil) ---

/**
 * Llena los inputs de configuración y perfil con los valores del estado (appState).
 */
export function populateInputs() {
    const config = appState.config;
    const profile = appState.profile;

    // 1. Inputs de Configuración
    document.getElementById('input-month').value = String(config.month).padStart(2, '0');
    document.getElementById('input-year').value = config.year;
    document.getElementById('input-valorHora').value = config.valorHora;
    document.getElementById('input-discountRate').value = config.discountRate * 100;
    document.getElementById('input-lastFrancoDate').value = config.lastFrancoDate;
    document.getElementById('input-initialTurn').value = config.initialTurn;

    // 2. Inputs de Perfil (NUEVO)
    // Asumimos que estos IDs existen en index.html
    if (document.getElementById('input-category')) {
        document.getElementById('input-category').value = profile.category;
    }
    if (document.getElementById('input-isTechnician')) {
        document.getElementById('input-isTechnician').checked = profile.isTechnician;
    }
    if (document.getElementById('input-tituloSum')) {
        document.getElementById('input-tituloSum').value = profile.tituloSum;
    }
}


// --- Renderizado de Resultados y Tabla Diaria ---

/**
 * Renderiza la tabla diaria y los resúmenes quincenales y mensuales.
 * @param {object} result - El resultado completo del cálculo.
 */
export function renderResults(result) {
    const { totalNeto, totalBruto, totalDescuento, quincena1, quincena2, dailyResults } = result;
    
    // 1. Mostrar la sección de resultados
    document.getElementById('results-section').classList.remove('hidden');

    // 2. Actualizar el resumen mensual
    document.getElementById('total-neto').textContent = formatCurrency(totalNeto);
    document.getElementById('total-bruto').textContent = formatCurrency(totalBruto);
    document.getElementById('total-descuento').textContent = formatCurrency(totalDescuento);

    // 3. Actualizar resumen Quincena 1
    document.getElementById('q1-bruto').textContent = formatCurrency(quincena1.bruto);
    document.getElementById('q1-neto').textContent = formatCurrency(quincena1.neto);
    document.getElementById('q1-cutOffDate').textContent = quincena1.cutOffDate;
    document.getElementById('q1-payDate').textContent = quincena1.payDate;

    // 4. Actualizar resumen Quincena 2
    document.getElementById('q2-bruto').textContent = formatCurrency(quincena2.bruto);
    document.getElementById('q2-neto').textContent = formatCurrency(quincena2.neto);
    document.getElementById('q2-cutOffDate').textContent = quincena2.cutOffDate;
    document.getElementById('q2-payDate').textContent = quincena2.payDate;
    
    // Mostrar bono por título si aplica
    const tituloSumEl = document.getElementById('q2-titulo-sum');
    if (tituloSumEl) {
        if (quincena2.tituloSumApplied > 0) {
            tituloSumEl.textContent = `(+Título: ${formatCurrency(quincena2.tituloSumApplied)})`;
            tituloSumEl.classList.remove('hidden');
        } else {
            tituloSumEl.classList.add('hidden');
        }
    }


    // 5. Renderizar la Tabla Diaria
    const tableBody = document.getElementById('daily-results-body');
    if (!tableBody) return;

    tableBody.innerHTML = dailyResults.map(day => {
        const isFranco = day.turn.includes('Franco') && !day.isHoliday;
        const isFeriado = day.isHoliday;
        
        let rowClass = 'bg-white hover:bg-gray-50';
        if (isFranco) {
            rowClass = 'bg-yellow-50 hover:bg-yellow-100';
        }
        if (isFeriado) {
            rowClass = 'bg-red-50 font-semibold text-red-700 hover:bg-red-100';
        }

        // Determinar si el campo de horas extra es editable (no Franco y no Feriado)
        const isEditable = !isFranco && !isFeriado;

        // ID único para el checkbox de feriado manual
        const holidayCheckboxId = `holiday-${day.date.replace(/[\/.]/g, '-')}`; 
        
        return `
            <tr class="${rowClass}">
                <td class="px-2 py-1 text-sm">${day.date} (${day.quincena})</td>
                <td class="px-2 py-1 text-sm">${day.day}</td>
                <td class="px-2 py-1 text-sm">${day.turn.replace('FERIADO - ', '')}</td>
                <td class="px-2 py-1 text-sm text-center">
                    <input 
                        type="checkbox" 
                        id="${holidayCheckboxId}"
                        class="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                        ${day.isHoliday ? 'checked' : ''}
                        onchange="handleHolidayChange('${day.date}', this)"
                    />
                </td>
                <td class="px-2 py-1 text-sm text-center">${day.equivHoursBase.toFixed(2)}</td>
                <td class="px-2 py-1 text-sm text-right">
                    <input 
                        type="number" 
                        min="0"
                        step="0.01"
                        value="${day.extraReal}"
                        class="w-16 text-right border rounded text-sm p-1 ${isEditable ? 'bg-white border-indigo-300' : 'bg-gray-200 border-gray-300'}"
                        ${isEditable ? `onchange="handleExtraChange('${day.date}', this)"` : 'disabled'}
                    />
                </td>
                <td class="px-2 py-1 text-sm font-bold text-right">${day.equivHoursFinal.toFixed(2)}</td>
                <td class="px-2 py-1 text-sm font-bold text-right">${formatCurrency(day.dailyBruto)}</td>
            </tr>
        `;
    }).join('');
}


// --- Renderizado del Dashboard Histórico ---
/**
 * Dibuja el gráfico de tendencia salarial y el resumen histórico.
 * @param {object} data - Datos históricos de appState.historicalData.
 */
export function renderDashboard(data) {
    const section = document.getElementById('dashboard-section');
    const chartCanvas = document.getElementById('salary-chart');
    const summaryEl = document.getElementById('historical-summary');

    // Muestra/Oculta la sección
    const monthKeys = Object.keys(data).sort();
    if (monthKeys.length < 2) {
        section.classList.add('hidden');
        if (summaryEl) summaryEl.innerHTML = '';
        if (chartInstance) chartInstance.destroy();
        return;
    }
    section.classList.remove('hidden');

    // 1. PREPARAR DATOS PARA EL GRÁFICO
    const labels = [];
    const netos = [];
    
    let totalBruto = 0;
    let totalNeto = 0;
    
    monthKeys.forEach(key => {
        const item = data[key];
        const monthName = new Date(item.year, item.month - 1).toLocaleDateString('es-AR', { month: 'short', year: 'numeric' });
        
        labels.push(monthName);
        netos.push(item.totalNeto);
        
        totalBruto += item.totalBruto;
        totalNeto += item.totalNeto;
    });

    // 2. RENDERIZAR GRÁFICO (usando Chart.js)
    if (chartInstance) {
        chartInstance.destroy(); // Destruir instancia anterior
    }

    // Chart.js debe estar cargado en index.html
    if (window.Chart && chartCanvas) {
        chartInstance = new window.Chart(chartCanvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Neto Total Mensual',
                    data: netos,
                    borderColor: 'rgb(79, 70, 229)', 
                    backgroundColor: 'rgba(79, 70, 229, 0.2)',
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: false,
                        title: { display: true, text: 'Monto Neto (ARS)' },
                        ticks: {
                            callback: function(value) { return formatCurrency(value); }
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
                            }
                        }
                    }
                }
            }
        });
    }

    // 3. RENDERIZAR RESUMEN HISTÓRICO
    if (summaryEl) {
        const avgNeto = totalNeto / monthKeys.length;
        const maxNeto = Math.max(...netos);

        summaryEl.innerHTML = `
            <div class="p-3 bg-gray-50 rounded-lg">
                <p class="text-gray-500 text-sm">Meses en Historial</p>
                <p class="text-xl font-bold">${monthKeys.length}</p>
            </div>
            <div class="p-3 bg-indigo-50 rounded-lg">
                <p class="text-gray-500 text-sm">Neto Promedio</p>
                <p class="text-xl font-bold">${formatCurrency(avgNeto)}</p>
            </div>
            <div class="p-3 bg-indigo-50 rounded-lg">
                <p class="text-gray-500 text-sm">Neto Máximo</p>
                <p class="text-xl font-bold">${formatCurrency(maxNeto)}</p>
            </div>
            <div class="p-3 bg-indigo-50 rounded-lg">
                <p class="text-gray-500 text-sm">Neto Total Acumulado</p>
                <p class="text-xl font-bold">${formatCurrency(totalNeto)}</p>
            </div>
        `;
    }
}
