import { AmbitoPermiso } from '../../common/enums';

export const PERMISOS_SISTEMA_SEED = [
  'Gestión de finca y parcelas',
  'Planificación de cultivos',
  'Registro de agroquímicos',
  'Gestión de usuarios y roles',
  'Reportes',
  'Solicitudes de digitalización',
  'Configuración del sistema',
] as const;

export const PERMISOS_FINCA_SEED = [
  'Registro de agroquímicos',
  'Gestión de trabajadores',
  'Tareas de campo',
] as const;

export const PERMISOS_SEED: Array<{
  nombre_permiso: string;
  ambito: AmbitoPermiso;
}> = [
  ...PERMISOS_SISTEMA_SEED.map((nombre_permiso) => ({
    nombre_permiso,
    ambito: AmbitoPermiso.SISTEMA,
  })),
  ...PERMISOS_FINCA_SEED.map((nombre_permiso) => ({
    nombre_permiso,
    ambito: AmbitoPermiso.FINCA,
  })),
];
