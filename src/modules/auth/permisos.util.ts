import {
  CODIGO_ADMIN_CROPLY,
  CODIGO_ADMIN_FINCA,
} from '../../common/enums';
import {
  PERMISOS_FINCA_SEED,
  PERMISOS_SISTEMA_SEED,
} from '../roles/permisos.seed';
import { Usuario } from '../usuarios/entities/usuario.entity';

export function nombres_permiso_usuario(usuario: Usuario | null | undefined): string[] {
  if (!usuario) {
    return [];
  }

  const nombres = new Set<string>();

  if (usuario.rol_sistema?.codigo === CODIGO_ADMIN_CROPLY) {
    for (const permiso of PERMISOS_SISTEMA_SEED) {
      nombres.add(permiso);
    }
  }

  for (const rp of usuario.rol_sistema?.rol_permisos ?? []) {
    if (rp.permiso?.nombre_permiso) {
      nombres.add(rp.permiso.nombre_permiso);
    }
  }

  const now = Date.now();
  for (const uf of usuario.usuario_fincas ?? []) {
    if (uf.fecha_fin_rol != null && uf.fecha_fin_rol.getTime() <= now) {
      continue;
    }
    if (uf.rol_finca?.codigo_rol_finca === CODIGO_ADMIN_FINCA) {
      for (const permiso of PERMISOS_FINCA_SEED) {
        nombres.add(permiso);
      }
    }
    for (const rp of uf.rol_finca?.rol_permisos ?? []) {
      if (rp.permiso?.nombre_permiso) {
        nombres.add(rp.permiso.nombre_permiso);
      }
    }
  }

  return [...nombres];
}

export function usuario_tiene_permiso(
  usuario: Usuario | null | undefined,
  ...permisos: string[]
): boolean {
  if (permisos.length === 0) {
    return true;
  }
  const otorgados = new Set(nombres_permiso_usuario(usuario));
  return permisos.some((permiso) => otorgados.has(permiso));
}
