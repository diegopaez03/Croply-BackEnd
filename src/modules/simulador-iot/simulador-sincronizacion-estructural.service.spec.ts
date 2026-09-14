import { SimuladorSincronizacionEstructuralService } from './simulador-sincronizacion-estructural.service';
import { EstadoTransmision } from '../../common/enums';

function parcela() {
  return {
    id_parcela: 3,
    nombre_parcela: 'Finca El Algarrobal',
    finca: { latitud: '-32.957431', longitud: '-68.771205' },
    controladores: [
      {
        id_controlador_sensor: 8,
        ip_controlador: '192.168.30.120',
        estado_controlador: EstadoTransmision.TRANSMITIENDO,
        fecha_baja: null,
        sensores: [
          {
            id_sensor: 17,
            fecha_baja: null,
            tipo_sensor: { codigo_tipo_sensor: 'PH' },
          },
          {
            id_sensor: 18,
            fecha_baja: new Date(),
            tipo_sensor: { codigo_tipo_sensor: 'RADIACION_SOLAR' },
          },
        ],
      },
      {
        id_controlador_sensor: 9,
        ip_controlador: '192.168.30.121',
        estado_controlador: EstadoTransmision.SIN_SENAL,
        fecha_baja: new Date(),
        sensores: [],
      },
    ],
  } as never;
}

describe('SimuladorSincronizacionEstructuralService', () => {
  let service: SimuladorSincronizacionEstructuralService;
  let axiosRef: {
    post: jest.Mock;
    put: jest.Mock;
    delete: jest.Mock;
  };
  let config: { get: jest.Mock };

  beforeEach(() => {
    axiosRef = {
      post: jest.fn().mockResolvedValue({ status: 201 }),
      put: jest.fn().mockResolvedValue({ status: 200 }),
      delete: jest.fn().mockResolvedValue({ status: 200 }),
    };
    config = { get: jest.fn().mockReturnValue('http://simulador.test') };
    service = new SimuladorSincronizacionEstructuralService(
      { axiosRef } as never,
      config as never,
    );
  });

  it('envía el body exacto del simulador al crear', async () => {
    await service.sincronizar_creacion(parcela());

    expect(axiosRef.post).toHaveBeenCalledWith('/parcelas', {
      parcela: {
        id: 3,
        nombre: 'Finca El Algarrobal',
        latitud: -32.957431,
        longitud: -68.771205,
        controladores: [
          {
            id: 8,
            ip: '192.168.30.120',
            estado: 'TRANSMITIENDO',
            sensores: [{ id: 17, tipo: 'PH' }],
          },
        ],
      },
    });
  });

  it('usa PUT completo para actualizar y DELETE sin body para dar de baja', async () => {
    await service.sincronizar_actualizacion(parcela());
    await service.sincronizar_baja(parcela());

    expect(axiosRef.put).toHaveBeenCalledWith(
      '/parcelas/3',
      expect.objectContaining({ parcela: expect.any(Object) }),
    );
    expect(axiosRef.delete).toHaveBeenCalledWith('/parcelas/3');
  });

  it('mapea Sin_senal al valor exacto del simulador', async () => {
    const datos = parcela() as {
      controladores: Array<{ estado_controlador: EstadoTransmision }>;
    };
    datos.controladores[0].estado_controlador = EstadoTransmision.SIN_SENAL;

    await service.sincronizar_creacion(datos as never);

    expect(axiosRef.post.mock.calls[0][1].parcela.controladores[0].estado).toBe(
      'SIN_SEÑAL',
    );
  });

  it('reintenta hasta tres veces después del primer fallo', async () => {
    axiosRef.post
      .mockRejectedValueOnce(new Error('1'))
      .mockRejectedValueOnce(new Error('2'))
      .mockRejectedValueOnce(new Error('3'))
      .mockResolvedValueOnce({ status: 201 });

    await service.sincronizar_creacion(parcela());

    expect(axiosRef.post).toHaveBeenCalledTimes(4);
  });
});
