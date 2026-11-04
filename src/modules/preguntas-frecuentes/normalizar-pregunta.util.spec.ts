import { normalizar_pregunta } from './normalizar-pregunta.util';

describe('normalizar_pregunta', () => {
  it('recorta espacios, pasa a minúsculas y quita acentos', () => {
    expect(normalizar_pregunta('  Cómo CARGO un Gasto  ')).toBe(
      'como cargo un gasto',
    );
  });

  it('quita signos de puntuación iniciales y finales', () => {
    expect(normalizar_pregunta('¿Cómo cargo un gasto?')).toBe(
      'como cargo un gasto',
    );
    expect(normalizar_pregunta('¡Atención!')).toBe('atencion');
    expect(normalizar_pregunta('"Qué es Croply"')).toBe('que es croply');
    expect(normalizar_pregunta('«Qué es» Croply')).toBe('que es» croply');
    expect(normalizar_pregunta('¿ Cómo empiezo ?')).toBe('como empiezo');
  });

  it('no toca los signos del medio', () => {
    expect(normalizar_pregunta('¿Qué es un plan, y cómo se usa?')).toBe(
      'que es un plan, y como se usa',
    );
  });

  it('da la misma clave a "¿Cómo cargo un gasto?" y "Como cargo un gasto"', () => {
    expect(normalizar_pregunta('¿Cómo cargo un gasto?')).toBe(
      normalizar_pregunta('Como cargo un gasto'),
    );
  });

  it('quita diéresis pero conserva la ñ', () => {
    expect(normalizar_pregunta('Pingüino')).toBe('pinguino');
    expect(normalizar_pregunta('¿Cómo cambio el AÑO?')).toBe(
      'como cambio el año',
    );
  });
});
