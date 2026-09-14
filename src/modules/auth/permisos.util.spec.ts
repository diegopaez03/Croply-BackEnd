import { CODIGO_ADMIN_CROPLY, CODIGO_ADMIN_FINCA } from '../../common/enums';
import { PERMISO_FINCA, PERMISO_SISTEMA } from '../../common/enums/permisos';
import { nombres_permiso_usuario, usuario_tiene_permiso } from './permisos.util';

describe('permisos.util', () => {
  it('otorga todos los permisos de sistema a ADMIN_CROPLY', () => {
    const nombres = nombres_permiso_usuario({
      rol_sistema: { codigo: CODIGO_ADMIN_CROPLY, rol_permisos: [] },
      usuario_fincas: [],
    } as never);

    expect(nombres).toEqual(
      expect.arrayContaining([
        PERMISO_SISTEMA.GESTION_USUARIOS,
        PERMISO_SISTEMA.CATALOGOS_BASE,
      ]),
    );
  });

  it('usa solo los permisos asignados a un rol de sistema custom', () => {
    const usuario = {
      rol_sistema: {
        codigo: 'SOPORTE',
        rol_permisos: [
          {
            permiso: { nombre_permiso: PERMISO_SISTEMA.GESTION_USUARIOS },
          },
        ],
      },
      usuario_fincas: [],
    } as never;

    expect(usuario_tiene_permiso(usuario, PERMISO_SISTEMA.GESTION_USUARIOS)).toBe(
      true,
    );
    expect(usuario_tiene_permiso(usuario, PERMISO_SISTEMA.CATALOGOS_BASE)).toBe(
      false,
    );
  });

  it('otorga todos los permisos de finca a ADMIN_FINCA vigente', () => {
    const usuario = {
      rol_sistema: null,
      usuario_fincas: [
        {
          fecha_fin_rol: null,
          rol_finca: { codigo_rol_finca: CODIGO_ADMIN_FINCA, rol_permisos: [] },
        },
      ],
    } as never;

    expect(
      usuario_tiene_permiso(usuario, PERMISO_FINCA.GESTION_TRABAJADORES),
    ).toBe(true);
    expect(usuario_tiene_permiso(usuario, PERMISO_FINCA.TAREAS_CAMPO)).toBe(
      true,
    );
  });
});
