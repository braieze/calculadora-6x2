// jspdf para la generación de PDF
import { jsPDF } from "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";

// Formateador de moneda para EUR
const currencyFormatter = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
});

// -------------------- MANEJO DE ESTADO DE UI --------------------

/**
 * Muestra u oculta el indicador de carga y deshabilita el botón principal.
 * @param {boolean} isLoading - Si la aplicación está en estado de carga.
 */
export function setLoading(isLoading) {
    const calcButton = document.getElementById('calculate-schedule-button');
    if (calcButton) {
        calcButton.disabled = isLoading;
        calcButton.textContent = isLoading ? 'Procesando...' : 'Generar/Actualizar Horario y Calcular Salario';
    }
}

/**
 * Muestra un mensaje de estado en la parte inferior de la UI.
 * @param {string} message - El mensaje a mostrar.
 * @param {'success' | 'error' | 'warning' | 'info'} type - Tipo de mensaje para aplicar estilo.
 */
export function updateStatus(message, type = 'info') {
    const statusElement = document.getElementById('status-message');
    if (!statusElement) return;

    statusElement.textContent = message;
    statusElement.classList.remove('hidden', 'bg-red-100', 'text-red-800', 'bg-green-100', 'text-green-800', 'bg-yellow-100', 'text-yellow-800', 'bg-blue-100', 'text-blue-800');
    statusElement.classList.add('flex');

    switch (type) {
        case 'success':
            statusElement.classList.add('bg-green-100', 'text-green-800');
            break;
        case 'error':
            statusElement.classList.add('bg-red-100', 'text-red-800');
            break;
        case 'warning':
            statusElement.classList.add('bg-yellow-100', 'text-yellow-800');
            break;
        case 'info':
        default:
            statusElement.classList.add('bg-blue-100', 'text-blue-800');
            break;
    }
    
    // Ocultar automáticamente después de 5 segundos
    setTimeout(() => {
        statusElement.classList.add('hidden');
    }, 5000);
}

/**
 * Actualiza la UI de autenticación (botones de Google/Cerrar Sesión).
 * @param {import('firebase/auth').User | null} user - Objeto de usuario de Firebase.
 */
export function updateAuthUI(user) {
    const signInBtn = document.getElementById('google-login-btn');
    const signOutBtn = document.getElementById('logout-btn');
    const profileBtn = document.getElementById('profile-btn');
    const authStatus = document.getElementById('auth-status');
    const userIdDisplay = document.getElementById('user-id-display');
    const calcButton = document.getElementById('calculate-schedule-button');

    if (user && user.uid) {
        // Logueado
        signInBtn?.classList.add('hidden');
        signOutBtn?.classList.remove('hidden');
        profileBtn?.classList.remove('hidden');
        authStatus.textContent = user.isAnonymous ? 'Sesión Anónima' : 'Sesión Iniciada';
        userIdDisplay.textContent = `User ID: ${user.uid}`;
        calcButton.disabled = false; // Habilitar el botón de cálculo
    } else {
        // No logueado
        signInBtn?.classList.remove('hidden');
        signOutBtn?.classList.add('hidden');
        profileBtn?.classList.add('hidden');
        authStatus.textContent = 'Desconectado';
        userIdDisplay.textContent = 'User ID: N/A';
        calcButton.disabled = true; // Deshabilitar el botón de cálculo
    }
}


// -------------------- MANEJO DE DATOS Y RENDERIZADO --------------------

/**
 * Renderiza el resumen de pagos.
 * @param {Object} summary - Objeto con los datos resumidos.
 */
function renderSummary(summary) {
    document.getElementById('summary-bruto').textContent = currencyFormatter.format(summary.totalBruto);
    document.getElementById('summary-neto').textContent = currencyFormatter.format(summary.totalNeto);
    document.getElementById('summary-horasEq').textContent = summary.totalHorasEq.toFixed(2);
    document.getElementById('summary-bonus').textContent = currencyFormatter.format(summary.technicianTitleBonus);
}

/**
 * Renderiza la lista de fechas de cobro.
 * @param {Array<{quincenaEndDay: number, date: Date}>} paymentDates - Array de fechas de pago.
 */
function renderPaymentDates(paymentDates) {
    const container = document.getElementById('payment-dates-list');
    container.innerHTML = '';
    
    if (paymentDates && paymentDates.length) {
        paymentDates.forEach(item => {
            const dateStr = item.date.toLocaleDateString('es-ES', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                weekday: 'long'
            });

            const p = document.createElement('p');
            p.className = 'text-sm text-gray-700';
            p.innerHTML = `<span class="font-semibold">Corte ${item.quincenaEndDay}:</span> <span class="capitalize">${dateStr}</span>`;
            container.appendChild(p);
        });
    } else {
         container.innerHTML = '<p class="text-sm text-gray-500">No hay fechas de cobro calculadas.</p>';
    }
}


/**
 * Renderiza la tabla de detalles diarios.
 * @param {Array<Object>} schedule - Array con el horario diario.
 */
function renderScheduleTable(schedule) {
    const tbody = document.getElementById('daily-detail-tbody');
    tbody.innerHTML = '';

    schedule.forEach((day, index) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-indigo-50 transition duration-100';

        const dayOfMonth = day.date.getDate();
        const dayOfWeek = day.date.toLocaleDateString('es-ES', { weekday: 'short' });
        const isFranco = day.turn.includes('Franco');

        // Estilo especial para Francos
        if (isFranco) {
             tr.classList.add('bg-gray-100', 'text-gray-500', 'font-medium');
        } else if (day.isHoliday) {
             tr.classList.add('bg-red-50', 'text-red-800', 'font-medium');
        }

        // 1. Día y Turno
        tr.innerHTML += `<td class="font-semibold text-gray-900">${dayOfMonth} (${dayOfWeek})</td>`;
        tr.innerHTML += `<td>${day.turn}</td>`;
        
        // 2. Horas Base
        tr.innerHTML += `<td>${day.baseHours.toFixed(2)}</td>`;
        
        // 3. Horas Extra (Editable solo si NO es franco)
        tr.innerHTML += `<td>
            <input type="number" data-index="${index}" data-field="extraHours" 
                   value="${day.extraHours.toFixed(2)}" min="0" step="0.5" 
                   class="w-20 p-1 text-center border rounded-lg ${isFranco ? 'bg-gray-200 cursor-not-allowed' : 'border-indigo-300 focus:ring-indigo-500'}"
                   ${isFranco ? 'disabled' : ''}>
        </td>`;

        // 4. Feriado (Editable solo si NO es franco)
        tr.innerHTML += `<td>
            <input type="checkbox" data-index="${index}" data-field="isHoliday" 
                   ${day.isHoliday ? 'checked' : ''}
                   class="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                   ${isFranco ? 'disabled' : ''}>
        </td>`;

        // 5. Horas Eq. Día
        tr.innerHTML += `<td class="font-semibold">${day.totalHoursEq.toFixed(2)}</td>`;
        
        // 6. Bruto Día
        tr.innerHTML += `<td class="font-bold">${currencyFormatter.format(day.bruto)}</td>`;

        tbody.appendChild(tr);
    });
}

/**
 * Función principal para actualizar toda la interfaz de usuario.
 * @param {Object} appState - El estado global de la aplicación.
 */
export function updateUIFromState(appState) {
    setLoading(appState.isLoadingData);

    const resultsSection = document.getElementById('results-section');
    
    if (appState.data && appState.data.schedule && appState.data.summary) {
        // Mostrar resultados
        resultsSection.classList.remove('hidden');
        renderSummary(appState.data.summary);
        renderScheduleTable(appState.data.schedule);
        renderPaymentDates(appState.data.paymentDates);
    } else {
        // Ocultar resultados si no hay datos
        resultsSection.classList.add('hidden');
    }
}


// -------------------- MODALES --------------------

/**
 * Abre un modal.
 * @param {string} id - ID del elemento modal.
 */
export function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

/**
 * Cierra un modal.
 * @param {string} id - ID del elemento modal.
 */
export function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

// -------------------- GENERACIÓN DE PDF --------------------

/**
 * Genera el reporte PDF a partir de los datos.
 * @param {Object} appState - El estado global de la aplicación.
 */
export function generatePDFReport(appState) {
    if (!appState.data || !appState.data.summary) {
        updateStatus('No hay datos calculados para generar el PDF.', 'warning');
        return;
    }

    // Inicializar jspdf
    const doc = new jsPDF();
    let y = 10;
    const MARGIN = 10;
    const LINE_HEIGHT = 7;
    const FONT_SIZE = 10;

    doc.setFontSize(18);
    doc.text(`Reporte Salarial 6x2 - ${appState.data.month}/${appState.data.year}`, MARGIN, y);
    y += LINE_HEIGHT * 2;
    
    doc.setFontSize(14);
    doc.text("Resumen de Pagos", MARGIN, y);
    y += LINE_HEIGHT;
    
    doc.setFontSize(FONT_SIZE);
    
    // Resumen
    const summary = appState.data.summary;
    const profile = appState.profile;

    doc.text(`Categoría: ${profile?.category || 'No definido'}`, MARGIN, y); y += LINE_HEIGHT;
    doc.text(`Título Técnico: ${profile?.isTechnician ? 'Sí' : 'No'}`, MARGIN, y); y += LINE_HEIGHT;
    doc.text(`Valor Hora Bruta: ${currencyFormatter.format(appState.config.valorHora)}`, MARGIN, y); y += LINE_HEIGHT;
    doc.text(`Tasa Descuento: ${(appState.config.discountRate * 100).toFixed(0)}%`, MARGIN, y); y += LINE_HEIGHT * 1.5;

    doc.setFontSize(12);
    doc.text(`BRUTO ESTIMADO: ${currencyFormatter.format(summary.totalBruto)}`, MARGIN, y); y += LINE_HEIGHT;
    doc.text(`NETO ESTIMADO: ${currencyFormatter.format(summary.totalNeto)}`, MARGIN, y); y += LINE_HEIGHT * 1.5;
    
    doc.setFontSize(FONT_SIZE);
    doc.text(`Total Horas Equivalentes: ${summary.totalHorasEq.toFixed(2)}`, MARGIN, y); y += LINE_HEIGHT;
    doc.text(`Bono Título Técnico: ${currencyFormatter.format(summary.technicianTitleBonus)}`, MARGIN, y); y += LINE_HEIGHT * 2;
    
    // Fechas de Cobro
    doc.setFontSize(14);
    doc.text("Fechas de Cobro (4to día hábil)", MARGIN, y);
    y += LINE_HEIGHT;
    
    doc.setFontSize(FONT_SIZE);
    appState.data.paymentDates.forEach(item => {
        const dateStr = item.date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', weekday: 'long' });
        doc.text(`Corte ${item.quincenaEndDay}: ${dateStr}`, MARGIN, y);
        y += LINE_HEIGHT;
    });
    y += LINE_HEIGHT;
    
    // Tabla de Horario
    doc.setFontSize(14);
    doc.text("Detalle de Horario Diario", MARGIN, y);
    y += LINE_HEIGHT;

    // Encabezados de tabla
    const headers = ["Día", "Turno", "H. Base", "H. Extra", "Feriado", "H. Eq.", "Bruto Día"];
    const data = appState.data.schedule.map(day => [
        `${day.date.getDate()} (${day.date.toLocaleDateString('es-ES', { weekday: 'short' })})`,
        day.turn,
        day.baseHours.toFixed(2),
        day.extraHours.toFixed(2),
        day.isHoliday ? 'Sí' : 'No',
        day.totalHoursEq.toFixed(2),
        currencyFormatter.format(day.bruto),
    ]);

    doc.autoTable({
        startY: y,
        head: [headers],
        body: data,
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 1, overflow: 'linebreak' },
        headStyles: { fillColor: [51, 65, 85] }
    });

    // Guardar el PDF
    doc.save(`Reporte_Salarial_${appState.data.month}_${appState.data.year}.pdf`);
    updateStatus('PDF generado exitosamente.', 'success');
}
