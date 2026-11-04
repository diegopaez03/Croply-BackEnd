/**
 * Clave de normalización de `pregunta` (Épica 9, decisiones 5 y 6).
 * Se usa para la unicidad entre preguntas activas y para el orden
 * alfabético del listado de consulta.
 *
 * - recorta espacios de los extremos;
 * - pasa a minúsculas;
 * - quita acentos y diacríticos (la `ñ` se conserva: es una letra, no un acento);
 * - quita signos de puntuación iniciales (`¿`, `¡`, comillas, etc.) y también
 *   los finales, para que `"¿Cómo cargo un gasto?"` y `"Como cargo un gasto"`
 *   den la misma clave (ejemplo de la decisión 6). Los del medio no se tocan.
 */
export function normalizar_pregunta(pregunta: string): string {
  return pregunta
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/ñ/g, 'ñ')
    .replace(/\p{M}/gu, '')
    .replace(/^[\p{P}\s]+|[\p{P}\s]+$/gu, '');
}
