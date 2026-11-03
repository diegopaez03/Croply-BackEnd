// pdfkit exporta CJS; el default ESM no es constructor en Jest.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import PDFDocument = require('pdfkit');

export interface PdfFilaGasto {
  /** Día sin hora, `aaaa-mm-dd`. */
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
    .replace(/[̀-ͯ]/g, '')
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

// ---------------------------------------------------------------------------
// Formateo (funciones puras, exportadas para los tests)
// ---------------------------------------------------------------------------

const FORMATO_MONEDA = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
});

export function formato_moneda(monto: number): string {
  return FORMATO_MONEDA.format(monto);
}

const FORMATO_FECHA_HORA = new Intl.DateTimeFormat('es-AR', {
  timeZone: 'America/Buenos_Aires',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Instante → `dd/mm/aaaa HH:mm` en hora de Argentina. */
export function formatear_fecha_hora_ar(fecha: Date): string {
  // formatToParts evita depender de la puntuación que use cada versión de ICU.
  const partes = Object.fromEntries(
    FORMATO_FECHA_HORA.formatToParts(fecha).map((p) => [p.type, p.value]),
  );
  return `${partes.day}/${partes.month}/${partes.year} ${partes.hour}:${partes.minute}`;
}

/**
 * Día sin hora (`aaaa-mm-dd`) → `dd/mm/aaaa`. Se parte el string a propósito:
 * pasar por `Date` lo interpretaría como medianoche UTC y en Argentina
 * mostraría el día anterior.
 */
export function formato_fecha(fecha_gp: string): string {
  const [y, m, d] = fecha_gp.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function etiqueta_rango(
  fecha_desde?: string,
  fecha_hasta?: string,
): string {
  if (fecha_desde && fecha_hasta) {
    return `${formato_fecha(fecha_desde)} — ${formato_fecha(fecha_hasta)}`;
  }
  if (fecha_desde) {
    return `Desde ${formato_fecha(fecha_desde)}`;
  }
  if (fecha_hasta) {
    return `Hasta ${formato_fecha(fecha_hasta)}`;
  }
  return 'Todo el historial';
}

function buffer_desde_data_uri(data_uri: string): Buffer | null {
  const match = /^data:image\/png;base64,(.+)$/i.exec(data_uri?.trim() ?? '');
  if (!match?.[1]) {
    return null;
  }
  return Buffer.from(match[1], 'base64');
}

// ---------------------------------------------------------------------------
// Diseño (mismo estilo que el PDF de agroquímicos)
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
const ALTO_MAX_GRAFICO = 175;

interface Columna {
  titulo: string;
  ancho: number;
  align?: 'left' | 'right';
  valor: (fila: PdfFilaGasto) => string;
}

/** Suma 515, el ancho útil de A4 (595.28) con márgenes de 40. */
const COLUMNAS: Columna[] = [
  { titulo: 'Fecha', ancho: 80, valor: (f) => formato_fecha(f.fecha_gp) },
  { titulo: 'Insumo', ancho: 185, valor: (f) => f.nombre_insumo_gp },
  {
    titulo: 'Precio',
    ancho: 110,
    align: 'right',
    valor: (f) => formato_moneda(f.monto_gp),
  },
  { titulo: 'Responsable', ancho: 140, valor: (f) => f.nombre_responsable },
];

export function armar_pdf_historial(
  datos: PdfHistorialGastos,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: MARGEN,
      bufferPages: true,
      info: { Title: 'Historial de Costos', Author: 'Croply' },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      const ancho_util = doc.page.width - MARGEN * 2;
      // El contenido nunca baja de acá, así queda lugar para el pie.
      const limite_inferior = () => doc.page.height - MARGEN - ALTO_PIE;
      /** Página nueva si el bloque no entra; devuelve la `y` donde dibujarlo. */
      const reservar = (y: number, alto: number) => {
        if (y + alto <= limite_inferior()) {
          return y;
        }
        doc.addPage();
        return MARGEN;
      };

      let y = dibujar_banda(doc);
      y = dibujar_metadatos(doc, datos, y + 18, ancho_util);

      y = reservar(y + 14, ALTO_RESUMEN);
      y = dibujar_resumen(doc, datos, y, ancho_util);

      const grafico = preparar_grafico(doc, datos.imagen_grafico, ancho_util);
      y = reservar(y + 14, grafico.alto_tarjeta);
      y = dibujar_grafico(doc, grafico, y, ancho_util);

      y = reservar(y + 18, ALTO_ENCABEZADO_TABLA + ALTO_FILA_TOTAL);
      y = dibujar_encabezado_tabla(doc, y, ancho_util);

      datos.gastos.forEach((fila, index) => {
        const alto = alto_fila(doc, fila);
        const es_ultima = index === datos.gastos.length - 1;
        // La última fila viaja junto con el total: el total nunca queda solo.
        const necesario = alto + (es_ultima ? ALTO_FILA_TOTAL : 0);
        const al_tope = y <= MARGEN + ALTO_ENCABEZADO_TABLA;
        if (y + necesario > limite_inferior() && !al_tope) {
          doc.addPage();
          y = dibujar_encabezado_tabla(doc, MARGEN, ancho_util);
        }
        y = dibujar_fila(doc, fila, y, alto, index % 2 === 1, ancho_util);
      });

      if (y + ALTO_FILA_TOTAL > limite_inferior()) {
        // Sólo pasa sin gastos (el servicio no lo permite) o con filas gigantes.
        doc.addPage();
        y = dibujar_encabezado_tabla(doc, MARGEN, ancho_util);
      }
      dibujar_fila_total(doc, datos.monto_total_periodo, y, ancho_util);

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
    .text('Historial de Costos', MARGEN, 26, {
      width: doc.page.width - MARGEN * 2,
      align: 'right',
      lineBreak: false,
    });

  return ALTO_BANDA;
}

/** Dos columnas: datos del reporte a la izquierda, finca y rango a la derecha. */
function dibujar_metadatos(
  doc: PDFKit.PDFDocument,
  datos: PdfHistorialGastos,
  y_inicio: number,
  ancho_util: number,
): number {
  const separacion = 20;
  const ancho_columna = (ancho_util - separacion) / 2;
  const x_derecha = MARGEN + ancho_columna + separacion;

  const izquierda: Array<[string, string]> = [
    ['ID de reporte', `GC-${datos.id_finca}-${datos.generado_en.getTime()}`],
    ['Generado', formatear_fecha_hora_ar(datos.generado_en)],
  ];
  const derecha: Array<[string, string]> = [
    ['Finca', datos.nombre_finca],
    ['Rango', etiqueta_rango(datos.fecha_desde, datos.fecha_hasta)],
  ];

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

const ALTO_RESUMEN = 58;

function dibujar_resumen(
  doc: PDFKit.PDFDocument,
  datos: PdfHistorialGastos,
  y: number,
  ancho_util: number,
): number {
  doc.roundedRect(MARGEN, y, ancho_util, ALTO_RESUMEN, 6).fill(COLOR.resaltado);
  const padding = 14;

  doc
    .font(FUENTE_BOLD)
    .fontSize(8)
    .fillColor(COLOR.primario)
    .text('TOTAL DEL PERÍODO', MARGEN + padding, y + 12, {
      characterSpacing: 0.6,
      lineBreak: false,
    });
  doc
    .font(FUENTE_BOLD)
    .fontSize(18)
    .fillColor(COLOR.texto)
    .text(formato_moneda(datos.monto_total_periodo), MARGEN + padding, y + 25, {
      lineBreak: false,
    });

  // "Cantidad de gastos: N" alineado a la derecha y centrado en el alto.
  const rotulo = 'Cantidad de gastos: ';
  const cantidad = String(datos.gastos.length);
  doc.fontSize(11);
  doc.font(FUENTE_BOLD);
  const ancho_cantidad = doc.widthOfString(cantidad);
  doc.font(FUENTE);
  const ancho_rotulo = doc.widthOfString(rotulo);
  const x_fin = MARGEN + ancho_util - padding;
  const y_texto = y + (ALTO_RESUMEN - 11) / 2;
  doc
    .fillColor(COLOR.primario)
    .text(rotulo, x_fin - ancho_cantidad - ancho_rotulo, y_texto, {
      lineBreak: false,
    });
  doc
    .font(FUENTE_BOLD)
    .text(cantidad, x_fin - ancho_cantidad, y_texto, { lineBreak: false });

  return y + ALTO_RESUMEN;
}

const PADDING_TARJETA = 12;
const ALTO_TITULO_TARJETA = 22;
const ALTO_SIN_GRAFICO = 16;

interface GraficoPreparado {
  imagen: Buffer | null;
  ancho: number;
  alto: number;
  alto_tarjeta: number;
}

/**
 * `openImage` existe en pdfkit (lo usa `image()` internamente) pero
 * `@types/pdfkit` no lo declara. Sólo se usa para leer el tamaño del PNG.
 */
type DocConOpenImage = PDFKit.PDFDocument & {
  openImage(src: Buffer): { width: number; height: number };
};

/**
 * Abre la imagen antes de dibujar para conocer su tamaño final y así saber si
 * la tarjeta entra en la página. Si el data URI no es un PNG válido no se
 * rompe el PDF: la tarjeta muestra "Gráfico no disponible".
 */
function preparar_grafico(
  doc: PDFKit.PDFDocument,
  data_uri: string,
  ancho_util: number,
): GraficoPreparado {
  const ancho_max = ancho_util - PADDING_TARJETA * 2;
  const marco = PADDING_TARJETA * 2 + ALTO_TITULO_TARJETA;

  const sin_grafico: GraficoPreparado = {
    imagen: null,
    ancho: 0,
    alto: 0,
    alto_tarjeta: marco + ALTO_SIN_GRAFICO,
  };

  const buffer = buffer_desde_data_uri(data_uri);
  if (!buffer) {
    return sin_grafico;
  }
  let tamano: { width: number; height: number };
  try {
    tamano = (doc as DocConOpenImage).openImage(buffer);
  } catch {
    return sin_grafico;
  }
  if (!tamano.width || !tamano.height) {
    return sin_grafico;
  }

  // Igual que `fit`: escala respetando la proporción hasta tocar un límite.
  const escala = Math.min(
    ancho_max / tamano.width,
    ALTO_MAX_GRAFICO / tamano.height,
  );
  const ancho = tamano.width * escala;
  const alto = tamano.height * escala;
  return { imagen: buffer, ancho, alto, alto_tarjeta: marco + alto };
}

function dibujar_grafico(
  doc: PDFKit.PDFDocument,
  grafico: GraficoPreparado,
  y: number,
  ancho_util: number,
): number {
  doc
    .roundedRect(MARGEN, y, ancho_util, grafico.alto_tarjeta, 6)
    .lineWidth(0.75)
    .fillAndStroke(COLOR.blanco, COLOR.linea);

  doc
    .font(FUENTE_BOLD)
    .fontSize(11)
    .fillColor(COLOR.texto)
    .text('Evolución de gastos', MARGEN + PADDING_TARJETA, y + PADDING_TARJETA, {
      lineBreak: false,
    });

  const y_contenido = y + PADDING_TARJETA + ALTO_TITULO_TARJETA;
  if (grafico.imagen) {
    const x = MARGEN + (ancho_util - grafico.ancho) / 2;
    doc.image(grafico.imagen, x, y_contenido, {
      width: grafico.ancho,
      height: grafico.alto,
    });
  } else {
    doc
      .font(FUENTE)
      .fontSize(9)
      .fillColor(COLOR.gris)
      .text('Gráfico no disponible', MARGEN + PADDING_TARJETA, y_contenido + 2, {
        lineBreak: false,
      });
  }
  return y + grafico.alto_tarjeta;
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
      align: columna.align ?? 'left',
      lineBreak: false,
    });
    x += columna.ancho;
  }
  return y + ALTO_ENCABEZADO_TABLA;
}

function alto_fila(doc: PDFKit.PDFDocument, fila: PdfFilaGasto): number {
  doc.font(FUENTE).fontSize(TAMANO_CELDA);
  const alto_texto = Math.max(
    ...COLUMNAS.map((columna) =>
      doc.heightOfString(columna.valor(fila) || ' ', {
        width: columna.ancho - PADDING_CELDA_X * 2,
      }),
    ),
  );
  return alto_texto + PADDING_CELDA_Y * 2;
}

function dibujar_fila(
  doc: PDFKit.PDFDocument,
  fila: PdfFilaGasto,
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

  doc.font(FUENTE).fontSize(TAMANO_CELDA).fillColor(COLOR.texto);
  let x = MARGEN;
  for (const columna of COLUMNAS) {
    doc.text(columna.valor(fila), x + PADDING_CELDA_X, y + PADDING_CELDA_Y, {
      width: columna.ancho - PADDING_CELDA_X * 2,
      align: columna.align ?? 'left',
    });
    x += columna.ancho;
  }
  return y + alto;
}

const ALTO_FILA_TOTAL = 26;

function dibujar_fila_total(
  doc: PDFKit.PDFDocument,
  monto: number,
  y: number,
  ancho_util: number,
): number {
  doc.rect(MARGEN, y, ancho_util, ALTO_FILA_TOTAL).fill(COLOR.resaltado);

  const y_texto = y + (ALTO_FILA_TOTAL - 10) / 2;
  doc
    .font(FUENTE_BOLD)
    .fontSize(10)
    .fillColor(COLOR.primario)
    .text('Total del período', MARGEN + PADDING_CELDA_X, y_texto, {
      lineBreak: false,
    });

  // El monto queda alineado con la columna Precio.
  const x_precio = MARGEN + COLUMNAS[0].ancho + COLUMNAS[1].ancho;
  doc
    .fillColor(COLOR.texto)
    .text(formato_moneda(monto), x_precio + PADDING_CELDA_X, y_texto, {
      width: COLUMNAS[2].ancho - PADDING_CELDA_X * 2,
      align: 'right',
      lineBreak: false,
    });
  return y + ALTO_FILA_TOTAL;
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
    doc.text('Croply · Historial de Costos', MARGEN, y_texto, {
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
