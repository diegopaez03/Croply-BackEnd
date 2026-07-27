import { EstadoSolicitud } from '../../common/enums';
import { SolicitudesDigitalizacionService } from './solicitudes-digitalizacion.service';

describe('SolicitudesDigitalizacionService', () => {
  let service: SolicitudesDigitalizacionService;
  let solicitud_repo: {
    create: jest.Mock;
    save: jest.Mock;
    findAndCount: jest.Mock;
    findOne: jest.Mock;
  };
  let log_service: { registrar: jest.Mock };

  beforeEach(() => {
    solicitud_repo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({
        ...x,
        id_solicitud_df: 801,
        fecha_solicitud: new Date('2026-07-14T19:40:00Z'),
        estado: x.estado ?? EstadoSolicitud.PENDIENTE,
      })),
      findAndCount: jest.fn(),
      findOne: jest.fn(),
    };
    log_service = { registrar: jest.fn().mockResolvedValue(undefined) };
    service = new SolicitudesDigitalizacionService(
      solicitud_repo as never,
      log_service as never,
    );
  });

  it('crea solicitud pendiente y devuelve message e id_solicitud_df', async () => {
    const result = await service.crear({
      nombre_completo: 'Pedro Picapiedra',
      correo_electronico: 'pedro@cantera.com',
      telefono_contacto: '+5493512345678',
      provincia: 'Córdoba',
      departamento: 'Capital',
      localidad: 'Córdoba',
      numero_parcelas: 4,
      superficie_total_hectareas: 150.5,
      comentario_adicional:
        'Finca dedicada al cultivo de maíz primavera-verano.',
    });

    expect(result).toEqual({
      message:
        '¡Solicitud enviada con éxito! Nuestro equipo se pondrá en contacto a la brevedad.',
      id_solicitud_df: 801,
      nombre_completo: 'Pedro Picapiedra',
      correo_electronico: 'pedro@cantera.com',
      estado: EstadoSolicitud.PENDIENTE,
      fecha_solicitud: '2026-07-14T19:40:00.000Z',
    });
    expect(log_service.registrar).toHaveBeenCalled();
  });

  it('lista solicitudes ordenadas con paginación', async () => {
    solicitud_repo.findAndCount.mockResolvedValue([
      [
        {
          id_solicitud_df: 801,
          fecha_solicitud: new Date('2026-07-14T19:40:00Z'),
          nombre_completo: 'Pedro Picapiedra',
          correo_electronico: 'pedro@cantera.com',
          telefono_contacto: '+5493512345678',
          estado: EstadoSolicitud.PENDIENTE,
        },
      ],
      1,
    ]);

    const result = await service.listar({ page: 1, pageSize: 10 });
    expect(result.solicitudes).toHaveLength(1);
    expect(result.pagination.totalItems).toBe(1);
  });

  it('actualiza estado de solicitud', async () => {
    solicitud_repo.findOne.mockResolvedValue({
      id_solicitud_df: 801,
      estado: EstadoSolicitud.PENDIENTE,
    });

    const result = await service.actualizar_estado(
      801,
      { estado: EstadoSolicitud.CONTACTADO },
      { id_usuario: 1 } as never,
    );

    expect(result.message).toBe('Estado actualizado correctamente.');
  });
});
