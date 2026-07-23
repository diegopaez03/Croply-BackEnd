import { EstadoSolicitud } from '../../common/enums';
import { SolicitudesDigitalizacionService } from './solicitudes-digitalizacion.service';

describe('SolicitudesDigitalizacionService', () => {
  let service: SolicitudesDigitalizacionService;
  let solicitud_repo: {
    create: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(() => {
    solicitud_repo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({
        ...x,
        id_solicitud_df: 801,
        fecha_solicitud: new Date('2026-07-14T19:40:00Z'),
        estado: EstadoSolicitud.PENDIENTE,
      })),
    };
    service = new SolicitudesDigitalizacionService(solicitud_repo as never);
  });

  it('crea solicitud pendiente y devuelve message e id_Solicitud', async () => {
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
      id_Solicitud: 801,
      nombre_completo: 'Pedro Picapiedra',
      correo_electronico: 'pedro@cantera.com',
      estado: EstadoSolicitud.PENDIENTE,
      fecha_solicitud: '2026-07-14T19:40:00.000Z',
    });
  });
});
