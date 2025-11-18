// -------------------- MANEJO DE MODALES (NUEVO) --------------------

/**
 * Abre un modal específico.
 * @param {string} id - ID del elemento modal.
 */
export function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('hidden');
        // Asegurar que la opacidad se establece después de eliminar 'hidden'
        setTimeout(() => modal.style.opacity = 1, 10);
    }
}

/**
 * Cierra un modal específico.
 * @param {string} id - ID del elemento modal.
 */
export function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        // Usa una transición suave antes de ocultar
        modal.style.opacity = 0;
        setTimeout(() => modal.classList.add('hidden'), 300); // 300ms de transición
    }
}

// -------------------- UTILIDADES --------------------

/**
 * Formatea un número como moneda (pesos argentinos).
 * @param {number} value - Número a formatear.
 * @returns {string} - Cadena de texto formateada.
 */
export function formatNumber(value) {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2,
    }).format(value);
}

/**
 * Muestra o esconde el spinner de carga.
 * @param {boolean} isLoading - Si la aplicación está cargando.
 */
export function setLoading(isLoading) {
    document.getElementById('calculate-schedule-button').disabled = isLoading;
    document.getElementById('calculate-schedule-button').textContent = isLoading ? 'Procesando...' : 'Generar/Actualizar Horario y Calcular Salario';
}

/**
 * Muestra un mensaje de estado en la interfaz.
 * @param {string} message - El mensaje a mostrar.
 * @param {'info' | 'success' | 'warning' | 'error'} type - Tipo de mensaje.
 */
export function updateStatus(message, type) {
    const statusDiv = document.getElementById('status-message');
    statusDiv.textContent = message;
    statusDiv.className = 'p-3 rounded-lg mt-4 font-semibold text-sm';

    // Clases de Tailwind según el tipo
    switch (type) {
        case 'success':
            statusDiv.classList.add('bg-green-100', 'text-green-800');
            break;
        case 'warning':
            statusDiv.classList.add('bg-yellow-100', 'text-yellow-800');
            break;
        case 'error':
            statusDiv.classList.add('bg-red-100', 'text-red-800');
            break;
        case 'info':
        default:
            statusDiv.classList.add('bg-blue-100', 'text-blue-800');
            break;
    }
    statusDiv.classList.remove('hidden');
}


// -------------------- MANEJO DE AUTENTICACIÓN --------------------

/**
 * Actualiza la UI de autenticación (botones y mensaje de usuario).
 * También maneja la visibilidad del botón de Perfil.
 * @param {import('firebase/auth').User | null} user - Objeto de usuario de Firebase.
 */
export function updateAuthUI(user) {
    const loginBtn = document.getElementById('google-login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userInfoDiv = document.getElementById('user-info');
    const profileBtn = document.getElementById('profile-btn'); // Nuevo

    if (user) {
        loginBtn.classList.add('hidden');
        logoutBtn.classList.remove('hidden');
        profileBtn.classList.remove('hidden'); // Mostrar botón de perfil
        
        const email = user.email || 'Anónimo';
        const uidPart = user.uid ? ` | ID: ${user.uid}` : '';
        userInfoDiv.innerHTML = `<span class="text-xs font-bold text-indigo-700">${email}</span>${uidPart}`;
    } else {
        loginBtn.classList.remove('hidden');
        logoutBtn.classList.add('hidden');
        profileBtn.classList.add('hidden'); // Ocultar botón de perfil
        userInfoDiv.textContent = 'Desconectado';
    }
}

// -------------------- RENDERIZADO PRINCIPAL DE RESULTADOS --------------------

/**
 * Renderiza el resumen de ganancias.
 * @param {Object} summary - Objeto con los totales de ganancias.
 * @param {Object | null} profile - El perfil del usuario.
 */
function renderSummaryCards(summary, profile) {
    const container = document.getElementById('summary-cards');
    container.innerHTML = '';
    
    // Obtener información del perfil
    const categoryText = profile?.category || 'No definido';
    const isTechnicianText = profile?.isTechnician ? 'Sí' : 'No';

    const cardsData = [
        { title: 'Categoría', value: categoryText, color: 'bg-indigo-100', text: 'text-indigo-800', key: 'category' },
        { title: 'Técnico', value: isTechnicianText, color: 'bg-green-100', text: 'text-green-800', key: 'technician' },
        { title: 'Total Bruto', value: formatNumber(summary.totalBruto), color: 'bg-blue-100', text: 'text-blue-800', key: 'bruto' },
        { title: 'Total Neto Estimado', value: formatNumber(summary.totalNeto), color: 'bg-red-100', text: 'text-red-800', key: 'neto' },
        { title: 'Total Horas Eq.', value: summary.totalHorasEq.toFixed(2), color: 'bg-gray-100', text: 'text-gray-800', key: 'horas' },
        { title: 'Horas Extras', value: summary.totalHorasExtra.toFixed(2), color: 'bg-yellow-100', text: 'text-yellow-800', key: 'extra' },
        { title: 'Feriados (H. Eq.)', value: summary.totalFeriadoEq.toFixed(2), color: 'bg-purple-100', text: 'text-purple-800', key: 'feriado' },
        { title: 'Suma Título (2da Q)', value: formatNumber(summary.technicianTitleBonus || 0), color: 'bg-pink-100', text: 'text-pink-800', key: 'bonus' },
    ];
    
    cardsData.forEach(item => {
        const card = document.createElement('div');
        card.className = `p-3 rounded-lg ${item.color} flex flex-col justify-center items-center text-center`;
        card.innerHTML = `
            <p class="text-xs font-semibold text-gray-600">${item.title}</p>
            <p class="text-base font-bold ${item.text} truncate">${item.value}</p>
        `;
        container.appendChild(card);
    });
}

/**
 * Renderiza la tabla con el detalle diario de turnos y cálculos.
 * @param {Array<Object>} schedule - Array con el detalle de cada día.
 * @param {Object} currentData - Objeto de datos con el mes y año.
 */
function renderDailyDetail(schedule, currentData) {
    const tbody = document.getElementById('daily-detail-tbody');
    tbody.innerHTML = '';
    
    schedule.forEach((day, index) => {
        const tr = document.createElement('tr');
        tr.className = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';

        // Determinar si es Franco
        const isFranco = day.turn === 'Franco' || day.turn.includes('Día 2');
        const rowClass = isFranco ? 'text-gray-500 italic' : (day.isHoliday ? 'bg-red-50 text-red-800 font-semibold' : '');

        tr.className += ` ${rowClass}`;

        const dateString = `${day.date.getDate().toString().padStart(2, '0')}/${(day.date.getMonth() + 1).toString().padStart(2, '0')}`;

        tr.innerHTML = `
            <td class="px-3 py-2 whitespace-nowrap">${dateString}</td>
            <td class="px-3 py-2 whitespace-nowrap">${day.turn}</td>
            <td class="px-3 py-2 text-center">
                <input type="checkbox" data-index="${index}" data-field="isHoliday" 
                       ${day.isHoliday ? 'checked' : ''} class="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500">
            </td>
            <td class="px-3 py-2 text-right">${day.baseHours.toFixed(2)}</td>
            <td class="px-3 py-2 text-center">
                <input type="number" data-index="${index}" data-field="extraHours" 
                       value="${day.extraHours || 0}" step="0.5" 
                       class="w-16 text-right border rounded text-xs p-1 ${isFranco ? 'bg-gray-200' : 'bg-white'}">
            </td>
            <td class="px-3 py-2 text-right font-bold">${day.totalHoursEq.toFixed(2)}</td>
            <td class="px-3 py-2 text-right">${formatNumber(day.bruto)}</td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * Muestra información relevante sobre Francos y fechas de cobro.
 * @param {Array<Object>} schedule - Array con el detalle de cada día.
 * @param {Array<Object>} paymentDates - NUEVO: Array con las fechas de cobro calculadas.
 */
function renderFrancosInfo(schedule, paymentDates) {
    const container = document.getElementById('francos-info');
    let html = '';

    // 1. Próximo Franco
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalizar para comparación
    
    // Encontrar el próximo franco (Día 1 o Día 2) que sea posterior a hoy
    const nextFrancoDay1 = schedule.find(d => d.turn === 'Franco (Día 1)' && d.date >= today);
    const nextFrancoDay2 = schedule.find(d => d.turn === 'Franco (Día 2)' && d.date >= today);

    let nextFranco = null;
    if (nextFrancoDay1 && nextFrancoDay2) {
        nextFranco = nextFrancoDay1.date < nextFrancoDay2.date ? nextFrancoDay1 : nextFrancoDay2;
    } else if (nextFrancoDay1) {
        nextFranco = nextFrancoDay1;
    } else if (nextFrancoDay2) {
        nextFranco = nextFrancoDay2;
    }

    if (nextFranco) {
        const dateStr = nextFranco.date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
        html += `<p class="font-bold text-lg text-yellow-900 mb-2">📢 Tu próximo franco es el: <span class="text-indigo-700 capitalize">${dateStr}</span> (${nextFranco.turn})</p>`;
    } else {
        html += '<p class="text-sm font-semibold text-yellow-900 mb-2">No se encontraron francos futuros en este mes.</p>';
    }

    // 2. Fechas de Cobro (NUEVO)
    if (paymentDates && paymentDates.length > 0) {
        html += `<p class="text-sm font-semibold mt-3 border-t pt-2 text-gray-700">Fechas de Cobro Estimadas (4 Días Hábiles):</p>`;
        paymentDates.forEach(p => {
            const dateStr = p.date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
            html += `<p class="text-xs ml-2">➡️ Quincena que finaliza el ${p.quincenaEndDay}: <span class="font-bold text-green-700 capitalize">${dateStr}</span></p>`;
        });
    }

    container.innerHTML = html;
}


/**
 * Función principal para actualizar toda la UI en base al estado de la aplicación.
 * @param {Object} appState - El estado global de la aplicación.
 */
export function updateUIFromState(appState) {
    const resultsSection = document.getElementById('results-section');
    const valorHoraInput = document.getElementById('input-valorHora');
    
    // Ocultar la sección de resultados si no hay datos.
    if (!appState.data || !appState.data.schedule || appState.data.schedule.length === 0) {
        resultsSection.classList.add('hidden');
        return;
    }
    
    // Mostrar resultados y el botón de perfil si estamos aquí
    resultsSection.classList.remove('hidden');

    // Sincronizar inputs (asegura que los valores cargados de Firestore se muestren)
    // Esto es importante si el usuario cambia el mes y carga una configuración guardada
    valorHoraInput.value = appState.config.valorHora.toFixed(2);
    document.getElementById('input-discountRate').value = appState.config.discountRate;

    // Renderizar las partes
    renderSummaryCards(appState.data.summary, appState.profile); // Pasar el perfil
    renderDailyDetail(appState.data.schedule, appState.data);
    renderFrancosInfo(appState.data.schedule, appState.data.paymentDates); // Pasar las fechas de cobro
}


// NO ES NECESARIO EXPORTAR, JSDPF ya está cargado globalmente en index.html
/**
 * Genera el reporte PDF con los datos del cálculo.
 * @param {Object} appState - El estado global de la aplicación.
 */
export function generatePDFReport(appState) {
    if (!appState.data || !appState.data.schedule) {
        updateStatus('No hay datos de cálculo para generar el PDF.', 'error');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const margin = 15;
    let y = margin;
    const pageWidth = doc.internal.pageSize.getWidth();

    // 1. Cabecera
    doc.setFontSize(16);
    doc.setTextColor(30, 58, 138); // Indigo-700
    const title = `Reporte Salarial - ${appState.data.month}/${appState.data.year}`;
    doc.text(title, pageWidth / 2, y, { align: 'center' });
    y += 8;

    // 2. Información del Perfil y Configuración
    doc.setFontSize(10);
    doc.setTextColor(55, 65, 81); // Gray-700
    doc.text(`Usuario ID: ${appState.userId || 'No autenticado'}`, margin, y);
    y += 5;
    doc.text(`Categoría: ${appState.profile?.category || 'No definido'} | Técnico: ${appState.profile?.isTechnician ? 'Sí' : 'No'}`, margin, y);
    y += 5;
    doc.text(`Valor Hora Bruta: ${formatNumber(appState.config.valorHora)} | Desc. Afiliación: ${appState.config.discountRate * 100}%`, margin, y);
    y += 8;
    
    // 3. Resumen de Ganancias
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text('RESUMEN DE GANANCIAS', margin, y);
    y += 5;

    const summaryData = [
        ['Total Bruto', formatNumber(appState.data.summary.totalBruto)],
        ['Suma Título (2da Q)', formatNumber(appState.data.summary.technicianTitleBonus || 0)],
        ['Total Neto Estimado', formatNumber(appState.data.summary.totalNeto)],
        ['Total Horas Equivalentes', `${appState.data.summary.totalHorasEq.toFixed(2)} hs`],
        ['Total Horas Extra', `${appState.data.summary.totalHorasExtra.toFixed(2)} hs`],
    ];

    doc.autoTable({
        startY: y,
        head: [['Concepto', 'Monto / Valor']],
        body: summaryData,
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [243, 244, 246] }, // Gray-100
        margin: { left: margin, right: margin },
        didDrawPage: (data) => {
            y = data.cursor.y;
        }
    });

    // 4. Detalle Diario (Tabla Grande)
    y = y + (summaryData.length * 5) + 5; // Ajuste manual después de la tabla resumen

    doc.setFontSize(12);
    doc.text('DETALLE DIARIO', margin, y);
    y += 5;

    const tableData = appState.data.schedule.map(day => [
        day.date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' }),
        day.turn,
        day.isHoliday ? 'Sí' : 'No',
        day.baseHours.toFixed(2),
        day.extraHours.toFixed(2),
        day.totalHoursEq.toFixed(2),
        formatNumber(day.bruto)
    ]);

    doc.autoTable({
        startY: y,
        head: [
            ['Fecha', 'Turno', 'Feriado', 'H. Eq. Base', 'H. Extra', 'H. Eq. Total', 'Monto Bruto']
        ],
        body: tableData,
        styles: { fontSize: 7, cellPadding: 1, overflow: 'linebreak' },
        headStyles: { fillColor: [55, 65, 81], textColor: 255 }, // Gray-700
        columnStyles: {
            2: { halign: 'center' },
            3: { halign: 'right' },
            4: { halign: 'right' },
            5: { halign: 'right' },
            6: { halign: 'right' }
        },
        margin: { left: margin, right: margin }
    });

    doc.save(`Reporte_Salarial_${appState.data.year}_${appState.data.month}.pdf`);
    updateStatus('Reporte PDF generado exitosamente.', 'success');
}
