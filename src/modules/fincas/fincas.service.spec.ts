import { HttpStatus } from '@nestjs/common';
import { CODIGO_ADMIN_FINCA, EstadoInvitacion } from '../../common/enums';
import { FincasService } from './fincas.service';

describe('FincasService', () => {
  let service: FincasService;
  let finca_repo: Record<string, jest.Mock>;
  let usuario_finca_repo: Record<string, jest.Mock>;
  let invitacion_repo: Record<string, jest.Mock>;
  let roles_service: { find_rol_finca_by_id: jest.Mock };
  let mailer: { send_invitation: jest.Mock };
  let log_service: { registrar: jest.Mock };

  beforeEach(() => {
    finca_repo = {
      findOne: jest.fn().mockResolvedValue({
        id_finca: 1,
        fecha_baja_finca: null,
      }),
    };
    usuario_finca_repo = {
      createQueryBuilder: jest.fn(() => ({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      })),
      findOne: jest.fn(),
      save: jest.fn(async (x) => x),
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
    };
    mailer = { send_invitation: jest.fn().mockResolvedValue(undefined) };
    log_service = { registrar: jest.fn().mockResolvedValue(undefined) };

    service = new FincasService(
      finca_repo as never,
      usuario_finca_repo as never,
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
  });
});
