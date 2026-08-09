import { EstadoUsuario } from '../../common/enums';

export interface FincaDemoUsuarioSeed {
  email: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  /** `null` = Administrador de Finca (rol plantilla ADMIN_FINCA). */
  nombre_rol: string | null;
}

/**
 * Fincas de desarrollo local. Dos fincas para poder probar el selector
 * multi-finca: el Admin de Finca demo está vinculado a ambas.
 */
export const FINCAS_DEMO_SEED = [
  {
    nombre_finca: 'Finca Demo Croply',
    ubicacion_finca: 'Córdoba, Argentina',
    superficie_finca: 150.5,
    descripcion_finca: 'Finca de ejemplo para pruebas de integración',
  },
  {
    nombre_finca: 'Finca Demo Sur',
    ubicacion_finca: 'Mendoza, Argentina',
    superficie_finca: 80,
    descripcion_finca: 'Segunda finca del mismo administrador (multi-finca)',
  },
] as const;

/** Roles propios de cada finca demo, además del rol plantilla ADMIN_FINCA. */
export const ROLES_FINCA_DEMO_SEED = [
  { nombre_rol: 'Encargado', descripcion: 'Responsable de turno' },
  { nombre_rol: 'Operario', descripcion: 'Trabajador de campo' },
] as const;

export const ADMIN_FINCA_DEMO_SEED: FincaDemoUsuarioSeed = {
  email: 'admin.finca@croply.app',
  nombre: 'Marta',
  apellido: 'Giménez',
  telefono: '+5493512345678',
  nombre_rol: null,
};

/** Empleados de la primera finca demo. */
export const EMPLEADOS_FINCA_DEMO_SEED: FincaDemoUsuarioSeed[] = [
  {
    email: 'encargado.finca@croply.app',
    nombre: 'Carlos',
    apellido: 'Mendoza',
    telefono: '+5493514445566',
    nombre_rol: 'Encargado',
  },
  {
    email: 'operario.finca@croply.app',
    nombre: 'Lucía',
    apellido: 'Ferrer',
    telefono: null,
    nombre_rol: 'Operario',
  },
];

export const SEED_FINCA_DEMO_ESTADO = EstadoUsuario.ACTIVO;
