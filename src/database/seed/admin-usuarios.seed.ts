import { EstadoUsuario } from '../../common/enums';

export interface AdminUsuarioSeed {
  email: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
}

/**
 * Admins Croply del equipo (desarrollo local).
 * Contraseña: SEED_ADMIN_PASSWORD o CroplyAdmin123!
 */
export const ADMIN_USUARIOS_SEED: AdminUsuarioSeed[] = [
  {
    email: 'diego@croply.app',
    nombre: 'Diego',
    apellido: 'Páez',
    telefono: null,
  },
  {
    email: 'rodrigo@croply.app',
    nombre: 'Rodrigo',
    apellido: 'Sanz',
    telefono: null,
  },
  {
    email: 'paula@croply.app',
    nombre: 'Paula',
    apellido: 'Rodríguez',
    telefono: null,
  },
];

export const SEED_ADMIN_DEFAULT_PASSWORD = 'CroplyAdmin123!';
export const SEED_ADMIN_ESTADO = EstadoUsuario.ACTIVO;
