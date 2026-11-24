import {
  armar_pdf_historial,
  FilaPdfAgroquimico,
  formatear_dia,
  formatear_fecha_hora_ar,
  PdfHistorialAgroquimicos,
  texto_rango,
} from './agroquimicos.pdf';

function fila(index: number, extra: Partial<FilaPdfAgroquimico> = {}) {
  return {
    fecha: '08/10/2026 11:00',
    producto: `Fungicida ${index}`,
    dosis: '2 L/ha',
    parcela: 'Parcela Norte',
    nombre_responsable: 'Roberto Sánchez',
    ...extra,
  };
}

function datos(filas: FilaPdfAgroquimico[]): PdfHistorialAgroquimicos {
  return {
    id_reporte: 'AQ-12-1791463200000',
    fecha_generacion: new Date('2026-10-08T14:00:00.000Z'),
    nombre_finca: 'Finca Demo Croply',
    rango: '01/09/2026 — 31/10/2026',
    nombre_parcela: null,
    filas,
  };
}

/** Cantidad de páginas según el árbol de páginas del PDF (`/Type /Pages`). */
function paginas(buffer: Buffer): number {
  const match = buffer
    .toString('latin1')
    .match(/\/Type \/Pages\s*\/Count (\d+)/);
  return match ? Number(match[1]) : 0;
}

describe('agroquimicos.pdf', () => {
  describe('formateo', () => {
    it('muestra fecha y hora en zona horaria de Argentina', () => {
      expect(formatear_fecha_hora_ar(new Date('2026-10-08T14:00:00Z'))).toBe(
        '08/10/2026 11:00',
      );
    });

    it('cambia de día cuando la hora UTC cae antes de las 03:00', () => {
      expect(formatear_fecha_hora_ar('2026-10-09T02:15:00Z')).toBe(
        '08/10/2026 23:15',
      );
    });

    it('usa 00 para la medianoche, no 24', () => {
      expect(formatear_fecha_hora_ar('2026-10-09T03:00:00Z')).toBe(
        '09/10/2026 00:00',
      );
    });

    it('devuelve vacío si no hay fecha o es inválida', () => {
      expect(formatear_fecha_hora_ar(null)).toBe('');
      expect(formatear_fecha_hora_ar(undefined)).toBe('');
      expect(formatear_fecha_hora_ar('no-es-fecha')).toBe('');
    });

    it('formatea días de calendario sin convertir zona horaria', () => {
      expect(formatear_dia('2026-09-01')).toBe('01/09/2026');
      expect(formatear_dia('2026-09-01T00:00:00.000Z')).toBe('01/09/2026');
      expect(formatear_dia(undefined)).toBeNull();
    });

    it('arma el texto del rango', () => {
      expect(texto_rango('2026-09-01', '2026-10-31')).toBe(
        '01/09/2026 — 31/10/2026',
      );
      expect(texto_rango('2026-09-01')).toBe('Desde 01/09/2026');
      expect(texto_rango(undefined, '2026-10-31')).toBe('Hasta 31/10/2026');
      expect(texto_rango()).toBe('Todas las fechas');
    });
  });

  describe('armar_pdf_historial', () => {
    it('genera un PDF de una página con pocas filas', async () => {
      const buffer = await armar_pdf_historial(datos([fila(1), fila(2)]));

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.subarray(0, 4).toString('latin1')).toBe('%PDF');
      expect(paginas(buffer)).toBe(1);
    });

    it('pagina con muchas filas sin agregar páginas en blanco', async () => {
      const filas = Array.from({ length: 80 }, (_, i) => fila(i + 1));

      const buffer = await armar_pdf_historial(datos(filas));

      expect(buffer.subarray(0, 4).toString('latin1')).toBe('%PDF');
      // ~30 filas de una línea por página: 80 filas entran en 3 páginas.
      expect(paginas(buffer)).toBe(3);
    });

    it('soporta responsable null, textos largos y filtro de parcela', async () => {
      const largo =
        'Fungicida sistémico de amplio espectro con formulación concentrada emulsionable';
      const filas = [
        fila(1, { nombre_responsable: null }),
        fila(2, {
          producto: largo,
          dosis: '2,5 L/ha diluido en 200 L de agua',
          parcela: 'Parcela Norte — Sector de riego por goteo número 3',
          nombre_responsable: 'María Fernanda de los Ángeles Rodríguez Sánchez',
        }),
        fila(3, { producto: '', dosis: '', parcela: '' }),
      ];

      const buffer = await armar_pdf_historial({
        ...datos(filas),
        nombre_parcela: 'Parcela Norte — Sector de riego por goteo número 3',
      });

      expect(buffer.subarray(0, 4).toString('latin1')).toBe('%PDF');
      expect(paginas(buffer)).toBe(1);
    });
  });
});
