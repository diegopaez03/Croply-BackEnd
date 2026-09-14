import { HttpStatus } from '@nestjs/common';
import { RolesService } from './roles.service';
import { AmbitoPermiso } from '../../common/enums';

describe('RolesService', () => {
  let service: RolesService;
  let rol_sistema_repo: Record<string, jest.Mock>;
  let rol_finca_repo: Record<string, jest.Mock>;
  let permiso_repo: Record<string, jest.Mock>;
  let rol_permiso_repo: Record<string, jest.Mock>;
  let usuario_repo: Record<string, jest.Mock>;
  let usuario_finca_repo: Record<string, jest.Mock>;
  let log_service: { registrar: jest.Mock };

  beforeEach(() => {
    rol_sistema_repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(async (x) => ({ id_rol: 9, ...x })),
      create: jest.fn((x) => x),
    };
    rol_finca_repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(async (x) => ({ id_rol: 21, ...x })),
      create: jest.fn((x) => x),
    };
    permiso_repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn((x) => x),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    rol_permiso_repo = {
      delete: jest.fn(),
      save: jest.fn(),
      create: jest.fn((x) => x),
    };
    usuario_repo = {
      count: jest.fn().mockResolvedValue(0),
      createQueryBuilder: jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn(),
      })),
    };
    usuario_finca_repo = {
      createQueryBuilder: jest.fn(() => ({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      })),
    };
    log_service = { registrar: jest.fn().mockResolvedValue(undefined) };

    service = new RolesService(
      rol_sistema_repo as never,
      rol_finca_repo as never,
      permiso_repo as never,
      rol_permiso_repo as never,
      usuario_repo as never,
      usuario_finca_repo as never,
      log_service as never,
    );
  });

  it('crea rol de sistema y devuelve cantidad 0', async () => {
    rol_sistema_repo.findOne.mockResolvedValue(null);
    usuario_repo.count.mockResolvedValue(0);

    const result = await service.crear_rol_sistema(
      { nombre_rol: 'Supervisor', descripcion: 'Ops' },
      { id_usuario: 1 } as never,
    );

    expect(result.message).toBe('Rol creado correctamente');
    expect(result.id_rol).toBe(9);
    expect(result.cantidad_usuarios_asignados).toBe(0);
  });

  it('incluye los permisos asignados en el listado de roles de sistema', async () => {
    rol_sistema_repo.find.mockResolvedValue([
      {
        id_rol: 5,
        nombre_rol: 'Administrador de Finca',
        descripcion: null,
        fecha_baja_rol: null,
        rol_permisos: [
          { permiso: { id_permiso: 4, nombre_permiso: 'Reportes' } },
          {
            permiso: {
              id_permiso: 1,
              nombre_permiso: 'Gestión de finca y parcelas',
            },
          },
        ],
      },
    ]);
    usuario_repo.count.mockResolvedValue(12);

    const { roles } = await service.listar_roles_sistema();

    expect(roles[0].permisos).toEqual([
      { id_permiso: 1, nombre_permiso: 'Gestión de finca y parcelas' },
      { id_permiso: 4, nombre_permiso: 'Reportes' },
    ]);
    expect(roles[0].cantidad_usuarios_asignados).toBe(12);
  });

  it('lista permisos por ámbito', async () => {
    permiso_repo.find.mockResolvedValue([
      {
        id_permiso: 1,
        nombre_permiso: 'Gestión de finca y parcelas',
        ambito: AmbitoPermiso.SISTEMA,
      },
    ]);

    await expect(
      service.listar_permisos(AmbitoPermiso.SISTEMA),
    ).resolves.toEqual({
      permisos: [
        {
          id_permiso: 1,
          nombre_permiso: 'Gestión de finca y parcelas',
        },
      ],
    });
  });

  it('rechaza baja de rol de finca con usuarios asignados', async () => {
    rol_finca_repo.findOne.mockResolvedValue({
      id_rol: 21,
      nombre_rol: 'Encargado',
      codigo_rol_finca: 'F1_ENCARGADO',
      fecha_baja_rol: null,
      finca: { id_finca: 1 },
      rol_permisos: [],
    });
    usuario_finca_repo.createQueryBuilder = jest.fn(() => ({
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(2),
    }));

    await expect(
      service.dar_baja_rol_finca(1, 21, { id_usuario: 1 } as never),
    ).rejects.toMatchObject({
      errorCode: 'RESOURCE_IN_USE',
      status: HttpStatus.CONFLICT,
    });
  });
});
