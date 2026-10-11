// pdfkit exporta CJS; el default ESM no es constructor en Jest.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import PDFDocument = require('pdfkit');

export interface PdfFilaGasto {
  fecha_gp: string;
  nombre_insumo_gp: string;
  monto_gp: number;
  nombre_responsable: string;
}

export interface PdfHistorialGastos {
  id_finca: number;
  nombre_finca: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  generado_en: Date;
  gastos: PdfFilaGasto[];
  monto_total_periodo: number;
  imagen_grafico: string;
}

export function slug_nombre_finca(nombre: string): string {
  const slug = nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'finca';
}

export function nombre_archivo_pdf(
  nombre_finca: string,
  generado_en: Date,
): string {
  const fecha = generado_en.toISOString().slice(0, 10);
  return `costos_${slug_nombre_finca(nombre_finca)}_${fecha}.pdf`;
}

function formato_moneda(monto: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(monto);
}

function formato_fecha(fecha_gp: string): string {
  const [y, m, d] = fecha_gp.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function etiqueta_rango(fecha_desde?: string, fecha_hasta?: string): string {
  if (!fecha_desde && !fecha_hasta) {
    return 'Todo el historial';
  }
  const desde = fecha_desde ? formato_fecha(fecha_desde) : '…';
  const hasta = fecha_hasta ? formato_fecha(fecha_hasta) : '…';
  return `${desde} — ${hasta}`;
}

function buffer_desde_data_uri(data_uri: string): Buffer | null {
  const match = /^data:image\/png;base64,(.+)$/i.exec(data_uri.trim());
  if (!match?.[1]) {
    return null;
  }
  return Buffer.from(match[1], 'base64');
}

export function armar_pdf_historial(
  datos: PdfHistorialGastos,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const id_reporte = `GC-${datos.id_finca}-${datos.generado_en.getTime()}`;
    const generado = datos.generado_en.toISOString().replace('T', ' ').slice(0, 19);

    doc.fontSize(20).text('Croply', { continued: false });
    doc.moveDown(0.3);
    doc.fontSize(14).text('Historial de Costos');
    doc.moveDown(0.6);
    doc.fontSize(10);
    doc.text(`Identificador: ${id_reporte}`);
    doc.text(`Fecha de generación: ${generado} UTC`);
    doc.text(`Finca: ${datos.nombre_finca}`);
    doc.text(`Rango: ${etiqueta_rango(datos.fecha_desde, datos.fecha_hasta)}`);
    doc.moveDown();
    doc
      .fontSize(12)
      .text(`Total del período: ${formato_moneda(datos.monto_total_periodo)}`);
    doc.moveDown();

    const imagen = buffer_desde_data_uri(datos.imagen_grafico);
    if (imagen) {
      try {
        doc.image(imagen, { fit: [500, 180], align: 'center' });
        doc.moveDown();
      } catch {
        doc.fontSize(9).text('No se pudo incrustar el gráfico enviado.');
        doc.moveDown();
      }
    }

    doc.fontSize(10).text('Fecha          Insumo                         Precio           Responsable');
    doc.moveDown(0.2);
    doc
      .moveTo(doc.x, doc.y)
      .lineTo(547, doc.y)
      .stroke();
    doc.moveDown(0.3);

    for (const fila of datos.gastos) {
      const linea = [
        formato_fecha(fila.fecha_gp).padEnd(14, ' '),
        fila.nombre_insumo_gp.slice(0, 28).padEnd(30, ' '),
        formato_moneda(fila.monto_gp).padEnd(16, ' '),
        fila.nombre_responsable,
      ].join('');
      doc.fontSize(9).text(linea);
    }

    doc.end();
  });
}
