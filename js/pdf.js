import { appState } from './state.js';

const formatCurrency = (amt) => parseFloat(amt || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
const formatNumber = (amt) => parseFloat(amt || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 });

export function generatePDFReport() {
    const result = appState.calculationResult;
    if (!result) {
        alert("Primero debes realizar el cálculo.");
        return;
    }

    // Accedemos a jsPDF desde el objeto global window (porque lo cargamos vía CDN en el HTML)
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const { month, year, valorHora } = appState.config;
    const monthName = new Date(year, month - 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
    
    // Título
    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text(`Reporte Salarial 6x2`, 14, 20);
    
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`Periodo: ${monthName}`, 14, 28);
    
    // Resumen
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Valor Hora: ${formatCurrency(valorHora)}`, 14, 38);
    doc.text(`Total Bruto: ${formatCurrency(result.totalBruto)}`, 14, 44);
    doc.text(`Total Neto: ${formatCurrency(result.totalNeto)}`, 14, 50);

    // Tabla usando AutoTable
    const tableData = result.dailyResults.map(d => [
        d.date,
        d.day,
        d.turn,
        d.isHoliday ? 'Sí' : '-',
        formatNumber(d.equivHoursBase),
        d.extraReal > 0 ? d.extraReal : '-',
        formatNumber(d.equivHoursFinal),
        formatCurrency(d.dailyBruto)
    ]);

    doc.autoTable({
        startY: 55,
        head: [['Fecha', 'Día', 'Turno', 'Feriado', 'H.Eq', 'H.Ex', 'Total', 'Monto ($)']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] }, // Color Indigo
        styles: { fontSize: 8, cellPadding: 2 },
        alternateRowStyles: { fillColor: [245, 247, 250] }
    });

    doc.save(`Reporte_${monthName.replace(/ /g, '_')}.pdf`);
}
