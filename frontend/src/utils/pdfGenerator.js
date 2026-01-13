// src/utils/pdfGenerator.js
import jsPDF from "jspdf";
import "jspdf-autotable";

export const generarValePDF = (vale, isPreview = false) => {
  const doc = new jsPDF();

  // --- 1. Encabezado ---
  doc.setFontSize(18);
  doc.text("SISDEPO - Vale de Traslado", 14, 20);
  
  doc.setFontSize(12);
  doc.text(`Vale N°: ${vale.id_vale || vale.id}`, 14, 30);
  doc.text(`Fecha: ${vale.fecha || new Date().toLocaleDateString()}`, 14, 36);
  doc.text(`Estado: ${vale.estado || 'Pendiente'}`, 150, 30);

  // --- 2. Información de Ruta (Caja Gris) ---
  doc.setFillColor(240, 240, 240); 
  doc.rect(14, 42, 182, 25, "F"); 
  
  doc.setFontSize(10);
  doc.setTextColor(50); 

  doc.text(`Origen: ${vale.origen || "Depósito Central"}`, 20, 50);
  doc.text(`Destino: ${vale.destino || "Sin definir"}`, 100, 50);
  doc.text(`Chofer: ${vale.chofer || "Sin asignar"}`, 20, 60);
  doc.text(`Vehículo: ${vale.vehiculo || "Sin asignar"}`, 100, 60);

  doc.setTextColor(0); 

  // --- 3. Tabla de Materiales ---
  const items = vale.detalles || vale.items || []; 
  
  const tableColumn = ["Código", "Material", "Lote", "Cantidad"];
  const tableRows = items.map(item => [
    item.codigo || "-",
    item.material,
    item.lote || "N/A",
    // AQUÍ CONCATENAMOS LA UNIDAD
   `${item.cantidad} ${item.unidad || 'u.'}`
  ]);

  doc.autoTable({
    startY: 75,
    head: [tableColumn],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246] }, 
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: {
        3: { halign: 'right', fontStyle: 'bold' } // Alineamos cantidad a la derecha
    }
  });

  // --- 4. Firmas ---
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

  // --- 5. Salida ---
  if (isPreview) {
    const blob = doc.output("bloburl");
    window.open(blob, "_blank");
  } else {
    doc.save(`Vale_Traslado_${vale.id_vale || vale.id}.pdf`);
  }
};