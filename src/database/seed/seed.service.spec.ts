import { ConfigService } from '@nestjs/config';
import {
  CODIGO_ADMIN_CROPLY,
  CODIGO_ADMIN_FINCA,
  EstadoUsuario,
} from '../../common/enums';
import { SeedService } from './seed.service';
import { ADMIN_USUARIOS_SEED } from './admin-usuarios.seed';
import {
  ADMIN_FINCA_DEMO_SEED,
  FINCAS_DEMO_SEED,
} from './finca-demo.seed';

describe('SeedService', () => {
  let service: SeedService;
  let usuarios_service: {
    exists_by_email: jest.Mock;
    create: jest.Mock;
    find_by_email: jest.Mock;
  };
  let roles_service: {
    ensure_seed_roles: jest.Mock;
    find_rol_sistema_by_codigo: jest.Mock;
    find_rol_finca_by_codigo: jest.Mock;
    find_rol_finca_by_nombre: jest.Mock;
    find_rol_finca_by_id: jest.Mock;
    crear_rol_finca: jest.Mock;
    listar_permisos: jest.Mock;
  };
  let fincas_service: {
    find_finca_by_nombre: jest.Mock;
    crear_finca: jest.Mock;
    find_usuario_finca: jest.Mock;
    create_usuario_finca: jest.Mock;
  };
  let config: { get: jest.Mock };

  beforeEach(() => {
    usuarios_service = {
      exists_by_email: jest.fn().mockResolvedValue(false),
      create: jest.fn().mockImplementation(async (data) => data),
      find_by_email: jest.fn().mockResolvedValue(null),
    };
    roles_service = {
      ensure_seed_roles: jest.fn().mockResolvedValue(undefined),
      find_rol_sistema_by_codigo: jest.fn().mockResolvedValue({
        id_rol: 1,
        codigo: CODIGO_ADMIN_CROPLY,
      }),
      find_rol_finca_by_codigo: jest.fn().mockResolvedValue({
        id_rol: 2,
        codigo_rol_finca: CODIGO_ADMIN_FINCA,
      }),
      find_rol_finca_by_nombre: jest.fn().mockResolvedValue(null),
      find_rol_finca_by_id: jest
        .fn()
        .mockImplementation(async (id_rol) => ({ id_rol })),
      crear_rol_finca: jest
        .fn()
        .mockImplementation(async (_id_finca, dto) => ({
          id_rol: 30,
          nombre_rol: dto.nombre_rol,
        })),
      listar_permisos: jest.fn().mockResolvedValue({
        permisos: [{ id_permiso: 8, nombre_permiso: 'Tareas de campo' }],
      }),
    };
    fincas_service = {
      find_finca_by_nombre: jest.fn().mockResolvedValue(null),
      crear_finca: jest
        .fn()
        .mockImplementation(async (data) => ({ id_finca: 1, ...data })),
      find_usuario_finca: jest.fn().mockResolvedValue(null),
      create_usuario_finca: jest.fn().mockResolvedValue(undefined),
    };
    config = { get: jest.fn().mockReturnValue(undefined) };

    service = new SeedService(
      usuarios_service as never,
      roles_service as never,
      fincas_service as never,
      config as unknown as ConfigService,
    );
  });

  it('crea los tres admins Croply del equipo si no existen', async () => {
    await service.seed_admin_usuarios();

    expect(roles_service.ensure_seed_roles).toHaveBeenCalled();
    expect(usuarios_service.create).toHaveBeenCalledTimes(
      ADMIN_USUARIOS_SEED.length,
    );

    const emails = usuarios_service.create.mock.calls.map(
      (call) => call[0].email,
    );
    expect(emails).toEqual([
      'diego@croply.app',
      'rodrigo@croply.app',
      'paula@croply.app',
    ]);

    expect(usuarios_service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre: 'Diego',
        apellido: 'Páez',
        estado: EstadoUsuario.ACTIVO,
        debe_cambiar_contrasena: false,
        rol_sistema: expect.objectContaining({
          codigo: CODIGO_ADMIN_CROPLY,
        }),
      }),
    );
  });

  it('no recrea usuarios que ya existen', async () => {
    usuarios_service.exists_by_email.mockImplementation(async (email) =>
      email === 'diego@croply.app',
    );

    await service.seed_admin_usuarios();

    expect(usuarios_service.create).toHaveBeenCalledTimes(2);
    const emails = usuarios_service.create.mock.calls.map(
      (call) => call[0].email,
    );
    expect(emails).not.toContain('diego@croply.app');
  });

  it('siembra el Admin de Finca demo vinculado a todas las fincas demo', async () => {
    await service.seed_finca_demo();

    expect(fincas_service.crear_finca).toHaveBeenCalledTimes(
      FINCAS_DEMO_SEED.length,
    );

    const emails = usuarios_service.create.mock.calls.map(
      (call) => call[0].email,
    );
    expect(emails).toContain(ADMIN_FINCA_DEMO_SEED.email);

    const vinculaciones_admin =
      fincas_service.create_usuario_finca.mock.calls.filter(
        (call) => call[0].usuario.email === ADMIN_FINCA_DEMO_SEED.email,
      );
    expect(vinculaciones_admin).toHaveLength(FINCAS_DEMO_SEED.length);
    expect(vinculaciones_admin[0][0].rol_finca).toMatchObject({
      codigo_rol_finca: CODIGO_ADMIN_FINCA,
    });
  });

  it('no duplica la finca demo ni sus vinculaciones si ya existen', async () => {
    fincas_service.find_finca_by_nombre.mockImplementation(
      async (nombre_finca) => ({ id_finca: 1, nombre_finca }),
    );
    usuarios_service.find_by_email.mockImplementation(async (email) => ({
      id_usuario: 5,
      email,
    }));
    fincas_service.find_usuario_finca.mockResolvedValue({
      id_usuario_finca: 3,
    });

    await service.seed_finca_demo();

    expect(fincas_service.crear_finca).not.toHaveBeenCalled();
    expect(usuarios_service.create).not.toHaveBeenCalled();
    expect(fincas_service.create_usuario_finca).not.toHaveBeenCalled();
  });
});
