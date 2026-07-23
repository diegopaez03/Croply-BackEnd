import { HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { DomainException } from '../../common/exceptions';
import { EstadoInvitacion, EstadoUsuario } from '../../common/enums';
import { hash_password, hash_token } from './auth.crypto';

describe('AuthService', () => {
  let service: AuthService;
  let usuarios_service: {
    find_by_email: jest.Mock;
    find_by_id: jest.Mock;
    exists_by_email: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let fincas_service: {
    find_invitacion_by_id: jest.Mock;
    find_all_invitaciones: jest.Mock;
    create_usuario_finca: jest.Mock;
    save_invitacion: jest.Mock;
  };
  let roles_service: {
    find_rol_sistema_by_id: jest.Mock;
  };
  let jwt_service: { signAsync: jest.Mock };
  let config: { get: jest.Mock };
  let mailer: { send_password_reset: jest.Mock };
  let resets_repo: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
  };

  beforeEach(() => {
    usuarios_service = {
      find_by_email: jest.fn(),
      find_by_id: jest.fn(),
      exists_by_email: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    fincas_service = {
      find_invitacion_by_id: jest.fn(),
      find_all_invitaciones: jest.fn(),
      create_usuario_finca: jest.fn(),
      save_invitacion: jest.fn(),
    };
    roles_service = { find_rol_sistema_by_id: jest.fn() };
    jwt_service = { signAsync: jest.fn().mockResolvedValue('jwt-token') };
    config = { get: jest.fn().mockReturnValue('1h') };
    mailer = { send_password_reset: jest.fn() };
    resets_repo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
      find: jest.fn(),
    };

    service = new AuthService(
      usuarios_service as never,
      fincas_service as never,
      roles_service as never,
      jwt_service as unknown as JwtService,
      config as unknown as ConfigService,
      mailer as never,
      resets_repo as never,
    );
  });

  describe('login', () => {
    it('devuelve accessToken y usuario activo con fincas', async () => {
      const hashed = await hash_password('Password123!');
      usuarios_service.find_by_email.mockResolvedValue({
        id_usuario: 45,
        email: 'usuario@finca.com',
        contrasena: hashed,
        estado: EstadoUsuario.ACTIVO,
        nombre: 'Juan',
        apellido: 'Pérez',
        debe_cambiar_contrasena: false,
        fecha_alta: new Date('2026-03-15T10:00:00Z'),
        rol_sistema: null,
        usuario_fincas: [
          {
            fecha_fin_rol: null,
            finca: { id_finca: 12, nombre_finca: 'La Esperanza' },
            rol_finca: { codigo_rol_finca: 'ADMIN_FINCA' },
          },
        ],
      });

      const result = await service.login({
        email: 'usuario@finca.com',
        contrasena: 'Password123!',
      });

      expect(result.accessToken).toBe('jwt-token');
      expect(result.expiresIn).toBe(3600);
      expect(result.debe_cambiar_contrasena).toBe(false);
      expect(result.usuario).toEqual({
        id_Usuario: 45,
        email: 'usuario@finca.com',
        nombre: 'Juan',
        apellido: 'Pérez',
        estado: EstadoUsuario.ACTIVO,
        fecha_alta: '2026-03-15T10:00:00.000Z',
        rol_sistema: null,
        fincas: [
          {
            id_Finca: 12,
            nombre_finca: 'La Esperanza',
            rol_finca: 'ADMIN_FINCA',
          },
        ],
      });
    });

    it('lanza INVALID_CREDENTIALS si la contraseña es incorrecta', async () => {
      const hashed = await hash_password('Password123!');
      usuarios_service.find_by_email.mockResolvedValue({
        id_usuario: 1,
        email: 'usuario@finca.com',
        contrasena: hashed,
        estado: EstadoUsuario.ACTIVO,
      });

      await expect(
        service.login({ email: 'usuario@finca.com', contrasena: 'wrong' }),
      ).rejects.toMatchObject({
        errorCode: 'INVALID_CREDENTIALS',
        status: HttpStatus.UNAUTHORIZED,
      });
    });

    it('lanza ACCOUNT_NOT_ACTIVE si el estado no es Activo', async () => {
      const hashed = await hash_password('Password123!');
      usuarios_service.find_by_email.mockResolvedValue({
        id_usuario: 1,
        email: 'usuario@finca.com',
        contrasena: hashed,
        estado: EstadoUsuario.PENDIENTE,
        debe_cambiar_contrasena: false,
      });

      await expect(
        service.login({
          email: 'usuario@finca.com',
          contrasena: 'Password123!',
        }),
      ).rejects.toMatchObject({
        errorCode: 'ACCOUNT_NOT_ACTIVE',
        status: HttpStatus.FORBIDDEN,
      });
    });

    it('permite login Pendiente si debe_cambiar_contrasena es true', async () => {
      const hashed = await hash_password('TempClave123!');
      usuarios_service.find_by_email.mockResolvedValue({
        id_usuario: 46,
        email: 'nuevoadmin@finca.com',
        contrasena: hashed,
        estado: EstadoUsuario.PENDIENTE,
        nombre: 'Carlos',
        apellido: 'Gómez',
        debe_cambiar_contrasena: true,
        fecha_alta: new Date('2026-07-14T15:30:00Z'),
        rol_sistema: null,
        usuario_fincas: [],
      });

      const result = await service.login({
        email: 'nuevoadmin@finca.com',
        contrasena: 'TempClave123!',
      });

      expect(result.debe_cambiar_contrasena).toBe(true);
      expect(result.accessToken).toBe('jwt-token');
    });
  });

  describe('registrar_admin_finca', () => {
    it('crea usuario con debe_cambiar_contrasena y mensaje de éxito', async () => {
      usuarios_service.exists_by_email.mockResolvedValue(false);
      usuarios_service.create.mockResolvedValue({
        id_usuario: 46,
        email: 'nuevoadmin@finca.com',
        nombre: 'Carlos',
        apellido: 'Gómez',
        telefono: '+5493511234567',
        estado: EstadoUsuario.PENDIENTE,
        rol_sistema: null,
        fecha_alta: new Date('2026-07-14T15:30:00Z'),
        fecha_baja: null,
      });

      const result = await service.registrar_admin_finca({
        email: 'nuevoadmin@finca.com',
        nombre: 'Carlos',
        apellido: 'Gómez',
        telefono: '+5493511234567',
        contrasena_temporal: 'TempClave123!',
        id_Rol: null,
        estado: EstadoUsuario.PENDIENTE,
      });

      expect(result.message).toBe('Usuario registrado correctamente');
      expect(result.id_Usuario).toBe(46);
      expect(usuarios_service.create).toHaveBeenCalledWith(
        expect.objectContaining({
          debe_cambiar_contrasena: true,
          estado: EstadoUsuario.PENDIENTE,
        }),
      );
    });

    it('lanza DUPLICATE_VALUE si el email ya existe', async () => {
      usuarios_service.exists_by_email.mockResolvedValue(true);

      await expect(
        service.registrar_admin_finca({
          email: 'dup@finca.com',
          nombre: 'A',
          apellido: 'B',
          contrasena_temporal: 'TempClave123!',
          id_Rol: null,
          estado: EstadoUsuario.PENDIENTE,
        }),
      ).rejects.toMatchObject({
        errorCode: 'DUPLICATE_VALUE',
        status: HttpStatus.CONFLICT,
      });
    });
  });

  describe('validar_invitacion', () => {
    it('devuelve datos cuando el token es válido', async () => {
      const plain = 'token-valido';
      const token_hash = await hash_token(plain);
      fincas_service.find_all_invitaciones.mockResolvedValue([
        {
          id_invitacion_finca: 102,
          email_invitado: 'luis_invitado@finca.com',
          token_hash,
          estado: EstadoInvitacion.PENDIENTE,
          fecha_respuesta: null,
          usuario_registrado: null,
          fecha_fin_vigencia: new Date(Date.now() + 86400000),
        },
      ]);

      await expect(service.validar_invitacion(plain)).resolves.toEqual({
        valido: true,
        email_invitado: 'luis_invitado@finca.com',
        id_InvitacionFinca: 102,
      });
    });

    it('lanza INVITATION_ALREADY_USED si ya fue aceptada', async () => {
      const plain = 'token-usado';
      const token_hash = await hash_token(plain);
      fincas_service.find_all_invitaciones.mockResolvedValue([
        {
          id_invitacion_finca: 102,
          email_invitado: 'luis@finca.com',
          token_hash,
          estado: EstadoInvitacion.ACEPTADA,
          fecha_respuesta: new Date(),
          usuario_registrado: { id_usuario: 1 },
          fecha_fin_vigencia: new Date(Date.now() + 86400000),
        },
      ]);

      await expect(service.validar_invitacion(plain)).rejects.toMatchObject({
        errorCode: 'INVITATION_ALREADY_USED',
        status: HttpStatus.GONE,
      });
    });
  });

  describe('olvide_mi_contrasena', () => {
    it('siempre devuelve el mismo mensaje genérico', async () => {
      usuarios_service.find_by_email.mockResolvedValue(null);

      await expect(
        service.olvide_mi_contrasena({ email: 'noexiste@finca.com' }),
      ).resolves.toEqual({
        message:
          'Si el correo ingresado está registrado, recibirás un enlace para restablecer tu contraseña.',
      });
      expect(mailer.send_password_reset).not.toHaveBeenCalled();
    });
  });

  describe('resetear_contrasena', () => {
    it('lanza PASSWORD_MISMATCH si no coinciden', async () => {
      await expect(
        service.resetear_contrasena({
          token_hash: 'abc',
          nueva_contrasena: 'a',
          confirmar_contrasena: 'b',
        }),
      ).rejects.toMatchObject({
        errorCode: 'PASSWORD_MISMATCH',
        status: HttpStatus.BAD_REQUEST,
      });
    });
  });

  describe('cambio_contrasena', () => {
    it('lanza CURRENT_PASSWORD_INCORRECT si la actual no coincide', async () => {
      const hashed = await hash_password('ViejaClave123!');
      usuarios_service.find_by_id.mockResolvedValue({
        id_usuario: 1,
        contrasena: hashed,
      });

      await expect(
        service.cambio_contrasena(1, {
          contrasena_actual: 'wrong',
          nueva_contrasena: 'NuevaClave456!',
          confirmar_contrasena: 'NuevaClave456!',
        }),
      ).rejects.toMatchObject({
        errorCode: 'CURRENT_PASSWORD_INCORRECT',
      });
    });
  });

  describe('contrasena_primer_acceso', () => {
    it('activa la cuenta y limpia debe_cambiar_contrasena', async () => {
      const usuario = {
        id_usuario: 1,
        estado: EstadoUsuario.PENDIENTE,
        debe_cambiar_contrasena: true,
        contrasena: 'hash',
      };
      usuarios_service.find_by_id.mockResolvedValue(usuario);
      usuarios_service.save.mockImplementation(async (u) => u);

      const result = await service.contrasena_primer_acceso(1, {
        nueva_contrasena: 'MiPrimerClaveSegura1!',
        confirmar_contrasena: 'MiPrimerClaveSegura1!',
      });

      expect(result.success).toBe(true);
      expect(usuario.estado).toBe(EstadoUsuario.ACTIVO);
      expect(usuario.debe_cambiar_contrasena).toBe(false);
    });
  });

  describe('assert_admin_croply', () => {
    it('lanza FORBIDDEN si no es ADMIN_CROPLY', () => {
      expect(() =>
        service.assert_admin_croply({
          rol_sistema: { codigo: 'OTRO' },
        } as never),
      ).toThrow(DomainException);
    });
  });
});
