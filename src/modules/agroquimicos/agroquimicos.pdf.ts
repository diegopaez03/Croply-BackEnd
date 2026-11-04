// pdfkit publica `export =`; el default import no existe en runtime CommonJS.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import PDFDocument = require('pdfkit');

export interface FilaPdfAgroquimico {
  /** Ya formateada para mostrar (ver `formatear_fecha_hora_ar`). */
  fecha: string;
  producto: string;
  dosis: string;
  parcela: string;
  nombre_responsable: string | null;
}

export interface PdfHistorialAgroquimicos {
  id_reporte: string;
  fecha_generacion: Date;
  nombre_finca: string;
  /** Ya formateado para mostrar (ver `texto_rango`). */
  rango: string;
  nombre_parcela: string | null;
  filas: FilaPdfAgroquimico[];
}

// ---------------------------------------------------------------------------
// Formateo (funciones puras, exportadas para el servicio y los tests)
// ---------------------------------------------------------------------------

const ZONA_HORARIA = 'America/Buenos_Aires';

const FORMATO_FECHA_HORA = new Intl.DateTimeFormat('es-AR', {
  timeZone: ZONA_HORARIA,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** `dd/mm/aaaa HH:mm` en hora de Argentina. `''` si no hay fecha válida. */
export function formatear_fecha_hora_ar(
  value: Date | string | null | undefined,
): string {
  if (value == null) {
    return '';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  // formatToParts evita depender de la puntuación que use cada versión de ICU.
  const partes = Object.fromEntries(
    FORMATO_FECHA_HORA.formatToParts(date).map((p) => [p.type, p.value]),
  );
  return `${partes.day}/${partes.month}/${partes.year} ${partes.hour}:${partes.minute}`;
}

/**
 * `aaaa-mm-dd` (o ISO) → `dd/mm/aaaa`. Es una fecha de calendario elegida en el
 * filtro, no un instante: no se convierte de zona horaria.
 */
export function formatear_dia(value: string | undefined): string | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : null;
}

export function texto_rango(fecha_desde?: string, fecha_hasta?: string): string {
  const desde = formatear_dia(fecha_desde);
  const hasta = formatear_dia(fecha_hasta);
  if (desde && hasta) {
    return `${desde} — ${hasta}`;
  }
  if (desde) {
    return `Desde ${desde}`;
  }
  if (hasta) {
    return `Hasta ${hasta}`;
  }
  return 'Todas las fechas';
}

// ---------------------------------------------------------------------------
// Diseño
// ---------------------------------------------------------------------------

const COLOR = {
  primario: '#076B45',
  crema: '#F5F2EC',
  texto: '#1F2937',
  gris: '#6B7280',
  linea: '#E5E7EB',
  resaltado: '#E6F0EB',
  blanco: '#FFFFFF',
};

const FUENTE = 'Helvetica';
const FUENTE_BOLD = 'Helvetica-Bold';

const MARGEN = 40;
const ALTO_BANDA = 64;
const ALTO_PIE = 28;
const PADDING_CELDA_X = 6;
const PADDING_CELDA_Y = 6;
const TAMANO_CELDA = 9;
const ALTO_ENCABEZADO_TABLA = 22;
const SIN_RESPONSABLE = '---';

interface Columna {
  titulo: string;
  ancho: number;
  negrita?: boolean;
  valor: (fila: FilaPdfAgroquimico) => string;
}

/** Suma 515, el ancho útil de A4 (595.28) con márgenes de 40. */
const COLUMNAS: Columna[] = [
  { titulo: 'Fecha', ancho: 88, valor: (f) => f.fecha },
  { titulo: 'Producto', ancho: 132, negrita: true, valor: (f) => f.producto },
  { titulo: 'Dosis', ancho: 75, valor: (f) => f.dosis },
  { titulo: 'Parcela', ancho: 100, valor: (f) => f.parcela },
  {
    titulo: 'Responsable',
    ancho: 120,
    valor: (f) => f.nombre_responsable?.trim() || SIN_RESPONSABLE,
  },
];

export function armar_pdf_historial(
  datos: PdfHistorialAgroquimicos,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: MARGEN,
      size: 'A4',
      bufferPages: true,
      info: { Title: 'Historial de Agroquímicos', Author: 'Croply' },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      const ancho_util = doc.page.width - MARGEN * 2;
      // Las filas nunca bajan de acá, así queda lugar para el pie.
      const limite_inferior = () => doc.page.height - MARGEN - ALTO_PIE;

      let y = dibujar_banda(doc);
      y = dibujar_metadatos(doc, datos, y + 18, ancho_util);
      y = dibujar_resumen(doc, datos.filas.length, y + 14, ancho_util);
      y = dibujar_encabezado_tabla(doc, y + 18, ancho_util);

      datos.filas.forEach((fila, index) => {
        const alto = alto_fila(doc, fila);
        const al_tope = y <= MARGEN + ALTO_ENCABEZADO_TABLA;
        if (y + alto > limite_inferior() && !al_tope) {
          doc.addPage();
          y = dibujar_encabezado_tabla(doc, MARGEN, ancho_util);
        }
        y = dibujar_fila(doc, fila, y, alto, index % 2 === 1, ancho_util);
      });

      dibujar_pies(doc, ancho_util);
      doc.end();
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

function dibujar_banda(doc: PDFKit.PDFDocument): number {
  doc.rect(0, 0, doc.page.width, ALTO_BANDA).fill(COLOR.primario);

  doc
    .fillColor(COLOR.blanco)
    .font(FUENTE_BOLD)
    .fontSize(22)
    .text('Croply', MARGEN, 21, { lineBreak: false });

  doc
    .font(FUENTE)
    .fontSize(14)
    .text('Historial de Agroquímicos', MARGEN, 26, {
      width: doc.page.width - MARGEN * 2,
      align: 'right',
      lineBreak: false,
    });

  return ALTO_BANDA;
}

/** Dos columnas: datos del reporte a la izquierda, filtros a la derecha. */
function dibujar_metadatos(
  doc: PDFKit.PDFDocument,
  datos: PdfHistorialAgroquimicos,
  y_inicio: number,
  ancho_util: number,
): number {
  const separacion = 20;
  const ancho_columna = (ancho_util - separacion) / 2;
  const x_derecha = MARGEN + ancho_columna + separacion;

  const izquierda: Array<[string, string]> = [
    ['ID de reporte', datos.id_reporte],
    ['Generado', formatear_fecha_hora_ar(datos.fecha_generacion)],
  ];
  const derecha: Array<[string, string]> = [
    ['Finca', datos.nombre_finca],
    ['Rango', datos.rango],
  ];
  if (datos.nombre_parcela) {
    derecha.push(['Parcela', datos.nombre_parcela]);
  }

  const y_izquierda = dibujar_pares(doc, izquierda, MARGEN, y_inicio, ancho_columna);
  const y_derecha = dibujar_pares(doc, derecha, x_derecha, y_inicio, ancho_columna);
  return Math.max(y_izquierda, y_derecha);
}

/** Cada par como "Etiqueta: valor", con el valor ajustando en varias líneas. */
function dibujar_pares(
  doc: PDFKit.PDFDocument,
  pares: Array<[string, string]>,
  x: number,
  y_inicio: number,
  ancho: number,
): number {
  let y = y_inicio;
  doc.fontSize(10);
  for (const [etiqueta, valor] of pares) {
    const rotulo = `${etiqueta}: `;
    doc.font(FUENTE_BOLD);
    const ancho_rotulo = doc.widthOfString(rotulo);
    doc.fillColor(COLOR.gris).text(rotulo, x, y, { lineBreak: false });

    doc.font(FUENTE).fillColor(COLOR.texto);
    const ancho_valor = ancho - ancho_rotulo;
    const alto = doc.heightOfString(valor, { width: ancho_valor });
    doc.text(valor, x + ancho_rotulo, y, { width: ancho_valor });
    y += Math.max(alto, 12) + 4;
  }
  return y;
}

function dibujar_resumen(
  doc: PDFKit.PDFDocument,
  cantidad: number,
  y: number,
  ancho_util: number,
): number {
  const alto = 34;
  doc.roundedRect(MARGEN, y, ancho_util, alto, 6).fill(COLOR.resaltado);

  const rotulo = 'Aplicaciones registradas: ';
  doc.font(FUENTE).fontSize(11);
  const ancho_rotulo = doc.widthOfString(rotulo);
  const y_texto = y + (alto - 11) / 2;
  doc
    .fillColor(COLOR.primario)
    .text(rotulo, MARGEN + 14, y_texto, { lineBreak: false });
  doc
    .font(FUENTE_BOLD)
    .text(String(cantidad), MARGEN + 14 + ancho_rotulo, y_texto, {
      lineBreak: false,
    });

  return y + alto;
}

function dibujar_encabezado_tabla(
  doc: PDFKit.PDFDocument,
  y: number,
  ancho_util: number,
): number {
  doc.rect(MARGEN, y, ancho_util, ALTO_ENCABEZADO_TABLA).fill(COLOR.primario);
  doc.font(FUENTE_BOLD).fontSize(TAMANO_CELDA).fillColor(COLOR.blanco);

  let x = MARGEN;
  const y_texto = y + (ALTO_ENCABEZADO_TABLA - TAMANO_CELDA) / 2;
  for (const columna of COLUMNAS) {
    doc.text(columna.titulo, x + PADDING_CELDA_X, y_texto, {
      width: columna.ancho - PADDING_CELDA_X * 2,
      lineBreak: false,
    });
    x += columna.ancho;
  }
  return y + ALTO_ENCABEZADO_TABLA;
}

function alto_fila(doc: PDFKit.PDFDocument, fila: FilaPdfAgroquimico): number {
  doc.fontSize(TAMANO_CELDA);
  const alto_texto = Math.max(
    ...COLUMNAS.map((columna) => {
      doc.font(columna.negrita ? FUENTE_BOLD : FUENTE);
      return doc.heightOfString(columna.valor(fila) || ' ', {
        width: columna.ancho - PADDING_CELDA_X * 2,
      });
    }),
  );
  return alto_texto + PADDING_CELDA_Y * 2;
}

function dibujar_fila(
  doc: PDFKit.PDFDocument,
  fila: FilaPdfAgroquimico,
  y: number,
  alto: number,
  alterna: boolean,
  ancho_util: number,
): number {
  doc
    .rect(MARGEN, y, ancho_util, alto)
    .fill(alterna ? COLOR.crema : COLOR.blanco);
  doc
    .moveTo(MARGEN, y + alto)
    .lineTo(MARGEN + ancho_util, y + alto)
    .lineWidth(0.5)
    .strokeColor(COLOR.linea)
    .stroke();

  doc.fontSize(TAMANO_CELDA);
  let x = MARGEN;
  for (const columna of COLUMNAS) {
    const valor = columna.valor(fila);
    const sin_dato = valor === SIN_RESPONSABLE;
    doc
      .font(columna.negrita ? FUENTE_BOLD : FUENTE)
      .fillColor(sin_dato ? COLOR.gris : COLOR.texto)
      .text(valor, x + PADDING_CELDA_X, y + PADDING_CELDA_Y, {
        width: columna.ancho - PADDING_CELDA_X * 2,
      });
    x += columna.ancho;
  }
  return y + alto;
}

/**
 * Pie en todas las páginas. Se escribe al final (bufferPages) con coordenadas
 * absolutas, `lineBreak: false` y sin margen inferior, para que pdfkit no
 * agregue páginas en blanco al escribir por debajo del área de contenido.
 */
function dibujar_pies(doc: PDFKit.PDFDocument, ancho_util: number): void {
  const { start, count } = doc.bufferedPageRange();
  for (let i = start; i < start + count; i++) {
    doc.switchToPage(i);
    const margen_inferior = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    const y_linea = doc.page.height - MARGEN - ALTO_PIE + 10;
    doc
      .moveTo(MARGEN, y_linea)
      .lineTo(MARGEN + ancho_util, y_linea)
      .lineWidth(0.5)
      .strokeColor(COLOR.linea)
      .stroke();

    const y_texto = y_linea + 8;
    doc.font(FUENTE).fontSize(8).fillColor(COLOR.gris);
    doc.text('Croply · Historial de Agroquímicos', MARGEN, y_texto, {
      lineBreak: false,
    });
    doc.text(`Página ${i - start + 1} de ${count}`, MARGEN, y_texto, {
      width: ancho_util,
      align: 'right',
      lineBreak: false,
    });

    doc.page.margins.bottom = margen_inferior;
  }
}
