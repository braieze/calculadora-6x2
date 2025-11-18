/**
 * Utilidades de Formato
 */
function formatCurrency(amount) {
    const number = parseFloat(amount) || 0;
    return number.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
}

function formatNumber(amount, decimals = 2) {
    const number = parseFloat(amount) || 0;
    return number.toLocaleString('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/**
 * Referencias al DOM (deberían ser inyectadas desde main.js)
 */
const DOM = {
    statusEl: document.getElementById('status-message'),
    summaryCardsEl: document.getElementById('summary-cards'),
    francosInfoEl: document.getElementById('francos-info'),
    tbodyEl: document.getElementById('daily-detail-tbody'),
    resultsSectionEl: document.getElementById('results-section'),
    calculateButtonEl: document.getElementById('calculate-schedule-button'),
    userInfoEl: document.getElementById('user-info'),
    googleLoginBtn: document.getElementById('google-login-btn'),
    logoutBtn: document.getElementById('logout-btn'),
    monthSelect: document.getElementById('input-month'),
    inputYear: document.getElementById('input-year'),
    inputValorHora: document.getElementById('input-valorHora'),
    inputLastFrancoDate: document.getElementById('input-lastFrancoDate'),
    inputInitialTurn: document.getElementById('input-initialTurn'),
    inputDiscountRate: document.getElementById('input-discountRate'),
};

/**
 * Actualiza el mensaje de estado de la aplicación.
 */
export function updateStatus(type, message) {
    const statusEl = DOM.statusEl;
    if (!message) {
        statusEl.classList.add('hidden');
        return;
    }
    
    statusEl.classList.remove('hidden');
    let colorClass = "";
    switch (type) {
        case 'success': colorClass = "bg-green-100 text-green-700"; break;
        case 'error': colorClass = "bg-red-100 text-red-700"; break;
        case 'info': colorClass = "bg-blue-100 text-blue-700"; break;
        default: colorClass = "bg-gray-100 text-gray-700"; break;
    }
    statusEl.className = `p-3 rounded-lg mt-4 font-semibold text-sm ${colorClass}`;
    statusEl.textContent = message;
}

/**
 * Actualiza el estado de carga del botón principal.
 */
export function setLoading(loading) {
    const text = loading ? 'Calculando...' : 'Generar/Actualizar Horario y Calcular Salario';
    DOM.calculateButtonEl.textContent = text;
    DOM.calculateButtonEl.disabled = loading;

    if (loading) {
        DOM.calculateButtonEl.classList.add('bg-indigo-400');
        DOM.calculateButtonButtonEl.classList.remove('bg-indigo-700', 'hover:bg-indigo-800');
    } else {
        DOM.calculateButtonEl.classList.remove('bg-indigo-400');
        DOM.calculateButtonEl.classList.add('bg-indigo-700', 'hover:bg-indigo-800');
    }
}

/**
 * Renderiza la UI basándose en el estado completo (inputs y resultados).
 * @param {object} appState - El estado global de la aplicación.
 * @param {function} handleExtraChange - Manejador para el cambio de horas extra.
 * @param {function} handleHolidayChange - Manejador para el cambio de feriado.
 */
export function updateUIFromState(appState, handleExtraChange, handleHolidayChange) {
    const { config, calculationResult, extraHours, manualHolidays } = appState;

    // 1. Llenar Inputs
    DOM.inputYear.value = config.year;
    DOM.inputValorHora.value = config.valorHora;
    DOM.inputLastFrancoDate.value = config.lastFrancoDate;
    DOM.inputInitialTurn.value = config.initialTurn;
    DOM.inputDiscountRate.value = config.discountRate;
    
    // 2. Llenar opciones de meses
    if (DOM.monthSelect.options.length === 0 || DOM.monthSelect.options.length !== 12) {
         DOM.monthSelect.innerHTML = ''; 
        Array.from({ length: 12 }, (_, i) => i + 1).forEach(m => {
            const option = document.createElement('option');
            option.value = m;
            option.textContent = new Date(config.year, m - 1).toLocaleDateString('es-AR', { month: 'long' });
            DOM.monthSelect.appendChild(option);
        });
    } 
    DOM.monthSelect.value = config.month;

    // 3. Mostrar Resultados
    renderCalculationResults(calculationResult, extraHours, manualHolidays, config, handleExtraChange, handleHolidayChange);

    // 4. Actualizar Status y Loading
    updateStatus(appState.status?.type, appState.status?.message);
    setLoading(appState.isLoading);
}

/**
 * Renderiza solo la sección de resultados (cards y tabla).
 */
function renderCalculationResults(result, extraHours, manualHolidays, config, handleExtraChange, handleHolidayChange) {
    if (!result) {
        DOM.resultsSectionEl.classList.add('hidden');
        return;
    }

    DOM.resultsSectionEl.classList.remove('hidden');

    // 1. Renderizar Cards de Resumen
    DOM.summaryCardsEl.innerHTML = `
        <div class="p-3 bg-gray-50 rounded-lg">
            <p class="text-gray-500">H. Eq. Totales</p>
            <p class="text-lg text-gray-900 font-extrabold">${formatNumber(result.totalEquivalentHours)}</p>
        </div>
        <div class="p-3 bg-red-50 rounded-lg">
            <p class="text-gray-500">Desc. (${result.discountRate.toFixed(0)}%)</p>
            <p class="text-lg text-red-600 font-extrabold">${formatCurrency(result.totalDescuento)}</p>
        </div>
        <div class="col-span-1 p-3 bg-indigo-50 rounded-lg">
            <p class="text-gray-500">Bruto Total</p>
            <p class="text-xl text-indigo-600 font-extrabold">${formatCurrency(result.totalBruto)}</p>
        </div>
        <div class="col-span-1 p-3 bg-green-100 rounded-lg shadow-md">
            <p class="text-green-700 font-semibold">NETO (EN MANO)</p>
            <p class="text-2xl text-green-800 font-extrabold">${formatCurrency(result.totalNeto)}</p>
        </div>
    `;

    // 2. Renderizar Información de Francos
    DOM.francosInfoEl.innerHTML = `
        <p class="font-bold text-yellow-800">Días Francos en el Mes (${result.francosDates.length}):</p>
        <p class="mt-1">${result.francosDates.join(' • ')}</p>
    `;

    // 3. Renderizar Tabla de Detalle Diario
    DOM.tbodyEl.innerHTML = result.dailyResults.map(day => {
        const dateKeyForSave = day.date; 
        const dayExtraReal = extraHours[dateKeyForSave] || 0;
        const isFeriadoManual = manualHolidays[dateKeyForSave] === true;
        
        const isFranco = day.turn.includes('Franco');
        
        let rowClasses = 'hover:bg-gray-50';
        if (isFranco && !isFeriadoManual) {
            rowClasses = 'bg-yellow-50 hover:bg-yellow-100 font-semibold text-yellow-800';
        } else if (isFeriadoManual) {
            rowClasses = 'bg-red-100 hover:bg-red-200 font-extrabold text-red-700';
        }

        return `
            <tr class="${rowClasses}">
                <td class="px-3 py-2 whitespace-nowrap text-gray-900">${day.date} - ${day.day.substring(0, 3)}</td>
                <td class="px-3 py-2 whitespace-nowrap text-gray-700">${day.turn}</td>
                <td class="px-3 py-2 whitespace-nowrap text-center">
                    <input type="checkbox" 
                        class="form-checkbox h-4 w-4 text-red-600 transition duration-150 ease-in-out"
                        ${isFeriadoManual ? 'checked' : ''}
                        onchange="this.parentElement.dispatchEvent(new CustomEvent('holidaychange', { bubbles: true, detail: { date: '${dateKeyForSave}', checked: this.checked } }))"
                    >
                </td>
                <td class="px-3 py-2 whitespace-nowrap text-right">${formatNumber(day.equivHoursBase, 2)}</td>
                <td class="px-3 py-2 whitespace-nowrap text-center">
                    <input type="number" 
                        value="${dayExtraReal || ''}"
                        class="w-16 text-center border rounded p-1 text-xs"
                        step="0.5" min="0"
                        onchange="this.parentElement.dispatchEvent(new CustomEvent('extrachange', { bubbles: true, detail: { date: '${dateKeyForSave}', value: this.value } }))"
                    >
                </td>
                <td class="px-3 py-2 whitespace-nowrap text-right font-bold ${isFeriadoManual ? 'text-red-700' : ''}">${formatNumber(day.equivHoursFinal, 2)}</td>
                <td class="px-3 py-2 whitespace-nowrap text-right font-bold">${formatCurrency(day.dailyBruto)}</td>
            </tr>
        `;
    }).join('');
    
    // Adjuntar los manejadores de eventos (usando delegación y Custom Events)
    document.getElementById('daily-detail-table').removeEventListener('extrachange', handleExtraChange);
    document.getElementById('daily-detail-table').addEventListener('extrachange', (e) => handleExtraChange(e.detail.date, e.detail.value));
    
    document.getElementById('daily-detail-table').removeEventListener('holidaychange', handleHolidayChange);
    document.getElementById('daily-detail-table').addEventListener('holidaychange', (e) => handleHolidayChange(e.detail.date, e.detail.checked));
}


/**
 * Actualiza la UI de autenticación.
 */
export function updateAuthUI(userId, userName, isGoogleAuthenticated, signInWithGoogle, signOutUser) {
    const user = { userId, userName, isGoogleAuthenticated }; // Simular el objeto user

    if (!userId) {
        DOM.userInfoEl.textContent = 'Cargando Autenticación...';
        DOM.googleLoginBtn.classList.remove('hidden');
        DOM.logoutBtn.classList.add('hidden');
        return;
    }
    
    if (user.isGoogleAuthenticated) {
        DOM.userInfoEl.textContent = `Hola, ${userName} (${userId.substring(0, 4)}...)`;
        DOM.googleLoginBtn.classList.add('hidden');
        DOM.logoutBtn.classList.remove('hidden');
    } else {
        DOM.userInfoEl.textContent = `Sesión: ${userName} (${userId ? userId.substring(0, 4) + '...' : 'Local'})`;
        // Mostrar Google si es anónimo o el token de Canvas no era Google
        DOM.googleLoginBtn.classList.remove('hidden');
        DOM.logoutBtn.classList.remove('hidden'); // Mostrar 'Salir' para cerrar sesión anónima
    }
    
    // Limpiar y adjuntar listeners de Auth
    DOM.googleLoginBtn.onclick = signInWithGoogle;
    DOM.logoutBtn.onclick = signOutUser;
}

/**
 * Genera y descarga el reporte PDF.
 */
export function generatePDFReport(result, config) {
    const { jsPDF } = window.jspdf; 
    const doc = new jsPDF();
    
    const { month, year } = config;
    const monthName = new Date(year, month - 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
    
    const title = `Reporte Salarial 6x2 - ${monthName}`;
    
    doc.setFontSize(16);
    doc.text(title, 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Valor Hora Bruta: ${formatCurrency(config.valorHora)}`, 14, 26);
    doc.text(`Desc. Afiliación: ${result.discountRate.toFixed(0)}%`, 14, 31);
    doc.text(`Horas Extra Reales: ${formatNumber(result.totalExtraHoursReal)}`, 14, 36);

    // Tabla de Resumen
    doc.autoTable({
        startY: 45,
        head: [['Total Horas Eq.', 'Bruto Total', 'Descuento', 'NETO FINAL']],
        body: [[
            formatNumber(result.totalEquivalentHours, 2),
            formatCurrency(result.totalBruto),
            formatCurrency(result.totalDescuento),
            formatCurrency(result.totalNeto),
        ]],
        theme: 'striped',
        headStyles: { fillColor: [55, 48, 163] }, 
        columnStyles: {
            0: { fontStyle: 'bold' },
            3: { fontStyle: 'bold', fillColor: [187, 247, 208] }, 
        },
        styles: { fontSize: 10 }
    });

    // Tabla de Detalle Diario
    const finalY = doc.autoTable.previous.finalY;
    doc.setFontSize(12);
    doc.text('Detalle Diario de Horas y Turnos', 14, finalY + 15);
    
    const tableData = result.dailyResults.map(d => [
        d.date,
        d.day.substring(0, 3),
        d.turn,
        d.isHoliday ? 'Sí' : 'No', 
        formatNumber(d.equivHoursBase, 2),
        d.extraReal > 0 ? formatNumber(d.extraReal, 1) : '',
        formatNumber(d.equivHoursFinal, 2),
        formatCurrency(d.dailyBruto)
    ]);
    
    doc.autoTable({
        startY: finalY + 20,
        head: [['Fecha', 'Día', 'Turno', 'Feriado?', 'H. Eq. Base', 'H. Extra (R)', 'H. Eq. Total', 'Monto Bruto']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [75, 85, 99] }, 
        columnStyles: {
            4: { halign: 'right' },
            5: { halign: 'center' },
            6: { halign: 'right', fontStyle: 'bold' },
            7: { halign: 'right', fontStyle: 'bold' },
        },
        didParseCell: (data) => {
            const turn = data.row.raw[2];
            const isHoliday = data.row.raw[3] === 'Sí';

            if (turn.includes('Franco') && !isHoliday) {
                data.cell.styles.fillColor = [255, 251, 235]; 
            }
            if (isHoliday) {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.textColor = [185, 28, 28]; 
                data.cell.styles.fillColor = [254, 226, 226];
            }
        },
        styles: { fontSize: 8 }
    });

    doc.save(`Reporte_6x2_${monthName.replace(/\s/g, '_')}.pdf`);
}
