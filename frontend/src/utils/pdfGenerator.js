// src/utils/pdfGenerator.js
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
  const safe = (v, fallback = "N/D") =>
    v === null || v === undefined || v === "" ? fallback : v;

  const fechaDoc = safe(vale.fecha, new Date().toLocaleDateString());
  const numero = safe(vale.id_vale || vale.id, "-");
  
  // Estado
  const estadoDoc = safe(vale.estado, esInterno ? "Registrado" : "Pendiente");

  // ==========================================================================
  // DISEÑO ESPECÍFICO PARA MOVIMIENTO INTERNO (TIPO IMAGEN REFERENCIA)
  // ==========================================================================
  if (esInterno) {
    // 1. Título Principal
    doc.setFontSize(18);
    doc.setTextColor(0);
    doc.text("SISDEPO - Comprobante de Movimiento Interno", 14, 22);

    // 2. Subtítulo (Número y Fecha y Estado)
    doc.setFontSize(11);
    doc.setTextColor(0);
    
    // Izquierda
    doc.text(`Movimiento N°: ${numero}`, 14, 32);
    doc.text(`Fecha: ${fechaDoc}`, 14, 38);

    // Derecha (Estado)
    doc.text(`Estado: ${estadoDoc}`, 150, 32);

    // 3. CAJA GRIS DE INFORMACIÓN (Header Datos)
    // Coordenadas: x=14, y=45
    doc.setFillColor(240, 240, 240); // Gris muy suave
    doc.rect(14, 45, 182, 35, "F"); // Caja rellena

    doc.setFontSize(10);
    doc.setTextColor(60); // Gris oscuro para etiquetas

    const deposito = safe(vale.deposito, "Depósito Central");
    const responsable = safe(vale.responsable, "Sin Asignar");
    const maquinaria = safe(vale.maquinaria || vale.vehiculo, "N/A"); // Mapeamos vehículo como maquinaria
    const sectorOrg = safe(vale.sector_origen, "N/D");
    const sectorDst = safe(vale.sector_destino, "N/D");

    // -- Columna Izquierda --
    doc.text("Depósito:", 18, 55);
    doc.setTextColor(0); // Negro para valor
    doc.text(deposito, 45, 55);

    doc.setTextColor(60);
    doc.text("Responsable:", 18, 63);
    doc.setTextColor(0);
    doc.text(responsable, 45, 63);

    // Maquinaria (Resaltada como en la foto)
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14); // Más grande
    doc.text(`Maquinaria: ${maquinaria}`, 18, 74);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    // -- Columna Derecha --
    doc.setTextColor(60);
    doc.text("Sector Origen:", 110, 55);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold"); // Resaltar sector
    doc.text(sectorOrg, 140, 55);
    doc.setFont("helvetica", "normal");

    doc.setTextColor(60);
    doc.text("Sector Destino:", 110, 63);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold"); // Resaltar sector
    doc.text(sectorDst, 140, 63);
    doc.setFont("helvetica", "normal");

    // 4. TABLA DE ITEMS (Azul como referencia)
    const items = vale.detalles || vale.items || [];
    
    // Columnas exactas de la imagen: Material | Lote | Cantidad | Sector Destino
    const tableBody = items.map(item => {
        const mat = safe(item.material, "Material N/D");
        const lote = safe(item.lote || item.id_lote, "-");
        const cant = `${safe(item.cantidad, 0)} ${safe(item.unidad, "u.")}`;
        // A veces el item tiene un destino específico, sino usa el general del vale
        const dest = item.sector_destino || item.nueva_ubicacion || sectorDst; 

        return [mat, lote, cant, dest];
    });

    doc.autoTable({
        startY: 85,
        head: [["Material", "Lote", "Cantidad", "Sector Destino"]],
        body: tableBody,
        theme: "grid",
        headStyles: {
            fillColor: [47, 128, 237], // Azul brillante (tipo Google/Material Design)
            textColor: 255,
            fontStyle: "bold",
            halign: "left"
        },
        styles: {
            fontSize: 10,
            cellPadding: 5,
            valign: "middle"
        },
        columnStyles: {
            0: { cellWidth: 'auto' }, // Material expande
            1: { cellWidth: 40 },
            2: { cellWidth: 30, halign: "center", fontStyle: "bold" },
            3: { cellWidth: 40, fontStyle: "bold" } // Sector destino resaltado
        }
    });

    // 5. Observaciones (si existen) al pie
    const obs = (vale.observaciones || vale.obs || "").trim();
    if (obs) {
        const finalY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`Observaciones: ${obs}`, 14, finalY);
    }

  } 
  // ==========================================================================
  // DISEÑO PARA RUTA EXTERNA (Mantiene el estilo anterior funcional)
  // ==========================================================================
  else {
    doc.setFontSize(18);
    doc.setTextColor(0);
    doc.text("SISDEPO - Vale de Traslado", 14, 20);

    doc.setFontSize(12);
    doc.text(`Vale N°: ${numero}`, 14, 30);
    doc.text(`Fecha: ${fechaDoc}`, 14, 36);
    doc.text(`Estado: ${estadoDoc}`, 150, 30);

    // Bloque Gris
    doc.setFillColor(240, 240, 240);
    doc.rect(14, 42, 182, 25, "F");
    doc.setFontSize(10);
    doc.setTextColor(50);

    doc.text(`Origen: ${safe(vale.origen, "Depósito Central")}`, 20, 50);
    const esMultiparada = Array.isArray(vale.paradas) && vale.paradas.length > 1;
    doc.text(`Destino: ${esMultiparada ? "Multiparada" : safe(vale.destino, "Sin definir")}`, 100, 50);
    doc.text(`Chofer: ${safe(vale.chofer, "Sin asignar")}`, 20, 60);
    doc.text(`Vehículo: ${safe(vale.vehiculo, "Sin asignar")}`, 100, 60);

    doc.setTextColor(0);

    // Tabla Multiparada o Simple
    if (Array.isArray(vale.paradas) && vale.paradas.length) {
      const startY = 75;
      const head = [["Paradas", "Material", "Lote", "Cantidad"]];
      const body = [];

      vale.paradas.forEach((parada) => {
        const destino = safe(parada.destino, "Destino");
        const items = Array.isArray(parada.items) ? parada.items : [];
        items.forEach((it) => {
          body.push([
            destino,
            safe(it.material, "N/D"),
            safe(it.lote || it.id_lote, "N/A"),
            `${safe(it.cantidad, 0)} ${safe(it.unidad, "u.")}`
          ]);
        });
      });

      doc.autoTable({
        startY,
        head,
        body,
        theme: "grid",
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
        styles: { fontSize: 10, cellPadding: 4, valign: "middle", overflow: "linebreak" },
      });
    } else {
      const items = vale.detalles || vale.items || [];
      const tableRows = items.map((item) => [
          safe(item.codigo, "-"),
          safe(item.material, "N/D"),
          safe(item.lote || item.id_lote, "N/A"),
          `${safe(item.cantidad, 0)} ${safe(item.unidad, "u.")}`
      ]);

      doc.autoTable({
        startY: 75,
        head: [["Código", "Material", "Lote", "Cantidad"]],
        body: tableRows,
        theme: "grid",
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 10, cellPadding: 4 },
        columnStyles: { 3: { halign: "right", fontStyle: "bold" } }
      });
    }

    // Firmas Externa
    const lastY = (doc.lastAutoTable && typeof doc.lastAutoTable.finalY === "number") ? doc.lastAutoTable.finalY : 75;
    const finalY = lastY + 40;

    const drawFirmas = (y) => {
      doc.line(20, y, 80, y);
      doc.text("Firma Responsable Almacén", 25, y + 5);
      doc.line(120, y, 180, y);
      doc.text("Firma Chofer", 125, y + 5);
    };

    if (finalY > 270) {
      doc.addPage();
      drawFirmas(40);
    } else {
      drawFirmas(finalY);
    }
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

// --- REPORTE DE GASTOS (Se mantiene igual) ---
export const generarReporteGastosPDF = (
  gastos,
  nombreUsuario = "Usuario",
  periodo = "General",
  nombreDeposito = "General"
) => {
  const doc = new jsPDF();
  const fechaGeneracion = new Date().toLocaleDateString();

  doc.setFontSize(18);
  doc.setTextColor(37, 99, 235);
  doc.text("SISDEPO - Reporte de Gastos", 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generado por: ${nombreUsuario}`, 14, 28);
  doc.text(`Fecha de emisión: ${fechaGeneracion}`, 14, 33);
  doc.text(`Periodo: ${periodo}`, 14, 38);

  doc.setFont("helvetica", "bold");
  doc.text(`Depósito / Sucursal: ${nombreDeposito}`, 14, 44);
  doc.setFont("helvetica", "normal");

  const tableColumn = ["Fecha", "Concepto", "Categoría", "Vehículo", "Monto (Gs)"];
  const tableRows = (gastos || []).map((g) => [
    g.fecha_iso || g.fecha,
    g.titulo + (g.descripcion ? `\n(${g.descripcion})` : ""),
    g.categoria,
    g.vehiculo || "-",
    (Number(g.monto) || 0).toLocaleString("es-PY"),
  ]);

  doc.autoTable({
    startY: 50,
    head: [tableColumn],
    body: tableRows,
    theme: "striped",
    headStyles: { fillColor: [30, 41, 59], fontSize: 10, fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: 3, valign: "middle" },
    columnStyles: { 4: { halign: "right", fontStyle: "bold", cellWidth: 30 } },
  });

  const finalY = (doc.lastAutoTable?.finalY || 50) + 10;
  const total = (gastos || []).reduce((sum, g) => sum + (Number(g.monto) || 0), 0);

  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(22, 163, 74);
  doc.rect(130, finalY - 6, 65, 12, "FD");

  doc.setFontSize(12);
  doc.setTextColor(22, 163, 74);
  doc.setFont("helvetica", "bold");
  doc.text(`TOTAL: Gs. ${total.toLocaleString("es-PY")}`, 135, finalY + 2);

  const nombreArchivo = `Gastos_${String(nombreDeposito).replace(/ /g, "")}_${String(periodo).replace(/ /g, "")}.pdf`;
  doc.save(nombreArchivo);
};