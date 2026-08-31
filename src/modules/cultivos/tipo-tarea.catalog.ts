/**
 * Catálogo mock de TipoTarea (Épica 4).
 *
 * El ABM real de TipoTarea y la entidad Tarea se implementan en la Épica 5.
 * Hasta entonces TareaPlantilla guarda `id_tipo_tarea` contra este catálogo
 * y resuelve `nombre_tipo_tarea` en las respuestas.
 */
export const ID_TIPO_TAREA_APLICACION_AGROQUIMICO = 5;

export const TIPO_TAREA_CATALOG: ReadonlyArray<{
  id_tipo_tarea: number;
  nombre_tipo_tarea: string;
}> = [
  { id_tipo_tarea: 1, nombre_tipo_tarea: 'Preparación del terreno' },
  { id_tipo_tarea: 2, nombre_tipo_tarea: 'Siembra' },
  { id_tipo_tarea: 3, nombre_tipo_tarea: 'Riego' },
  { id_tipo_tarea: 4, nombre_tipo_tarea: 'Fertilización' },
  {
    id_tipo_tarea: ID_TIPO_TAREA_APLICACION_AGROQUIMICO,
    nombre_tipo_tarea: 'Aplicación de agroquímico',
  },
  { id_tipo_tarea: 6, nombre_tipo_tarea: 'Control de malezas' },
  { id_tipo_tarea: 7, nombre_tipo_tarea: 'Cosecha' },
];

export function find_tipo_tarea(
  id_tipo_tarea: number,
): (typeof TIPO_TAREA_CATALOG)[number] | undefined {
  return TIPO_TAREA_CATALOG.find((t) => t.id_tipo_tarea === id_tipo_tarea);
}

export function es_aplicacion_agroquimico(id_tipo_tarea: number): boolean {
  return id_tipo_tarea === ID_TIPO_TAREA_APLICACION_AGROQUIMICO;
}
