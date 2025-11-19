import { appState } from './state.js';

const formatCurrency = (amt) => parseFloat(amt || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
const formatNumber = (amt) => parseFloat(amt || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 });

export function updateStatus(type, message) {
    const el = document.getElementById('status-message');
    if (!message) { el.classList.add('hidden'); return; }
    
    el.classList.remove('hidden', 'bg-green-100', 'text-green-700', 'bg-red-100', 'text-red-700', 'bg-blue-100', 'text-blue-700');
    
    if (type === 'success') el.classList.add('bg-green-100', 'text-green-700');
    else if (type === 'error') el.classList.add('bg-red-100', 'text-red-700');
    else el.classList.add('bg-blue-100', 'text-blue-700');
    
    el.textContent = message;
}

export function renderResults(result) {
    const section = document.getElementById('results-section');
    if (!result) { section.classList.add('hidden'); return; }
    section.classList.remove('hidden');

    // Cards
    document.getElementById('summary-cards').innerHTML = `
        <div class="p-3 bg-gray-50 rounded-lg"><p class="text-gray-500">H. Eq. Totales</p><p class="text-lg font-bold">${formatNumber(result.totalEquivalentHours)}</p></div>
        <div class="p-3 bg-red-50 rounded-lg"><p class="text-gray-500">Desc. (${result.discountRate.toFixed(0)}%)</p><p class="text-lg text-red-600 font-bold">${formatCurrency(result.totalDescuento)}</p></div>
        <div class="p-3 bg-indigo-50 rounded-lg"><p class="text-gray-500">Bruto Total</p><p class="text-xl text-indigo-600 font-bold">${formatCurrency(result.totalBruto)}</p></div>
        <div class="p-3 bg-green-100 rounded-lg"><p class="text-green-700 font-semibold">NETO</p><p class="text-2xl text-green-800 font-bold">${formatCurrency(result.totalNeto)}</p></div>
    `;

    // Tabla
    document.getElementById('daily-detail-tbody').innerHTML = result.dailyResults.map(day => {
        const isFranco = day.turn.includes('Franco');
        let rowClass = isFranco && !day.isHoliday ? 'bg-yellow-50 text-yellow-800' : day.isHoliday ? 'bg-red-100 text-red-700' : 'hover:bg-gray-50';
        
        return `
            <tr class="${rowClass}">
                <td class="px-3 py-2">${day.date} - ${day.day.substring(0,3)}</td>
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
