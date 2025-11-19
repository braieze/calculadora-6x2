import { appState } from './state.js';

const formatCurrency = (amt) => parseFloat(amt || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
const formatNumber = (amt) => parseFloat(amt || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 });

export function renderResults(result) {
    const section = document.getElementById('results-section');
    if (!result) { section.classList.add('hidden'); return; }
    section.classList.remove('hidden');

    // 1. CARDS DE TOTALES MENSUALES (Igual que antes, pero sumando las quincenas)
    document.getElementById('summary-cards').innerHTML = `
        <div class="p-3 bg-gray-50 rounded-lg">
            <p class="text-gray-500">H. Eq. Totales</p>
            <p class="text-lg font-bold">${formatNumber(result.totalEquivalentHours)}</p>
        </div>
        <div class="p-3 bg-red-50 rounded-lg">
            <p class="text-gray-500">Desc. (${result.discountRate.toFixed(0)}%)</p>
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
    
    // 2. NUEVOS CARDS DE RESUMEN QUINCENAL
    const quincenaSection = document.getElementById('quincena-summary-section');
    if (!quincenaSection) {
        // Esto evita que falle si nos olvidamos de agregar la sección en el HTML (Paso 3)
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


    // 3. TABLA DIARIA (Añadir columna de Quincena para referencia)
    document.getElementById('daily-detail-tbody').innerHTML = result.dailyResults.map(day => {
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
}
