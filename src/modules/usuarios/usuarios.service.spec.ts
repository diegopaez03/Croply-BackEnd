import { HttpStatus } from '@nestjs/common';
import { EstadoInvitacion, EstadoUsuario } from '../../common/enums';
import { UsuariosService } from './usuarios.service';

/**
 * Query builder encadenable. `getMany` respeta skip/take sobre `rows` para
 * poder simular la paginación.
 */
function build_qb(rows: unknown[]) {
  const qb: Record<string, jest.Mock> = {};
  const chain = () => qb;
  for (const method of [
    'leftJoin',
    'innerJoin',
    'leftJoinAndSelect',
    'innerJoinAndSelect',
    'select',
    'where',
    'andWhere',
    'orderBy',
    'addOrderBy',
  ]) {
    qb[method] = jest.fn(chain);
  }
  let skip = 0;
  let take: number | undefined;
  qb.skip = jest.fn((n: number) => {
    skip = n;
    return qb;
  });
  qb.take = jest.fn((n: number) => {
    take = n;
    return qb;
  });
  qb.getCount = jest.fn().mockResolvedValue(rows.length);
  qb.getMany = jest.fn(async () =>
    rows.slice(skip, take === undefined ? undefined : skip + take),
  );
  qb.getRawMany = jest.fn().mockResolvedValue([]);
  return qb;
}

describe('UsuariosService', () => {
  let service: UsuariosService;
  let usuario_repo: Record<string, jest.Mock>;
  let usuario_finca_repo: Record<string, jest.Mock>;
  let invitacion_repo: Record<string, jest.Mock>;
  let roles_service: { find_rol_sistema_by_id: jest.Mock };
  let fincas_service: {
    cancelar_invitaciones_pendientes_por_email: jest.Mock;
  };
  let log_service: { registrar: jest.Mock };

  beforeEach(() => {
    usuario_repo = {
      findOne: jest.fn(),
      save: jest.fn(async (x) => x),
      create: jest.fn((x) => x),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    usuario_finca_repo = { createQueryBuilder: jest.fn() };
    invitacion_repo = { createQueryBuilder: jest.fn(() => build_qb([])) };
    roles_service = { find_rol_sistema_by_id: jest.fn() };
    fincas_service = {
      cancelar_invitaciones_pendientes_por_email: jest
        .fn()
        .mockResolvedValue(true),
    };
    log_service = { registrar: jest.fn().mockResolvedValue(undefined) };

    service = new UsuariosService(
      usuario_repo as never,
      usuario_finca_repo as never,
      roles_service as never,
      fincas_service as never,
      log_service as never,
      invitacion_repo as never,
    );
  });

  it('invalida sesión al pasar de Activo a Inactivo', async () => {
    const usuario = {
      id_usuario: 46,
      email: 'c@agro.com',
      estado: EstadoUsuario.ACTIVO,
      token_version: 0,
      fecha_baja: null,
      usuario_fincas: [],
    };
    usuario_repo.findOne.mockResolvedValue(usuario);

    const actor = {
      rol_sistema: { codigo: 'ADMIN_CROPLY' },
      usuario_fincas: [],
    };

    const result = await service.actualizar_estado(
      46,
      { estado: EstadoUsuario.INACTIVO },
      actor as never,
    );

    expect(result.estado).toBe(EstadoUsuario.INACTIVO);
    expect(usuario.token_version).toBe(1);
    expect(usuario.fecha_baja).toBeInstanceOf(Date);
    expect(result.message).toBe('Estado de cuenta actualizado correctamente.');
  });

  it('limpia fecha_baja al reactivar un usuario inactivo', async () => {
    const usuario = {
      id_usuario: 46,
      email: 'c@agro.com',
      estado: EstadoUsuario.INACTIVO,
      token_version: 1,
      fecha_baja: new Date('2026-09-10T12:00:00Z'),
      usuario_fincas: [],
    };
    usuario_repo.findOne.mockResolvedValue(usuario);

    const result = await service.actualizar_estado(
      46,
      { estado: EstadoUsuario.ACTIVO },
      { rol_sistema: { codigo: 'ADMIN_CROPLY' }, usuario_fincas: [] } as never,
    );

    expect(result.estado).toBe(EstadoUsuario.ACTIVO);
    expect(usuario.fecha_baja).toBeNull();
  });

  it('cancela invitación al pasar de Pendiente a Inactivo', async () => {
    const usuario = {
      id_usuario: 46,
      email: 'c@agro.com',
      estado: EstadoUsuario.PENDIENTE,
      token_version: 0,
      fecha_baja: null,
      usuario_fincas: [],
    };
    usuario_repo.findOne.mockResolvedValue(usuario);

    const result = await service.actualizar_estado(
      46,
      { estado: EstadoUsuario.INACTIVO },
      { rol_sistema: { codigo: 'ADMIN_CROPLY' }, usuario_fincas: [] } as never,
    );

    expect(result.message).toContain('invitación pendiente fue cancelada');
    expect(usuario.fecha_baja).toBeInstanceOf(Date);
    expect(
      fincas_service.cancelar_invitaciones_pendientes_por_email,
    ).toHaveBeenCalledWith('c@agro.com');
  });

  it('Admin Finca no puede setear Pendiente', async () => {
    usuario_repo.findOne.mockResolvedValue({
      id_usuario: 46,
      estado: EstadoUsuario.ACTIVO,
      usuario_fincas: [{ finca: { id_finca: 12 } }],
    });

    await expect(
      service.actualizar_estado(
        46,
        { estado: EstadoUsuario.PENDIENTE },
        {
          rol_sistema: null,
          usuario_fincas: [
            {
              finca: { id_finca: 12 },
              rol_finca: { codigo_rol_finca: 'ADMIN_FINCA' },
              fecha_fin_rol: null,
            },
          ],
        } as never,
      ),
    ).rejects.toMatchObject({
      errorCode: 'STATE_NOT_ALLOWED',
      status: HttpStatus.FORBIDDEN,
    });
  });

  it('lista en ámbito Croply a los clientes sin rol de sistema asignado', async () => {
    const qb = build_qb([
      {
        id_usuario: 46,
        nombre: 'Carlos',
        apellido: 'Mendoza',
        email: 'c@agro.com',
        telefono: null,
        estado: EstadoUsuario.PENDIENTE,
        rol_sistema: null,
      },
    ]);
    usuario_repo.createQueryBuilder.mockReturnValue(qb);
    usuario_finca_repo.createQueryBuilder.mockReturnValue(build_qb([]));

    const result = await service.listar_ambito_croply({});

    expect(result.usuarios).toHaveLength(1);
    expect(result.usuarios[0].rol).toBeNull();
    expect(result.pagination.totalItems).toBe(1);
  });

  it('lista candidatos disponibles sin excluir propietarios de otras fincas', async () => {
    const qb = build_qb([
      {
        id_usuario: 55,
        nombre: 'Roberto',
        apellido: 'Sánchez',
        email: 'roberto@mail.com',
      },
    ]);
    usuario_repo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.listar_administradores_finca_disponibles();

    expect(result.usuarios).toEqual([
      {
        id_usuario: 55,
        nombre: 'Roberto',
        apellido: 'Sánchez',
        email: 'roberto@mail.com',
      },
    ]);
    expect(qb.where).toHaveBeenCalledWith('rol.id_rol IS NULL');
    expect(qb.andWhere).toHaveBeenCalledWith('u.fecha_baja IS NULL');
    expect(qb.andWhere).toHaveBeenCalledWith(
      'u.estado != :estado_inactivo',
      { estado_inactivo: EstadoUsuario.INACTIVO },
    );
  });

  it('devuelve una fila por finca con id_usuario_finca en el listado multi-finca', async () => {
    const qb = build_qb([
      {
        id_usuario_finca: 7,
        finca: { id_finca: 1, nombre_finca: 'Finca Demo Croply' },
        rol_finca: { id_rol: 21, nombre_rol: 'Encargado' },
        usuario: {
          id_usuario: 46,
          nombre: 'Carlos',
          apellido: 'Mendoza',
          email: 'c@agro.com',
          telefono: null,
          estado: EstadoUsuario.ACTIVO,
        },
      },
      {
        id_usuario_finca: 9,
        finca: { id_finca: 2, nombre_finca: 'Finca Demo Sur' },
        rol_finca: { id_rol: 22, nombre_rol: 'Operario' },
        usuario: {
          id_usuario: 46,
          nombre: 'Carlos',
          apellido: 'Mendoza',
          email: 'c@agro.com',
          telefono: null,
          estado: EstadoUsuario.ACTIVO,
        },
      },
    ]);
    usuario_finca_repo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.listar_ambito_finca([1, 2], {});

    expect(result.usuarios).toEqual([
      expect.objectContaining({
        id_usuario: 46,
        id_usuario_finca: 7,
        finca: { id_finca: 1, nombre_finca: 'Finca Demo Croply' },
        rol: { id_rol: 21, nombre_rol: 'Encargado' },
      }),
      expect.objectContaining({
        id_usuario_finca: 9,
        finca: { id_finca: 2, nombre_finca: 'Finca Demo Sur' },
      }),
    ]);
  });

  it('no consulta la base si el usuario no administra ninguna finca', async () => {
    const result = await service.listar_ambito_finca([], {});

    expect(usuario_finca_repo.createQueryBuilder).not.toHaveBeenCalled();
    expect(invitacion_repo.createQueryBuilder).not.toHaveBeenCalled();
    expect(result.usuarios).toEqual([]);
    expect(result.pagination.totalItems).toBe(0);
  });

  describe('listar_ambito_finca con invitaciones pendientes', () => {
    const finca = { id_finca: 1, nombre_finca: 'Finca Demo Croply' };

    const vinculacion = (id: number, apellido: string) => ({
      id_usuario_finca: id,
      finca,
      rol_finca: { id_rol: 21, nombre_rol: 'Encargado' },
      usuario: {
        id_usuario: 100 + id,
        nombre: 'Nombre',
        apellido,
        email: `${apellido.toLowerCase()}@agro.com`,
        telefono: null,
        estado: EstadoUsuario.ACTIVO,
      },
    });

    const invitacion = (id: number, email: string) => ({
      id_invitacion_finca: id,
      email_invitado: email,
      estado: EstadoInvitacion.PENDIENTE,
      finca,
      rol_finca: { id_rol: 22, nombre_rol: 'Operario' },
    });

    const claves = (usuarios: Array<Record<string, unknown>>) =>
      usuarios.map((u) =>
        u.id_invitacion_finca != null
          ? `inv${u.id_invitacion_finca}`
          : `uf${u.id_usuario_finca}`,
      );

    it('sin invitaciones devuelve sólo usuarios, sin campos nuevos', async () => {
      usuario_finca_repo.createQueryBuilder.mockReturnValue(
        build_qb([vinculacion(7, 'Mendoza')]),
      );

      const result = await service.listar_ambito_finca([1], {});

      expect(result.usuarios).toHaveLength(1);
      expect(result.usuarios[0]).not.toHaveProperty('id_invitacion_finca');
      expect(result.usuarios[0]).toMatchObject({
        id_usuario: 107,
        id_usuario_finca: 7,
      });
      expect(result.pagination.totalItems).toBe(1);
    });

    it('pone primero las invitaciones pendientes con la forma esperada', async () => {
      const inv_qb = build_qb([invitacion(5, 'nuevo@agro.com')]);
      invitacion_repo.createQueryBuilder.mockReturnValue(inv_qb);
      usuario_finca_repo.createQueryBuilder.mockReturnValue(
        build_qb([vinculacion(7, 'Mendoza')]),
      );

      const result = await service.listar_ambito_finca([1], {});

      expect(result.usuarios).toHaveLength(2);
      expect(result.usuarios[0]).toEqual({
        id_usuario: null,
        id_usuario_finca: null,
        id_invitacion_finca: 5,
        nombre: null,
        apellido: null,
        telefono: null,
        email: 'nuevo@agro.com',
        rol: { id_rol: 22, nombre_rol: 'Operario' },
        finca,
        estado: 'Pendiente',
      });
      expect(result.usuarios[1]).toMatchObject({ id_usuario_finca: 7 });
      expect(result.pagination.totalItems).toBe(2);
      expect(inv_qb.orderBy).toHaveBeenCalledWith('inv.fecha_envio', 'DESC');
      expect(inv_qb.addOrderBy).toHaveBeenCalledWith(
        'inv.id_invitacion_finca',
        'DESC',
      );
    });

    it('excluye invitaciones aceptadas, canceladas y vencidas', async () => {
      const inv_qb = build_qb([]);
      invitacion_repo.createQueryBuilder.mockReturnValue(inv_qb);
      usuario_finca_repo.createQueryBuilder.mockReturnValue(build_qb([]));

      await service.listar_ambito_finca([1, 2], {});

      expect(inv_qb.where).toHaveBeenCalledWith(
        'f.id_finca IN (:...ids_finca)',
        { ids_finca: [1, 2] },
      );
      expect(inv_qb.andWhere).toHaveBeenCalledWith(
        'inv.estado = :estado_invitacion',
        { estado_invitacion: EstadoInvitacion.PENDIENTE },
      );
      expect(inv_qb.andWhere).toHaveBeenCalledWith(
        'inv.fecha_fin_vigencia > NOW()',
      );
      expect(inv_qb.andWhere).toHaveBeenCalledWith(
        'inv.fecha_respuesta IS NULL',
      );
      expect(inv_qb.andWhere).toHaveBeenCalledWith(
        'inv.fecha_cancelacion IS NULL',
      );
    });

    it.each([EstadoUsuario.ACTIVO, EstadoUsuario.INACTIVO])(
      'con estado=%s no incluye invitaciones',
      async (estado) => {
        usuario_finca_repo.createQueryBuilder.mockReturnValue(
          build_qb([vinculacion(7, 'Mendoza')]),
        );

        const result = await service.listar_ambito_finca([1], { estado });

        expect(invitacion_repo.createQueryBuilder).not.toHaveBeenCalled();
        expect(claves(result.usuarios)).toEqual(['uf7']);
        expect(result.pagination.totalItems).toBe(1);
      },
    );

    it('con estado=Pendiente incluye invitaciones y usuarios pendientes', async () => {
      invitacion_repo.createQueryBuilder.mockReturnValue(
        build_qb([invitacion(5, 'nuevo@agro.com')]),
      );
      const uf_qb = build_qb([vinculacion(7, 'Mendoza')]);
      usuario_finca_repo.createQueryBuilder.mockReturnValue(uf_qb);

      const result = await service.listar_ambito_finca([1], {
        estado: EstadoUsuario.PENDIENTE,
      });

      expect(uf_qb.andWhere).toHaveBeenCalledWith('u.estado = :estado', {
        estado: EstadoUsuario.PENDIENTE,
      });
      expect(claves(result.usuarios)).toEqual(['inv5', 'uf7']);
      expect(result.pagination.totalItems).toBe(2);
    });

    it('search filtra las invitaciones por email_invitado', async () => {
      const inv_qb = build_qb([]);
      invitacion_repo.createQueryBuilder.mockReturnValue(inv_qb);
      usuario_finca_repo.createQueryBuilder.mockReturnValue(build_qb([]));

      await service.listar_ambito_finca([1], { search: '  NUEVO ' });

      expect(inv_qb.andWhere).toHaveBeenCalledWith(
        'LOWER(inv.email_invitado) LIKE :term',
        { term: '%nuevo%' },
      );
    });

    it('id_rol filtra las invitaciones por rol_finca', async () => {
      const inv_qb = build_qb([]);
      invitacion_repo.createQueryBuilder.mockReturnValue(inv_qb);
      usuario_finca_repo.createQueryBuilder.mockReturnValue(build_qb([]));

      await service.listar_ambito_finca([1], { id_rol: 22 });

      expect(inv_qb.leftJoinAndSelect).toHaveBeenCalledWith(
        'inv.rol_finca',
        'rol',
      );
      expect(inv_qb.andWhere).toHaveBeenCalledWith('rol.id_rol = :id_rol', {
        id_rol: 22,
      });
    });

    describe('paginación sobre el listado combinado', () => {
      // 3 invitaciones + 4 usuarios = 7 filas, pageSize 2.
      let inv_qb: Record<string, jest.Mock>;
      let uf_qb: Record<string, jest.Mock>;

      beforeEach(() => {
        inv_qb = build_qb(
          [1, 2, 3].map((id) => invitacion(id, `inv${id}@agro.com`)),
        );
        uf_qb = build_qb(
          [10, 11, 12, 13].map((id) => vinculacion(id, `Ape${id}`)),
        );
        invitacion_repo.createQueryBuilder.mockReturnValue(inv_qb);
        usuario_finca_repo.createQueryBuilder.mockReturnValue(uf_qb);
      });

      it('página 1: sólo invitaciones, no trae filas de usuarios', async () => {
        const result = await service.listar_ambito_finca([1], {
          page: 1,
          pageSize: 2,
        });

        expect(claves(result.usuarios)).toEqual(['inv1', 'inv2']);
        expect(uf_qb.getMany).not.toHaveBeenCalled();
        expect(result.pagination).toEqual({
          page: 1,
          pageSize: 2,
          totalItems: 7,
          totalPages: 4,
        });
      });

      it('página 2: cruza el límite entre invitaciones y usuarios', async () => {
        const result = await service.listar_ambito_finca([1], {
          page: 2,
          pageSize: 2,
        });

        expect(claves(result.usuarios)).toEqual(['inv3', 'uf10']);
        expect(inv_qb.skip).toHaveBeenCalledWith(2);
        expect(inv_qb.take).toHaveBeenCalledWith(1);
        expect(uf_qb.skip).toHaveBeenCalledWith(0);
        expect(uf_qb.take).toHaveBeenCalledWith(1);
      });

      it('página 3: sólo usuarios con el skip ajustado', async () => {
        const result = await service.listar_ambito_finca([1], {
          page: 3,
          pageSize: 2,
        });

        expect(claves(result.usuarios)).toEqual(['uf11', 'uf12']);
        expect(inv_qb.getMany).not.toHaveBeenCalled();
        expect(uf_qb.skip).toHaveBeenCalledWith(1);
        expect(uf_qb.take).toHaveBeenCalledWith(2);
      });

      it('página fuera de rango: lista vacía con pagination correcto', async () => {
        const result = await service.listar_ambito_finca([1], {
          page: 9,
          pageSize: 2,
        });

        expect(result.usuarios).toEqual([]);
        expect(inv_qb.getMany).not.toHaveBeenCalled();
        expect(uf_qb.getMany).not.toHaveBeenCalled();
        expect(result.pagination).toEqual({
          page: 9,
          pageSize: 2,
          totalItems: 7,
          totalPages: 4,
        });
      });
    });
  });
});
