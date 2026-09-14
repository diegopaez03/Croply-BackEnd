import { AmbitoPermiso } from '../../common/enums';
import { PERMISO_FINCA, PERMISO_SISTEMA } from '../../common/enums/permisos';

export const PERMISOS_SISTEMA_SEED = [
  PERMISO_SISTEMA.GESTION_USUARIOS,
  PERMISO_SISTEMA.FINCAS_INFRAESTRUCTURA,
  PERMISO_SISTEMA.CATALOGOS_BASE,
  PERMISO_SISTEMA.SOLICITUDES_DIGITALIZACION,
] as const;

export const PERMISOS_FINCA_SEED = [
  PERMISO_FINCA.REGISTRO_AGROQUIMICOS,
  PERMISO_FINCA.REPORTES,
  PERMISO_FINCA.GESTION_TRABAJADORES,
  PERMISO_FINCA.TAREAS_CAMPO,
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
