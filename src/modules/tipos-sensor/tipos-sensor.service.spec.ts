import { HttpStatus } from '@nestjs/common';
import { TipoOperacion } from '../../common/enums';
import { TiposSensorService } from './tipos-sensor.service';
import { CodigoTipoSensor } from './enums/codigo-tipo-sensor.enum';

describe('TiposSensorService', () => {
  let service: TiposSensorService;
  let tipo_sensor_repo: Record<string, jest.Mock>;
  let sensor_repo: { count: jest.Mock };
  let log_service: { registrar: jest.Mock };

  beforeEach(() => {
    tipo_sensor_repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(async (tipo_sensor) => ({
        id_tipo_sensor: 15,
        fecha_alta: new Date('2026-08-10T00:00:00.000Z'),
        fecha_baja: null,
        ...tipo_sensor,
      })),
      create: jest.fn((tipo_sensor) => tipo_sensor),
    };
    sensor_repo = { count: jest.fn().mockResolvedValue(0) };
    log_service = { registrar: jest.fn().mockResolvedValue(undefined) };

    service = new TiposSensorService(
      tipo_sensor_repo as never,
      sensor_repo as never,
      log_service as never,
    );
  });

  it('lista solo tipos de sensor activos', async () => {
    tipo_sensor_repo.find.mockResolvedValue([
      {
        id_tipo_sensor: 15,
        codigo_tipo_sensor: CodigoTipoSensor.PH,
        nombre_tipo_sensor: 'Sensor de pH',
        unidad_medida_ts: 'pH',
        fecha_baja: null,
      },
    ]);

    await expect(service.listar()).resolves.toEqual({
      tipos_sensor: [
        {
          id_tipo_sensor: 15,
          codigo_tipo_sensor: CodigoTipoSensor.PH,
          nombre_tipo_sensor: 'Sensor de pH',
          unidad_medida_ts: 'pH',
        },
      ],
    });
    expect(tipo_sensor_repo.find).toHaveBeenCalledWith({
      where: { fecha_baja: expect.anything() },
    });
  });

  it('devuelve tipos_sensor vacío si no hay tipos activos', async () => {
    tipo_sensor_repo.find.mockResolvedValue([]);

    await expect(service.listar()).resolves.toEqual({ tipos_sensor: [] });
  });

  it('crea un tipo de sensor válido y registra auditoría EXITO', async () => {
    const dto = {
      codigo_tipo_sensor: CodigoTipoSensor.PH,
      nombre_tipo_sensor: 'Sensor de pH',
      unidad_medida_ts: 'pH',
    };

    const result = await service.crear(dto, { id_usuario: 1 } as never);

    expect(tipo_sensor_repo.create).toHaveBeenCalledWith(dto);
    expect(tipo_sensor_repo.save).toHaveBeenCalled();
    expect(result).toMatchObject({
      message: 'Tipo de sensor creado correctamente.',
      id_tipo_sensor: 15,
      ...dto,
      fecha_baja: null,
    });
    expect(log_service.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ tipo_operacion: TipoOperacion.EXITO }),
    );
  });

  it('rechaza un código inválido con INVALID_SENSOR_TYPE_CODE', async () => {
    await expect(
      service.crear(
        {
          codigo_tipo_sensor: 'INVALIDO' as CodigoTipoSensor,
          nombre_tipo_sensor: 'Sensor inválido',
          unidad_medida_ts: 'u',
        },
        { id_usuario: 1 } as never,
      ),
    ).rejects.toMatchObject({
      errorCode: 'INVALID_SENSOR_TYPE_CODE',
      status: HttpStatus.BAD_REQUEST,
      field: 'codigo_tipo_sensor',
    });
    expect(tipo_sensor_repo.save).not.toHaveBeenCalled();
  });

  it('rechaza actualizar un tipo de sensor inexistente', async () => {
    tipo_sensor_repo.findOne.mockResolvedValue(null);

    await expect(
      service.actualizar(
        99,
        {
          codigo_tipo_sensor: CodigoTipoSensor.PH,
          nombre_tipo_sensor: 'Sensor de pH',
          unidad_medida_ts: 'pH',
        },
        { id_usuario: 1 } as never,
      ),
    ).rejects.toMatchObject({
      errorCode: 'RESOURCE_NOT_FOUND',
      status: HttpStatus.NOT_FOUND,
    });
  });

  it('actualiza un tipo de sensor y registra auditoría EXITO', async () => {
    const tipo_sensor = {
      id_tipo_sensor: 15,
      codigo_tipo_sensor: CodigoTipoSensor.PH,
      nombre_tipo_sensor: 'Sensor de pH',
      unidad_medida_ts: 'pH',
      fecha_baja: null,
    };
    tipo_sensor_repo.findOne.mockResolvedValue(tipo_sensor);

    const result = await service.actualizar(
      15,
      {
        codigo_tipo_sensor: CodigoTipoSensor.HUMEDAD_SUELO,
        nombre_tipo_sensor: 'Sensor de humedad del suelo',
        unidad_medida_ts: '%',
      },
      { id_usuario: 1 } as never,
    );

    expect(tipo_sensor_repo.save).toHaveBeenCalledWith(tipo_sensor);
    expect(result).toEqual({
      message: 'Tipo de sensor actualizado correctamente.',
      id_tipo_sensor: 15,
      codigo_tipo_sensor: CodigoTipoSensor.HUMEDAD_SUELO,
      nombre_tipo_sensor: 'Sensor de humedad del suelo',
      unidad_medida_ts: '%',
    });
    expect(log_service.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ tipo_operacion: TipoOperacion.EXITO }),
    );
  });

  it('da de baja un tipo de sensor sin sensores activos', async () => {
    const tipo_sensor = {
      id_tipo_sensor: 15,
      codigo_tipo_sensor: CodigoTipoSensor.PH,
      nombre_tipo_sensor: 'Sensor de pH',
      unidad_medida_ts: 'pH',
      fecha_baja: null,
    };
    tipo_sensor_repo.findOne.mockResolvedValue(tipo_sensor);

    const result = await service.dar_baja(15, { id_usuario: 1 } as never);

    expect(tipo_sensor.fecha_baja).toBeInstanceOf(Date);
    expect(tipo_sensor_repo.save).toHaveBeenCalledWith(tipo_sensor);
    expect(result).toEqual({
      message: 'Tipo de sensor dado de baja correctamente.',
      id_tipo_sensor: 15,
    });
    expect(log_service.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo_operacion: TipoOperacion.OPERACION_DESTRUCTIVA,
      }),
    );
  });

  it('bloquea la baja si hay sensores activos asociados (RESOURCE_IN_USE)', async () => {
    const tipo_sensor = {
      id_tipo_sensor: 15,
      codigo_tipo_sensor: CodigoTipoSensor.PH,
      nombre_tipo_sensor: 'Sensor de pH',
      unidad_medida_ts: 'pH',
      fecha_baja: null,
    };
    tipo_sensor_repo.findOne.mockResolvedValue(tipo_sensor);
    sensor_repo.count.mockResolvedValue(1);

    await expect(
      service.dar_baja(15, { id_usuario: 1 } as never),
    ).rejects.toMatchObject({
      errorCode: 'RESOURCE_IN_USE',
      status: HttpStatus.CONFLICT,
    });
    expect(tipo_sensor_repo.save).not.toHaveBeenCalled();
  });

  it('permite la baja si todos los sensores asociados están dados de baja', async () => {
    const tipo_sensor = {
      id_tipo_sensor: 15,
      codigo_tipo_sensor: CodigoTipoSensor.PH,
      nombre_tipo_sensor: 'Sensor de pH',
      unidad_medida_ts: 'pH',
      fecha_baja: null,
    };
    tipo_sensor_repo.findOne.mockResolvedValue(tipo_sensor);
    sensor_repo.count.mockResolvedValue(0);

    await expect(
      service.dar_baja(15, { id_usuario: 1 } as never),
    ).resolves.toMatchObject({
      message: 'Tipo de sensor dado de baja correctamente.',
      id_tipo_sensor: 15,
    });
  });

  it('rechaza dar de baja un tipo de sensor inexistente', async () => {
    tipo_sensor_repo.findOne.mockResolvedValue(null);

    await expect(
      service.dar_baja(99, { id_usuario: 1 } as never),
    ).rejects.toMatchObject({
      errorCode: 'RESOURCE_NOT_FOUND',
      status: HttpStatus.NOT_FOUND,
    });
  });

  it('devuelve los cinco códigos disponibles en el orden del enum', () => {
    expect(service.codigos_disponibles()).toEqual([
      'TEMP_HUME_AMBIENTAL',
      'HUMEDAD_SUELO',
      'RADIACION_SOLAR',
      'PRECIPITACION',
      'PH',
    ]);
  });
});
