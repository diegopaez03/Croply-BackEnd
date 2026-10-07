// pdfkit publica `export =`; el default import no existe en runtime CommonJS.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import PDFDocument = require('pdfkit');

export interface FilaPdfAgroquimico {
  fecha: string;
  producto: string;
  dosis: string;
  parcela: string;
}

export interface PdfHistorialAgroquimicos {
  id_reporte: string;
  fecha_generacion: string;
  rango: string;
  nombre_parcela: string | null;
  filas: FilaPdfAgroquimico[];
}

const COLUMNAS = [
  { titulo: 'Fecha', x: 40, ancho: 110 },
  { titulo: 'Producto', x: 155, ancho: 160 },
  { titulo: 'Dosis', x: 320, ancho: 80 },
  { titulo: 'Parcela', x: 405, ancho: 150 },
];

export function armar_pdf_historial(
  datos: PdfHistorialAgroquimicos,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', compress: false });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text('Croply', 40, 40);
    doc.fontSize(10).text(`Reporte: ${datos.id_reporte}`);
    doc.text(`Generado: ${datos.fecha_generacion}`);
    doc.moveDown();
    doc.fontSize(14).text('Historial de Agroquímicos');
    doc.fontSize(10).text(`Rango: ${datos.rango}`);
    if (datos.nombre_parcela) {
      doc.text(`Parcela: ${datos.nombre_parcela}`);
    }
    doc.moveDown();

    const dibujar_encabezado = () => {
      const y = doc.y;
      doc.font('Helvetica-Bold').fontSize(10);
      for (const columna of COLUMNAS) {
        doc.text(columna.titulo, columna.x, y, { width: columna.ancho });
      }
      doc.moveDown(0.4);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.4);
      doc.font('Helvetica').fontSize(9);
    };

    dibujar_encabezado();

    for (const fila of datos.filas) {
      if (doc.y > 760) {
        doc.addPage();
        dibujar_encabezado();
      }
      const y = doc.y;
      const valores = [fila.fecha, fila.producto, fila.dosis, fila.parcela];
      let alto = 12;
      valores.forEach((valor, index) => {
        const columna = COLUMNAS[index];
        alto = Math.max(alto, doc.heightOfString(valor, { width: columna.ancho }));
        doc.text(valor, columna.x, y, { width: columna.ancho });
      });
      doc.y = y + alto + 6;
    }

    doc.end();
  });
}
