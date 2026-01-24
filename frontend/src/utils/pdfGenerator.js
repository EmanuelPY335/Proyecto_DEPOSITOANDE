
/// src/utils/pdfGenerator.js
import jsPDF from "jspdf";
import "jspdf-autotable";

// ✅ Vale Externo + Movimiento Interno (MISMO GENERADOR)
export const generarValePDF = (vale, isPreview = false) => {
  const doc = new jsPDF();

  // ---------------------------------------------------------
  // Detectar tipo: interno vs externo
  // ---------------------------------------------------------
  const esInterno =
    vale?.tipo === "interno" ||
    vale?.es_local === true ||
    String(vale?.tipo_movimiento || "").toLowerCase().includes("interno");

  // Helpers
  const safe = (v, fallback = "N/D") => (v === null || v === undefined || v === "" ? fallback : v);
  const fechaDoc = safe(vale.fecha, new Date().toLocaleDateString());
  const estadoDoc = safe(vale.estado, esInterno ? "Registrado" : "Pendiente");

  // ---------------------------------------------------------
  // Encabezado
  // ---------------------------------------------------------
  doc.setFontSize(18);
  doc.setTextColor(0);

  if (esInterno) {
    doc.text("SISDEPO - Comprobante de Movimiento Interno", 14, 20);
  } else {
    doc.text("SISDEPO - Vale de Traslado", 14, 20);
  }

  doc.setFontSize(12);

  const numero = safe(vale.id_vale || vale.id, "-");
  doc.text(`${esInterno ? "Movimiento" : "Vale"} N°: ${numero}`, 14, 30);
  doc.text(`Fecha: ${fechaDoc}`, 14, 36);

  // Estado (a la derecha)
  doc.text(`Estado: ${estadoDoc}`, 150, 30);

  // ---------------------------------------------------------
  // Bloque gris con datos principales
  // ---------------------------------------------------------
  doc.setFillColor(240, 240, 240);
  doc.rect(14, 42, 182, esInterno ? 33 : 25, "F");
  doc.setFontSize(10);
  doc.setTextColor(50);

  // ---------------------------------------------------------
  // Datos por tipo
  // ---------------------------------------------------------
  if (esInterno) {
    // Interno
    const deposito = safe(vale.deposito, "Depósito");
    const responsable = safe(vale.responsable, safe(vale.chofer, "Sin asignar")); // fallback por compatibilidad
    const sectorOrigen = safe(vale.sector_origen, safe(vale.ubicacion_anterior, "N/D"));
    const sectorDestino = safe(vale.sector_destino, safe(vale.nueva_ubicacion, "N/D"));

    doc.text(`Depósito: ${deposito}`, 20, 50);
    doc.text(`Responsable: ${responsable}`, 20, 60);

    doc.text(`Sector Origen: ${sectorOrigen}`, 100, 50);
    doc.text(`Sector Destino: ${sectorDestino}`, 100, 60);

    // Observaciones (opcional) – línea extra
    const obs = (vale.observaciones || vale.obs || "").trim();
    if (obs) doc.text(`Obs: ${obs}`, 20, 70);
  } else {
    // Externo / Ruta
    doc.text(`Origen: ${safe(vale.origen, "Depósito Central")}`, 20, 50);
    doc.text(`Destino: ${safe(vale.destino, "Sin definir")}`, 100, 50);
    doc.text(`Chofer: ${safe(vale.chofer, "Sin asignar")}`, 20, 60);
    doc.text(`Vehículo: ${safe(vale.vehiculo, "Sin asignar")}`, 100, 60);
  }

  doc.setTextColor(0);

  // ---------------------------------------------------------
  // Tabla de items
  // ---------------------------------------------------------
  const items = vale.detalles || vale.items || [];

  // Columnas: Interno no siempre tiene "Código"
  const tableColumn = esInterno
    ? ["Material", "Lote", "Cantidad", "Sector Destino"]
    : ["Código", "Material", "Lote", "Cantidad"];

  const tableRows = items.map((item) => {
    const material = safe(item.material, "N/D");
    const lote = safe(item.lote || item.id_lote, "N/A");
    const cantidad = `${safe(item.cantidad, 0)} ${safe(item.unidad, "u.")}`;

    if (esInterno) {
      const sectorDst = safe(item.nueva_ubicacion || item.sector_destino || vale.nueva_ubicacion, "N/D");
      return [material, lote, cantidad, sectorDst];
    }

    const codigo = safe(item.codigo, "-");
    return [codigo, material, lote, cantidad];
  });

  // StartY: si interno y hay obs, movemos tabla un poco
  const startY = esInterno ? 80 : 75;

  doc.autoTable({
    startY,
    head: [tableColumn],
    body: tableRows,
    theme: "grid",
    headStyles: { fillColor: [59, 130, 246] },
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: {
      2: { halign: "right", fontStyle: "bold" }, // cantidad
    },
  });

  // ---------------------------------------------------------
  // Firmas
  // ---------------------------------------------------------
  const finalY = doc.lastAutoTable.finalY + 40;

  const firma1 = "Firma Responsable Almacén";
  const firma2 = esInterno ? "Firma Responsable del Movimiento" : "Firma Chofer";

  const drawFirmas = (y) => {
    doc.line(20, y, 80, y);
    doc.text(firma1, 25, y + 5);

    doc.line(120, y, 180, y);
    doc.text(firma2, 125, y + 5);
  };

  if (finalY > 270) {
    doc.addPage();
    drawFirmas(40);
  } else {
    drawFirmas(finalY);
  }

  // ---------------------------------------------------------
  // Guardar / Preview
  // ---------------------------------------------------------
  const filename = esInterno
    ? `Movimiento_Interno_${numero}.pdf`
    : `Vale_Traslado_${numero}.pdf`;

  if (isPreview) {
    const blob = doc.output("bloburl");
    window.open(blob, "_blank");
  } else {
    doc.save(filename);
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