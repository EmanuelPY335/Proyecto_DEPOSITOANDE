// src/utils/pdfGenerator.js
import jsPDF from "jspdf";
import "jspdf-autotable";

// ... (MANTENER LA FUNCIÓN generarValePDF IGUAL QUE ANTES) ...
export const generarValePDF = (vale, isPreview = false) => {
  // ... (código existente del vale) ...
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text("SISDEPO - Vale de Traslado", 14, 20);
  doc.setFontSize(12);
  doc.text(`Vale N°: ${vale.id_vale || vale.id}`, 14, 30);
  doc.text(`Fecha: ${vale.fecha || new Date().toLocaleDateString()}`, 14, 36);
  doc.text(`Estado: ${vale.estado || 'Pendiente'}`, 150, 30);
  doc.setFillColor(240, 240, 240); 
  doc.rect(14, 42, 182, 25, "F"); 
  doc.setFontSize(10);
  doc.setTextColor(50); 
  doc.text(`Origen: ${vale.origen || "Depósito Central"}`, 20, 50);
  doc.text(`Destino: ${vale.destino || "Sin definir"}`, 100, 50);
  doc.text(`Chofer: ${vale.chofer || "Sin asignar"}`, 20, 60);
  doc.text(`Vehículo: ${vale.vehiculo || "Sin asignar"}`, 100, 60);
  doc.setTextColor(0); 
  const items = vale.detalles || vale.items || []; 
  const tableColumn = ["Código", "Material", "Lote", "Cantidad"];
  const tableRows = items.map(item => [
    item.codigo || "-",
    item.material,
    item.lote || "N/A",
   `${item.cantidad} ${item.unidad || 'u.'}`
  ]);
  doc.autoTable({
    startY: 75,
    head: [tableColumn],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246] }, 
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: { 3: { halign: 'right', fontStyle: 'bold' } }
  });
  const finalY = doc.lastAutoTable.finalY + 40;
  if (finalY > 270) {
      doc.addPage();
      doc.line(20, 40, 80, 40);
      doc.text("Firma Responsable Almacén", 25, 45);
      doc.line(120, 40, 180, 40);
      doc.text("Firma Chofer", 135, 45);
  } else {
      doc.line(20, finalY, 80, finalY);
      doc.text("Firma Responsable Almacén", 25, finalY + 5);
      doc.line(120, finalY, 180, finalY);
      doc.text("Firma Chofer", 135, finalY + 5);
  }
  if (isPreview) {
    const blob = doc.output("bloburl");
    window.open(blob, "_blank");
  } else {
    doc.save(`Vale_Traslado_${vale.id_vale || vale.id}.pdf`);
  }
};

// --- REPORTE DE GASTOS CON DEPÓSITO ---
export const generarReporteGastosPDF = (gastos, nombreUsuario = "Usuario", periodo = "General", nombreDeposito = "General") => {
  const doc = new jsPDF();
  const fechaGeneracion = new Date().toLocaleDateString();

  // --- 1. Encabezado ---
  doc.setFontSize(18);
  doc.setTextColor(37, 99, 235); // Azul SISDEPO
  doc.text("SISDEPO - Reporte de Gastos", 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(100);
  
  // Datos Generales
  doc.text(`Generado por: ${nombreUsuario}`, 14, 28);
  doc.text(`Fecha de emisión: ${fechaGeneracion}`, 14, 33);
  doc.text(`Periodo: ${periodo}`, 14, 38);
  
  // DATO NUEVO: Depósito
  doc.setFont("helvetica", "bold"); // Negrita para destacar el depósito
  doc.text(`Depósito / Sucursal: ${nombreDeposito}`, 14, 44);
  doc.setFont("helvetica", "normal"); // Volver a normal

  // --- 2. Tabla ---
  const tableColumn = ["Fecha", "Concepto", "Categoría", "Vehículo", "Monto (Gs)"];
  
  const tableRows = gastos.map(g => [
    g.fecha_iso || g.fecha,
    g.titulo + (g.descripcion ? `\n(${g.descripcion})` : ""), 
    g.categoria,
    g.vehiculo || "-",
    g.monto.toLocaleString('es-PY')
  ]);

  // Ajustamos startY a 50 para dar espacio a la nueva línea del depósito
  doc.autoTable({
    startY: 50, 
    head: [tableColumn],
    body: tableRows,
    theme: 'striped',
    headStyles: { 
        fillColor: [30, 41, 59], 
        fontSize: 10,
        fontStyle: 'bold'
    },
    styles: { fontSize: 9, cellPadding: 3, valign: 'middle' },
    columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 'auto' }, 
        4: { halign: 'right', fontStyle: 'bold', cellWidth: 30 }
    }
  });

  // --- 3. Total General ---
  const finalY = doc.lastAutoTable.finalY + 10;
  const total = gastos.reduce((sum, g) => sum + (Number(g.monto) || 0), 0);

  doc.setFillColor(240, 253, 244); 
  doc.setDrawColor(22, 163, 74);   
  doc.rect(130, finalY - 6, 65, 12, 'FD');

  doc.setFontSize(12);
  doc.setTextColor(22, 163, 74); 
  doc.setFont("helvetica", "bold");
  doc.text(`TOTAL: Gs. ${total.toLocaleString('es-PY')}`, 135, finalY + 2);

  // --- 4. Pie de página ---
  const pageCount = doc.internal.getNumberOfPages();
  for(let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text('Sistema de Gestión de Depósito - SISDEPO', 14, 285);
      doc.text(`Página ${i} de ${pageCount}`, 185, 285);
  }

  // Nombre de archivo descriptivo
  const nombreArchivo = `Gastos_${nombreDeposito.replace(/ /g, '')}_${periodo.replace(/ /g, '')}.pdf`;
  doc.save(nombreArchivo);
};