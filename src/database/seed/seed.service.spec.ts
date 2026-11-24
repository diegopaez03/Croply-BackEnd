import { ConfigService } from '@nestjs/config';
import {
  CODIGO_ADMIN_CROPLY,
  CODIGO_ADMIN_FINCA,
  EstadoUsuario,
} from '../../common/enums';
import { SeedService } from './seed.service';
import { ADMIN_USUARIOS_SEED } from './admin-usuarios.seed';

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
  let cultivos_service: {
    find_activo_por_nombre: jest.Mock;
    crear: jest.Mock;
    agregar_variedad: jest.Mock;
  };
  let plantillas_service: {
    find_activa_por_nombre: jest.Mock;
    crear: jest.Mock;
  };
  let tipos_tarea_service: { ensure_seed: jest.Mock };
  let estados_tarea_service: { ensure_seed: jest.Mock };
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
    cultivos_service = {
      find_activo_por_nombre: jest.fn().mockResolvedValue(null),
      crear: jest.fn().mockResolvedValue({ id_cultivo_base: 45 }),
      agregar_variedad: jest.fn().mockResolvedValue({ id_variedad: 12 }),
    };
    plantillas_service = {
      find_activa_por_nombre: jest.fn().mockResolvedValue(null),
      crear: jest.fn().mockResolvedValue({ id_plantilla_base: 3 }),
    };
    tipos_tarea_service = { ensure_seed: jest.fn().mockResolvedValue(undefined) };
    estados_tarea_service = {
      ensure_seed: jest.fn().mockResolvedValue(undefined),
    };
    config = { get: jest.fn().mockReturnValue(undefined) };

    service = new SeedService(
      usuarios_service as never,
      roles_service as never,
      fincas_service as never,
      cultivos_service as never,
      plantillas_service as never,
      tipos_tarea_service as never,
      estados_tarea_service as never,
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

  it('siembra estados y el tipo de tarea de agroquímico', async () => {
    await service.seed_catalogos_tarea();

    expect(estados_tarea_service.ensure_seed).toHaveBeenCalled();
    expect(tipos_tarea_service.ensure_seed).toHaveBeenCalled();
  });
});