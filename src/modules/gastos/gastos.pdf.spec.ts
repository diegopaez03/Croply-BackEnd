import {
  armar_pdf_historial,
  etiqueta_rango,
  formatear_fecha_hora_ar,
  formato_fecha,
  formato_moneda,
  nombre_archivo_pdf,
  PdfFilaGasto,
  PdfHistorialGastos,
  slug_nombre_finca,
} from './gastos.pdf';

const PNG_1X1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function gasto(index: number, extra: Partial<PdfFilaGasto> = {}): PdfFilaGasto {
  return {
    fecha_gp: '2026-10-01',
    nombre_insumo_gp: `Fertilizante ${index}`,
    monto_gp: 1000 * index + 0.5,
    nombre_responsable: 'Roberto Sánchez',
    ...extra,
  };
}

function datos(
  gastos: PdfFilaGasto[],
  extra: Partial<PdfHistorialGastos> = {},
): PdfHistorialGastos {
  return {
    id_finca: 12,
    nombre_finca: 'Finca La Esperanza',
    fecha_desde: '2026-09-01',
    fecha_hasta: '2026-10-31',
    generado_en: new Date('2026-10-08T14:00:00.000Z'),
    gastos,
    monto_total_periodo: gastos.reduce((total, g) => total + g.monto_gp, 0),
    imagen_grafico: PNG_1X1,
    ...extra,
  };
}

/** Cantidad de páginas según el árbol de páginas del PDF (`/Type /Pages`). */
function paginas(buffer: Buffer): number {
  const match = buffer
    .toString('latin1')
    .match(/\/Type \/Pages\s*\/Count (\d+)/);
  return match ? Number(match[1]) : 0;
}

function es_pdf(buffer: Buffer): boolean {
  return Buffer.isBuffer(buffer) && buffer.subarray(0, 4).toString() === '%PDF';
}

describe('gastos.pdf', () => {
  describe('formateo', () => {
    it('formatea fecha_gp partiendo el string, sin corrimiento de zona horaria', () => {
      expect(formato_fecha('2026-10-01')).toBe('01/10/2026');
      expect(formato_fecha('2026-01-01')).toBe('01/01/2026');
    });

    it('muestra la fecha de generación en hora de Argentina', () => {
      expect(formatear_fecha_hora_ar(new Date('2026-10-08T14:00:00Z'))).toBe(
        '08/10/2026 11:00',
      );
      expect(formatear_fecha_hora_ar(new Date('2026-10-09T00:37:27Z'))).toBe(
        '08/10/2026 21:37',
      );
    });

    it('arma la etiqueta del rango', () => {
      expect(etiqueta_rango('2026-09-01', '2026-10-31')).toBe(
        '01/09/2026 — 31/10/2026',
      );
      expect(etiqueta_rango('2026-09-01')).toBe('Desde 01/09/2026');
      expect(etiqueta_rango(undefined, '2026-10-31')).toBe('Hasta 31/10/2026');
      expect(etiqueta_rango()).toBe('Todo el historial');
    });

    it('formatea montos en pesos argentinos', () => {
      expect(formato_moneda(45000.5)).toMatch(/^\$\s45\.000,50$/);
    });

    it('mantiene el nombre de archivo', () => {
      expect(slug_nombre_finca('Finca La Esperanza')).toBe('finca-la-esperanza');
      expect(slug_nombre_finca('¡¡!!')).toBe('finca');
      expect(
        nombre_archivo_pdf('Finca La Esperanza', new Date('2026-10-08T14:00:00Z')),
      ).toBe('costos_finca-la-esperanza_2026-10-08.pdf');
    });
  });

  describe('armar_pdf_historial', () => {
    it('genera una página con pocos gastos y gráfico válido', async () => {
      const buffer = await armar_pdf_historial(datos([gasto(1), gasto(2)]));

      expect(es_pdf(buffer)).toBe(true);
      expect(paginas(buffer)).toBe(1);
    });

    it('pagina con muchos gastos sin agregar páginas en blanco', async () => {
      const gastos = Array.from({ length: 80 }, (_, i) => gasto(i + 1));

      const buffer = await armar_pdf_historial(datos(gastos));

      expect(es_pdf(buffer)).toBe(true);
      // Página 1 con encabezado y gráfico (~13 filas) + ~30 filas por página.
      expect(paginas(buffer)).toBe(4);
    });

    it('ajusta textos largos en varias líneas', async () => {
      const buffer = await armar_pdf_historial(
        datos([
          gasto(1, {
            nombre_insumo_gp:
              'Fertilizante foliar soluble con micronutrientes quelatados y bioestimulante de algas marinas',
            nombre_responsable:
              'María Fernanda de los Ángeles Rodríguez Sánchez',
            monto_gp: 123456789.99,
          }),
          gasto(2, { nombre_insumo_gp: '', nombre_responsable: '' }),
        ]),
      );

      expect(es_pdf(buffer)).toBe(true);
      expect(paginas(buffer)).toBe(1);
    });

    it.each([
      ['no es data URI', 'no-es-una-imagen'],
      ['PNG corrupto', 'data:image/png;base64,AAAAAAAA'],
      ['data URI vacío', 'data:image/png;base64,'],
      ['vacío', ''],
    ])('no rompe el PDF si la imagen es inválida (%s)', async (_caso, imagen) => {
      const buffer = await armar_pdf_historial(
        datos([gasto(1)], { imagen_grafico: imagen }),
      );

      expect(es_pdf(buffer)).toBe(true);
      expect(paginas(buffer)).toBe(1);
    });

    it('genera el PDF sin rango ni gráfico', async () => {
      const buffer = await armar_pdf_historial(
        datos([gasto(1)], {
          fecha_desde: undefined,
          fecha_hasta: undefined,
          imagen_grafico: 'x',
        }),
      );

      expect(es_pdf(buffer)).toBe(true);
    });
  });
});
