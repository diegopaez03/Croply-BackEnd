export const PERMISO_SISTEMA = {
  GESTION_USUARIOS: 'Gestión de usuarios',
  FINCAS_INFRAESTRUCTURA: 'Fincas e Infraestructura',
  CATALOGOS_BASE: 'Catálogos Base',
  SOLICITUDES_DIGITALIZACION: 'Solicitudes de digitalización',
} as const;

export const PERMISO_FINCA = {
  REGISTRO_AGROQUIMICOS: 'Registro de agroquímicos',
  REPORTES: 'Reportes',
  GESTION_TRABAJADORES: 'Gestión de trabajadores',
  TAREAS_CAMPO: 'Tareas de campo',
} as const;

export type NombrePermisoSistema =
  (typeof PERMISO_SISTEMA)[keyof typeof PERMISO_SISTEMA];
export type NombrePermisoFinca =
  (typeof PERMISO_FINCA)[keyof typeof PERMISO_FINCA];
