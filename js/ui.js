import { appState } from './state.js';

const formatCurrency = (amt) => parseFloat(amt || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
const formatNumber = (amt) => parseFloat(amt || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 });

export function renderResults(result) {
    const section = document.getElementById('results-section');
    
    // 1. PRIMER CHECK: Si el resultado es nulo, ocultamos y salimos.
    if (!result) { section.classList.add('hidden'); return; }
    section.classList.remove('hidden');

    // Hacemos la propiedad de descuento segura para evitar el TypeError si es undefined.
    const discountRateDisplay = result.discountRate ?? 0;
    
    // 2. CARDS DE TOTALES MENSUALES
    document.getElementById('summary-cards').innerHTML = `
        <div class="p-3 bg-gray-50 rounded-lg">
            <p class="text-gray-500">H. Eq. Totales</p>
            <p class="text-lg font-bold">${formatNumber(result.totalEquivalentHours)}</p>
        </div>
        <div class="p-3 bg-red-50 rounded-lg">
            <p class="text-gray-500">Desc. (${discountRateDisplay.toFixed(0)}%)</p>
            <p class="text-lg text-red-600 font-bold">${formatCurrency(result.totalDescuento)}</p>
        </div>
        <div class="p-3 bg-indigo-50 rounded-lg">
            <p class="text-gray-500">Bruto Total</p>
            <p class="text-xl text-indigo-600 font-bold">${formatCurrency(result.totalBruto)}</p>
        </div>
        <div class="p-3 bg-green-100 rounded-lg">
            <p class="text-green-700 font-semibold">NETO TOTAL</p>
            <p class="text-2xl text-green-800 font-bold">${formatCurrency(result.totalNeto)}</p>
        </div>
    `;
    
    // 3. CARDS DE RESUMEN QUINCENAL
    const quincenaSection = document.getElementById('quincena-summary-section');
    if (!quincenaSection) {
        console.error("Missing #quincena-summary-section in HTML");
        return; 
    }
    quincenaSection.innerHTML = `
        <div class="bg-blue-50 p-4 rounded-lg border-b border-blue-200">
            <h4 class="text-md font-bold text-blue-700 mb-2">Pago 1 (Corte ${result.quincena1.cutOffDate})</h4>
            <div class="flex justify-between items-center text-sm">
                <p class="text-gray-600">Neto Quincena:</p>
                <p class="text-blue-800 font-extrabold">${formatCurrency(result.quincena1.neto)}</p>
            </div>
            <p class="text-xs text-blue-600 mt-1">Fecha de Cobro Estimada: <span class="font-bold">${result.quincena1.payDate}</span></p>
        </div>
        <div class="bg-blue-50 p-4 rounded-lg">
            <h4 class="text-md font-bold text-blue-700 mb-2">Pago 2 (Corte ${result.quincena2.cutOffDate})</h4>
            <div class="flex justify-between items-center text-sm">
                <p class="text-gray-600">Neto Quincena:</p>
                <p class="text-blue-800 font-extrabold">${formatCurrency(result.quincena2.neto)}</p>
            </div>
            <p class="text-xs text-blue-600 mt-1">Fecha de Cobro Estimada: <span class="font-bold">${result.quincena2.payDate}</span></p>
        </div>
    `;


    // 4. TABLA DIARIA (CORRECCIÓN CRÍTICA: Aseguramos que dailyResults exista)
    // Asegúrate de usar (result.dailyResults ?? [])
    document.getElementById('daily-detail-tbody').innerHTML = (result.dailyResults ?? []).map(day => {
        const isFranco = day.turn.includes('Franco');
        let rowClass = isFranco && !day.isHoliday ? 'bg-yellow-50 text-yellow-800' : day.isHoliday ? 'bg-red-100 text-red-700' : 'hover:bg-gray-50';
        
        return `
            <tr class="${rowClass}">
                <td class="px-3 py-2">${day.date} - ${day.day.substring(0,3)}</td>
                <td class="px-3 py-2 text-center text-xs text-indigo-500 font-semibold">Q${day.quincena}</td>
                <td class="px-3 py-2">${day.turn}</td>
                <td class="px-3 py-2 text-center"><input type="checkbox" ${day.isHoliday ? 'checked' : ''} data-date="${day.date}" class="holiday-check"></td>
                <td class="px-3 py-2 text-right">${formatNumber(day.equivHoursBase)}</td>
                <td class="px-3 py-2 text-center"><input type="number" value="${day.extraReal || ''}" step="0.5" min="0" data-date="${day.date}" class="extra-input w-16 text-center border rounded"></td>
                <td class="px-3 py-2 text-right font-bold">${formatNumber(day.equivHoursFinal)}</td>
                <td class="px-3 py-2 text-right font-bold">${formatCurrency(day.dailyBruto)}</td>
            </tr>
        `;
    }).join('');
}

let chartInstance = null; // Variable para mantener la instancia del gráfico

const formatCurrency = (amt) => parseFloat(amt || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

export function renderDashboard(data) {
    const section = document.getElementById('dashboard-section');
    const chartCanvas = document.getElementById('salary-chart');
    const summaryEl = document.getElementById('historical-summary');

    const monthKeys = Object.keys(data).sort();
    if (monthKeys.length === 0) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');

    // 1. PREPARAR DATOS PARA EL GRÁFICO
    const labels = [];
    const netos = [];
    
    // Calcular totales para el resumen
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

    chartInstance = new Chart(chartCanvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Neto Total Mensual',
                data: netos,
                borderColor: 'rgb(79, 70, 229)', // Indigo-600
                backgroundColor: 'rgba(79, 70, 229, 0.2)',
                tension: 0.1,
                fill: true
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: 'Monto Neto (ARS)'
                    },
                    ticks: {
                        callback: function(value, index, values) {
                            return formatCurrency(value);
                        }
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

    // 3. RENDERIZAR RESUMEN HISTÓRICO
    const avgNeto = totalNeto / monthKeys.length;

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
            <p class="text-xl font-bold">${formatCurrency(Math.max(...netos))}</p>
        </div>
        <div class="p-3 bg-indigo-50 rounded-lg">
            <p class="text-gray-500 text-sm">Neto Total Acumulado</p>
            <p class="text-xl font-bold">${formatCurrency(totalNeto)}</p>
        </div>
    `;
}

export function updateStatus(type, message) {
    const el = document.getElementById('status-message');
    if (!message) { el.classList.add('hidden'); return; }
    
    el.classList.remove('hidden', 'bg-green-100', 'text-green-700', 'bg-red-100', 'text-red-700', 'bg-blue-100', 'text-blue-700');
    
    if (type === 'success') el.classList.add('bg-green-100', 'text-green-700');
    else if (type === 'error') el.classList.add('bg-red-100', 'text-red-700');
    else el.classList.add('bg-blue-100', 'text-blue-700');
    
    el.textContent = message;
}

export function populateInputs() {
    const c = appState.config;
    const p = appState.profile; 

    // 1. CARGA DE CONFIGURACIÓN DE CÁLCULO
    document.getElementById('input-year').value = c.year;
    document.getElementById('input-valorHora').value = c.valorHora;
    document.getElementById('input-lastFrancoDate').value = c.lastFrancoDate;
    document.getElementById('input-initialTurn').value = c.initialTurn;
    document.getElementById('input-discountRate').value = c.discountRate;
    
    // Meses
    const sel = document.getElementById('input-month');
    if(sel.options.length !== 12) {
        sel.innerHTML = '';
        Array.from({length: 12}, (_,i) => i+1).forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = new Date(c.year, m-1).toLocaleDateString('es-AR', {month:'long'});
            sel.appendChild(opt);
        });
    }
    sel.value = c.month;
    
    // 2. CARGA DE CONFIGURACIÓN DE PERFIL
    document.getElementById('input-category').value = p.category || '';
    document.getElementById('input-tituloSum').value = p.tituloSum || 0;
    document.getElementById('input-isTechnician').checked = p.isTechnician || false;
    
    // Opcional: Deshabilitar el input de monto si no es técnico
    document.getElementById('input-tituloSum').disabled = !p.isTechnician;
}
