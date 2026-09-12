import { HttpStatus } from '@nestjs/common';
import {
  CODIGO_ADMIN_FINCA,
  EstadoInvitacion,
  EstadoParcela,
} from '../../common/enums';
import { FincasService } from './fincas.service';

describe('FincasService', () => {
  let service: FincasService;
  let finca_repo: Record<string, jest.Mock>;
  let usuario_finca_repo: Record<string, jest.Mock>;
  let usuario_repo: Record<string, jest.Mock>;
  let parcela_repo: Record<string, jest.Mock>;
  let sensor_repo: Record<string, jest.Mock>;
  let invitacion_repo: Record<string, jest.Mock>;
  let roles_service: {
    find_rol_finca_by_id: jest.Mock;
    find_rol_finca_by_codigo: jest.Mock;
  };
  let mailer: { send_invitation: jest.Mock };
  let log_service: { registrar: jest.Mock };

  beforeEach(() => {
    finca_repo = {
      findOne: jest.fn().mockResolvedValue({
        id_finca: 1,
        fecha_baja_finca: null,
      }),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
    };
    usuario_finca_repo = {
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn(() => ({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      })),
      findOne: jest.fn(),
      save: jest.fn(async (x) => x),
      create: jest.fn((x) => x),
    };
    usuario_repo = { findOne: jest.fn() };
    parcela_repo = { findOne: jest.fn() };
    sensor_repo = {
      createQueryBuilder: jest.fn(() => ({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      })),
    };
    invitacion_repo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(async (x) => ({
        ...x,
        id_invitacion_finca: 130,
        fecha_envio: new Date('2026-07-18T15:00:00Z'),
      })),
      create: jest.fn((x) => x),
    };
    roles_service = {
      find_rol_finca_by_id: jest.fn().mockResolvedValue({
        id_rol: 21,
        fecha_baja_rol: null,
        finca: { id_finca: 1 },
        nombre_rol: 'Encargado',
      }),
      find_rol_finca_by_codigo: jest.fn(),
    };
    mailer = { send_invitation: jest.fn().mockResolvedValue(undefined) };
    log_service = { registrar: jest.fn().mockResolvedValue(undefined) };

    service = new FincasService(
      finca_repo as never,
      usuario_finca_repo as never,
      usuario_repo as never,
      parcela_repo as never,
      sensor_repo as never,
      invitacion_repo as never,
      roles_service as never,
      mailer as never,
      log_service as never,
    );
  });

  it('crea invitación y envía mail stub', async () => {
    invitacion_repo.findOne.mockResolvedValue(null);

    const result = await service.crear_invitacion(
      1,
      { email_invitado: 'empleado@correo.com', id_rol: 21 },
      { id_usuario: 1 } as never,
    );

    expect(result.message).toBe('Invitación enviada correctamente');
    expect(result.id_invitacion_finca).toBe(130);
    expect(mailer.send_invitation).toHaveBeenCalled();
  });

  it('lanza PENDING_INVITATION_EXISTS con id', async () => {
    invitacion_repo.findOne.mockResolvedValue({
      id_invitacion_finca: 130,
      estado: EstadoInvitacion.PENDIENTE,
    });

    await expect(
      service.crear_invitacion(
        1,
        { email_invitado: 'empleado@correo.com', id_rol: 21 },
        { id_usuario: 1 } as never,
      ),
    ).rejects.toMatchObject({
      errorCode: 'PENDING_INVITATION_EXISTS',
      status: HttpStatus.CONFLICT,
    });
  });

  it('rechaza crear una finca con nombre duplicado', async () => {
    await expect(
      service.crear_finca_desde_dto(
        {
          nombre_finca: 'Finca Demo Croply',
          provincia: 'Córdoba',
          departamento: 'Capital',
          longitud: '-64.1888',
          latitud: '-31.4201',
          superficie_finca: 10,
        },
        { id_usuario: 1 } as never,
      ),
    ).rejects.toMatchObject({
      errorCode: 'DUPLICATE_VALUE',
      field: 'nombre_finca',
      status: HttpStatus.CONFLICT,
    });
  });

  it('da de baja lógicamente una finca', async () => {
    const result = await service.dar_baja_finca(1, { id_usuario: 1 } as never);

    expect(finca_repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ fecha_baja_finca: expect.any(Date) }),
    );
    expect(result.message).toBe(
      'Finca dada de baja correctamente. Las parcelas y datos asociados fueron actualizados.',
    );
  });

  it('asigna un propietario creando una nueva membresía vigente', async () => {
    usuario_finca_repo.findOne.mockResolvedValue(null);
    usuario_repo.findOne.mockResolvedValue({
      id_usuario: 55,
      estado: 'Activo',
      fecha_baja: null,
      rol_sistema: null,
    });
    roles_service.find_rol_finca_by_id.mockResolvedValue({
      id_rol: 21,
      codigo_rol_finca: 'ADMIN_FINCA',
      fecha_baja_rol: null,
      finca: null,
    });
    roles_service.find_rol_finca_by_codigo.mockResolvedValue({
      id_rol: 21,
      codigo_rol_finca: 'ADMIN_FINCA',
    });

    await service.asignar_propietario(1, 55, { id_usuario: 1 } as never);

    expect(usuario_finca_repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        usuario: expect.objectContaining({ id_usuario: 55 }),
        finca: expect.objectContaining({ id_finca: 1 }),
        fecha_fin_rol: null,
      }),
    );
    expect(usuario_finca_repo.save).toHaveBeenCalled();
  });

  it('cierra el propietario vigente al desvincularlo', async () => {
    const propietario = {
      id_usuario_finca: 10,
      fecha_fin_rol: null,
      usuario: { id_usuario: 55 },
      finca: { id_finca: 1 },
      rol_finca: { codigo_rol_finca: 'ADMIN_FINCA' },
    };
    usuario_finca_repo.findOne.mockResolvedValue(propietario);

    await service.asignar_propietario(1, null, { id_usuario: 1 } as never);

    expect(propietario.fecha_fin_rol).toEqual(expect.any(Date));
    expect(usuario_finca_repo.save).toHaveBeenCalledWith(propietario);
  });

  describe('alcance multi-finca', () => {
    const admin_multi_finca = {
      usuario_fincas: [
        {
          finca: { id_finca: 1, nombre_finca: 'Finca Demo Croply' },
          rol_finca: {
            codigo_rol_finca: CODIGO_ADMIN_FINCA,
            nombre_rol: 'Administrador de Finca',
          },
          fecha_fin_rol: null,
        },
        {
          finca: { id_finca: 2, nombre_finca: 'Finca Demo Sur' },
          rol_finca: {
            codigo_rol_finca: CODIGO_ADMIN_FINCA,
            nombre_rol: 'Administrador de Finca',
          },
          fecha_fin_rol: null,
        },
        {
          finca: { id_finca: 3, nombre_finca: 'Finca Ajena' },
          rol_finca: { codigo_rol_finca: 'F3_OPERARIO', nombre_rol: 'Operario' },
          fecha_fin_rol: null,
        },
      ],
    };

    it('devuelve todas las fincas vigentes del usuario para el selector', () => {
      const { fincas } = service.listar_mis_fincas(admin_multi_finca as never);

      expect(fincas.map((f) => f.id_finca)).toEqual([1, 2, 3]);
      expect(fincas[2].es_admin).toBe(false);
    });

    it('excluye vinculaciones vencidas', () => {
      const { fincas } = service.listar_mis_fincas({
        usuario_fincas: [
          {
            finca: { id_finca: 1, nombre_finca: 'Vencida' },
            rol_finca: { codigo_rol_finca: CODIGO_ADMIN_FINCA },
            fecha_fin_rol: new Date('2020-01-01T00:00:00Z'),
          },
        ],
      } as never);

      expect(fincas).toEqual([]);
    });

    it('resuelve las fincas con vinculación vigente', () => {
      expect(
        service.resolver_fincas_administradas(admin_multi_finca as never),
      ).toEqual([1, 2, 3]);
    });

    it('acota a una finca puntual y rechaza las que no tiene vigentes', () => {
      expect(
        service.resolver_fincas_administradas(admin_multi_finca as never, 2),
      ).toEqual([2]);

      expect(() =>
        service.resolver_fincas_administradas(admin_multi_finca as never, 99),
      ).toThrow(expect.objectContaining({ errorCode: 'RESOURCE_NOT_FOUND' }));
    });

    it('rechaza a quien no administra ninguna finca', () => {
      expect(() =>
        service.resolver_fincas_administradas({ usuario_fincas: [] } as never),
      ).toThrow(expect.objectContaining({ errorCode: 'FORBIDDEN' }));
    });

    it('lista solo fincas activas en la base y conserva el filtro por rol vigente', async () => {
      const usuario = {
        id_usuario: 55,
        usuario_fincas: [
          {
            finca: { id_finca: 1, nombre_finca: 'Finca Inactiva' },
            rol_finca: { codigo_rol_finca: CODIGO_ADMIN_FINCA },
            fecha_fin_rol: null,
          },
        ],
      };
      usuario_finca_repo.find.mockResolvedValue([
        {
          finca: {
            id_finca: 1,
            nombre_finca: 'Finca Inactiva',
            fecha_baja_finca: new Date('2026-01-01T00:00:00Z'),
          },
          fecha_fin_rol: null,
        },
        {
          finca: {
            id_finca: 2,
            nombre_finca: 'Finca Activa',
            fecha_baja_finca: null,
          },
          fecha_fin_rol: null,
        },
      ]);

      expect(service.listar_mis_fincas(usuario as never).fincas).toHaveLength(1);
      await expect(service.listar_mi_finca_fincas(usuario as never)).resolves.toEqual({
        fincas: [{ id_finca: 2, nombre_finca: 'Finca Activa' }],
      });
    });

    it('devuelve el resumen de una finca activa con sus parcelas activas', async () => {
      finca_repo.findOne.mockResolvedValue({
        id_finca: 12,
        nombre_finca: 'Finca La Esperanza',
        fecha_baja_finca: null,
        parcelas: [
          {
            id_parcela: 101,
            nombre_parcela: 'Lote Norte',
            estado_parcela: EstadoParcela.ACTIVA,
            fecha_baja_parcela: null,
          },
          {
            id_parcela: 102,
            nombre_parcela: 'Lote Sur',
            estado_parcela: EstadoParcela.INACTIVA,
            fecha_baja_parcela: new Date('2026-01-01T00:00:00Z'),
          },
        ],
      });

      await expect(service.resumen(12)).resolves.toEqual({
        id_finca: 12,
        nombre_finca: 'Finca La Esperanza',
        parcelas: [{
          id_parcela: 101,
          nombre_parcela: 'Lote Norte',
          estado_parcela: EstadoParcela.ACTIVA,
        }],
      });
    });

    it('rechaza el resumen de una finca inactiva', async () => {
      finca_repo.findOne.mockResolvedValue({
        id_finca: 12,
        nombre_finca: 'Finca Inactiva',
        fecha_baja_finca: new Date('2026-01-01T00:00:00Z'),
        parcelas: [],
      });

      await expect(service.resumen(12)).rejects.toMatchObject({
        errorCode: 'FINCA_NOT_AVAILABLE',
        status: HttpStatus.FORBIDDEN,
      });
    });
  });
});
