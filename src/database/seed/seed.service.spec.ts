import { ConfigService } from '@nestjs/config';
import { CODIGO_ADMIN_CROPLY, EstadoUsuario } from '../../common/enums';
import { SeedService } from './seed.service';
import { ADMIN_USUARIOS_SEED } from './admin-usuarios.seed';

describe('SeedService', () => {
  let service: SeedService;
  let usuarios_service: {
    exists_by_email: jest.Mock;
    create: jest.Mock;
  };
  let roles_service: {
    ensure_seed_roles: jest.Mock;
    find_rol_sistema_by_codigo: jest.Mock;
  };
  let config: { get: jest.Mock };

  beforeEach(() => {
    usuarios_service = {
      exists_by_email: jest.fn().mockResolvedValue(false),
      create: jest.fn().mockImplementation(async (data) => data),
    };
    roles_service = {
      ensure_seed_roles: jest.fn().mockResolvedValue(undefined),
      find_rol_sistema_by_codigo: jest.fn().mockResolvedValue({
        id_rol: 1,
        codigo: CODIGO_ADMIN_CROPLY,
      }),
    };
    config = { get: jest.fn().mockReturnValue(undefined) };

    service = new SeedService(
      usuarios_service as never,
      roles_service as never,
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
});
