import { HttpStatus } from '@nestjs/common';
import { EstadoUsuario } from '../../common/enums';
import { UsuariosService } from './usuarios.service';

/** Query builder encadenable que devuelve `rows` en getMany/getManyAndCount. */
function build_qb(rows: unknown[]) {
  const qb: Record<string, jest.Mock> = {};
  const chain = () => qb;
  for (const method of [
    'leftJoin',
    'leftJoinAndSelect',
    'innerJoinAndSelect',
    'where',
    'andWhere',
    'orderBy',
    'addOrderBy',
    'skip',
    'take',
  ]) {
    qb[method] = jest.fn(chain);
  }
  qb.getCount = jest.fn().mockResolvedValue(rows.length);
  qb.getMany = jest.fn().mockResolvedValue(rows);
  return qb;
}

describe('UsuariosService', () => {
  let service: UsuariosService;
  let usuario_repo: Record<string, jest.Mock>;
  let usuario_finca_repo: Record<string, jest.Mock>;
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
    expect(result.usuarios).toEqual([]);
    expect(result.pagination.totalItems).toBe(0);
  });
});
