import { HttpStatus } from '@nestjs/common';
import { EstadoInvitacion } from '../../common/enums';
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
});
