const ETAPAS_DIAS: Record<string, number[]> = {
  tomate: [18, 27, 33, 12],
  ajo: [25, 50, 68, 22],
  lechuga: [12, 18, 22, 8],
  cebolla: [38, 70, 118, 34],
  pimiento: [18, 27, 33, 12],
  papa: [22, 28, 48, 22],
};

export function cultivo_soportado(cultivo: string): boolean {
  return Boolean(ETAPAS_DIAS[cultivo.trim().toLowerCase()]);
}

export function dias_ciclo(cultivo: string): number | null {
  const etapas = ETAPAS_DIAS[cultivo.trim().toLowerCase()];
  if (!etapas) {
    return null;
  }
  return etapas.reduce((total, dias) => total + dias, 0);
}

export function fecha_iso(fecha: string | Date): string {
  if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}/.test(fecha)) {
    return fecha.slice(0, 10);
  }
  const date = fecha instanceof Date ? fecha : new Date(fecha);
  return date.toISOString().slice(0, 10);
}

export function fecha_estimada_cosecha(
  fecha_inicio: string | Date,
  cultivo: string,
): string | null {
  const dias = dias_ciclo(cultivo);
  if (dias == null) {
    return null;
  }
  const inicio = Date.parse(`${fecha_iso(fecha_inicio)}T00:00:00Z`);
  if (Number.isNaN(inicio)) {
    return null;
  }
  return new Date(inicio + dias * 86_400_000).toISOString().slice(0, 10);
}

export function etapa_fenologica_idx(
  cultivo: string,
  dias_desde_siembra: number,
): number | null {
  const etapas = ETAPAS_DIAS[cultivo.toLowerCase()];
  if (!etapas) {
    return null;
  }
  let acumulado = 0;
  for (let indice = 0; indice < etapas.length; indice += 1) {
    acumulado += etapas[indice];
    if (dias_desde_siembra <= acumulado) {
      return indice;
    }
  }
  return 3;
}

export function dias_desde_fecha(
  fecha_inicio: string | Date,
  ahora = new Date(),
): number {
  const iso =
    fecha_inicio instanceof Date
      ? fecha_inicio.toISOString().slice(0, 10)
      : String(fecha_inicio).slice(0, 10);
  const inicio = Date.parse(`${iso}T00:00:00Z`);
  const hoy = Date.UTC(
    ahora.getUTCFullYear(),
    ahora.getUTCMonth(),
    ahora.getUTCDate(),
  );
  return Math.max(1, Math.floor((hoy - inicio) / 86_400_000));
}
