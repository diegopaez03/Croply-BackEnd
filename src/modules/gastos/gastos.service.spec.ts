import { TipoOperacion } from '../../common/enums';
import { GastosService } from './gastos.service';

const PNG_1X1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function repo() {
  return {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
  };
}

const finca = {
  id_finca: 12,
  nombre_finca: 'Finca La Esperanza',
  fecha_baja_finca: null,
};

const responsable = {
  id_usuario_finca: 34,
  fecha_fin_rol: null,
  usuario: { nombre: 'Roberto', apellido: 'Sánchez' },
  finca: { id_finca: 12 },
};

function gasto_persistido(overrides: Record<string, unknown> = {}) {
  return {
    id_gasto_produccion: 88,
    nombre_insumo_gp: 'Fertilizante NPK',
    monto_gp: '45000.50',
    fecha_gp: '2026-09-20',
    nombre_responsable: 'Roberto Sánchez',
    fecha_alta_gp: new Date('2026-09-22T09:03:10Z'),
    fecha_modificacion_gp: null,
    fecha_baja_gp: null,
    finca,
    responsable,
    ...overrides,
  };
}

describe('GastosService', () => {
  let service: GastosService;
  let gasto_repo: ReturnType<typeof repo>;
  let finca_repo: ReturnType<typeof repo>;
  let usuario_finca_repo: ReturnType<typeof repo>;
  let log_service: { registrar: jest.Mock };

  beforeEach(() => {
    gasto_repo = repo();
    finca_repo = repo();
    usuario_finca_repo = repo();
    log_service = { registrar: jest.fn().mockResolvedValue(undefined) };
    service = new GastosService(
      gasto_repo as never,
      finca_repo as never,
      usuario_finca_repo as never,
      log_service as never,
    );
  });

  function mock_finca_y_responsable() {
    finca_repo.findOne.mockResolvedValue(finca);
    usuario_finca_repo.findOne.mockResolvedValue(responsable);
  }

  it('registra un gasto con el nombre del responsable congelado y deja log de éxito', async () => {
    mock_finca_y_responsable();
    gasto_repo.save.mockImplementation(async (value) => ({
      ...gasto_persistido(),
      ...value,
    }));

    const result = await service.crear(
      12,
      {
        nombre_insumo_gp: 'Fertilizante NPK',
        monto_gp: 45000.5,
        id_responsable: 34,
        fecha_gp: '2026-09-20',
      },
      { id_usuario: 7 } as never,
    );

    expect(result.message).toBe('Gasto registrado correctamente');
    expect(result.id_gasto_produccion).toBe(88);
    expect(result.nombre_responsable).toBe('Roberto Sánchez');
    expect(result.id_finca).toBe(12);
    expect(result.nombre_finca).toBe('Finca La Esperanza');
    expect(result.monto_gp).toBe(45000.5);
    expect(result.fecha_gp).toBe('2026-09-20');
    expect(log_service.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo_operacion: TipoOperacion.EXITO,
        recurso: 'GastoProduccion:88',
      }),
    );
  });

  it('rechaza una finca dada de baja con FINCA_NOT_AVAILABLE', async () => {
    finca_repo.findOne.mockResolvedValue({
      ...finca,
      fecha_baja_finca: new Date('2026-01-01T00:00:00Z'),
    });

    await expect(
      service.crear(
        12,
        {
          nombre_insumo_gp: 'Fertilizante NPK',
          monto_gp: 45000.5,
          id_responsable: 34,
          fecha_gp: '2026-09-20',
        },
        { id_usuario: 7 } as never,
      ),
    ).rejects.toMatchObject({ errorCode: 'FINCA_NOT_AVAILABLE' });
  });

  it('rechaza un responsable inexistente, de otra finca o no vigente', async () => {
    finca_repo.findOne.mockResolvedValue(finca);
    usuario_finca_repo.findOne.mockResolvedValue(null);

    await expect(
      service.crear(
        12,
        {
          nombre_insumo_gp: 'Fertilizante NPK',
          monto_gp: 100,
          id_responsable: 99,
          fecha_gp: '2026-09-20',
        },
        { id_usuario: 7 } as never,
      ),
    ).rejects.toMatchObject({ errorCode: 'RESOURCE_NOT_FOUND' });

    usuario_finca_repo.findOne.mockResolvedValue({
      ...responsable,
      finca: { id_finca: 99 },
    });

    await expect(
      service.crear(
        12,
        {
          nombre_insumo_gp: 'Fertilizante NPK',
          monto_gp: 100,
          id_responsable: 34,
          fecha_gp: '2026-09-20',
        },
        { id_usuario: 7 } as never,
      ),
    ).rejects.toMatchObject({ errorCode: 'RESOURCE_NOT_FOUND' });

    usuario_finca_repo.findOne.mockResolvedValue({
      ...responsable,
      fecha_fin_rol: new Date('2020-01-01T00:00:00Z'),
    });

    await expect(
      service.crear(
        12,
        {
          nombre_insumo_gp: 'Fertilizante NPK',
          monto_gp: 100,
          id_responsable: 34,
          fecha_gp: '2026-09-20',
        },
        { id_usuario: 7 } as never,
      ),
    ).rejects.toMatchObject({ errorCode: 'RESOURCE_NOT_FOUND' });
  });

  it('actualiza el gasto, setea fecha_modificacion_gp y congela el nuevo responsable', async () => {
    const nuevo_responsable = {
      id_usuario_finca: 41,
      fecha_fin_rol: null,
      usuario: { nombre: 'Ana', apellido: 'López' },
      finca: { id_finca: 12 },
    };
    finca_repo.findOne.mockResolvedValue(finca);
    gasto_repo.findOne.mockResolvedValue(gasto_persistido());
    usuario_finca_repo.findOne.mockResolvedValue(nuevo_responsable);
    gasto_repo.save.mockImplementation(async (value) => value);

    const result = await service.actualizar(
      12,
      88,
      {
        nombre_insumo_gp: 'Fertilizante NPK Plus',
        monto_gp: 47000,
        id_responsable: 41,
        fecha_gp: '2026-09-21',
      },
      { id_usuario: 7 } as never,
    );

    expect(result.message).toBe('Gasto actualizado correctamente');
    expect(result.nombre_insumo_gp).toBe('Fertilizante NPK Plus');
    expect(result.monto_gp).toBe(47000);
    expect(result.id_responsable).toBe(41);
    expect(result.nombre_responsable).toBe('Ana López');
    expect(result.fecha_modificacion_gp).toEqual(expect.any(String));
    expect(log_service.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ tipo_operacion: TipoOperacion.EXITO }),
    );
  });

  it('permite conservar un responsable ya inactivo si no se lo cambia', async () => {
    const inactivo = {
      ...responsable,
      fecha_fin_rol: new Date('2020-01-01T00:00:00Z'),
    };
    finca_repo.findOne.mockResolvedValue(finca);
    gasto_repo.findOne.mockResolvedValue(
      gasto_persistido({ responsable: inactivo }),
    );
    gasto_repo.save.mockImplementation(async (value) => value);

    const result = await service.actualizar(
      12,
      88,
      {
        nombre_insumo_gp: 'Fertilizante NPK Plus',
        monto_gp: 47000,
        id_responsable: 34,
        fecha_gp: '2026-09-21',
      },
      { id_usuario: 7 } as never,
    );

    expect(result.nombre_responsable).toBe('Roberto Sánchez');
    expect(usuario_finca_repo.findOne).not.toHaveBeenCalled();
  });

  it('da de baja lógica el gasto y registra operación destructiva', async () => {
    finca_repo.findOne.mockResolvedValue(finca);
    gasto_repo.findOne.mockResolvedValue(gasto_persistido());
    gasto_repo.save.mockImplementation(async (value) => value);

    const result = await service.dar_baja(12, 88, { id_usuario: 7 } as never);

    expect(result.message).toBe('Gasto eliminado correctamente');
    expect(gasto_repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ fecha_baja_gp: expect.any(Date) }),
    );
    expect(log_service.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo_operacion: TipoOperacion.OPERACION_DESTRUCTIVA,
        recurso: 'GastoProduccion:88',
      }),
    );
  });

  it('lista gastos activos ordenados y pagina de a 10', async () => {
    finca_repo.findOne.mockResolvedValue(finca);
    const filas = [
      gasto_persistido({
        id_gasto_produccion: 2,
        fecha_gp: '2026-09-21',
        fecha_alta_gp: new Date('2026-09-22T10:00:00Z'),
        monto_gp: '100',
      }),
      gasto_persistido({
        id_gasto_produccion: 1,
        fecha_gp: '2026-09-21',
        fecha_alta_gp: new Date('2026-09-22T09:00:00Z'),
        monto_gp: '50',
      }),
      gasto_persistido({
        id_gasto_produccion: 3,
        fecha_gp: '2026-08-01',
        monto_gp: '25',
      }),
    ];
    gasto_repo.find.mockResolvedValue(filas);

    const result = await service.listar(12, { page: 1, pageSize: 2 });

    expect(result.gastos.map((g) => g.id_gasto_produccion)).toEqual([2, 1]);
    expect(result.total).toBe(3);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(2);
    expect(result.monto_total).toBe(175);
    expect(result.etiqueta_periodo).toBe('mes_actual');
  });

  it('pagina de a 10 en la página 2 aunque pageSize llegue como string', async () => {
    finca_repo.findOne.mockResolvedValue(finca);
    const filas = Array.from({ length: 12 }, (_, index) =>
      gasto_persistido({
        id_gasto_produccion: index + 1,
        fecha_gp: `2026-08-${String(index + 1).padStart(2, '0')}`,
        fecha_alta_gp: new Date(`2026-08-${String(index + 1).padStart(2, '0')}T10:00:00Z`),
      }),
    );
    gasto_repo.find.mockResolvedValue(filas);

    const result = await service.listar(12, {
      page: 2,
      pageSize: '10' as unknown as number,
    });

    expect(result.gastos).toHaveLength(2);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
    expect(result.total).toBe(12);
  });

  it('usa el total del rango filtrado y etiqueta rango_filtrado', async () => {
    finca_repo.findOne.mockResolvedValue(finca);
    gasto_repo.find.mockResolvedValue([
      gasto_persistido({ monto_gp: '1000.00', fecha_gp: '2026-09-10' }),
      gasto_persistido({
        id_gasto_produccion: 89,
        monto_gp: '500.50',
        fecha_gp: '2026-09-20',
      }),
    ]);

    const result = await service.listar(12, {
      page: 1,
      pageSize: 10,
      fecha_desde: '2026-09-01',
      fecha_hasta: '2026-09-30',
    });

    expect(result.monto_total).toBe(1500.5);
    expect(result.monto_total_periodo).toBe(1500.5);
    expect(result.etiqueta_periodo).toBe('rango_filtrado');
    expect(gasto_repo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        order: { fecha_gp: 'DESC', fecha_alta_gp: 'DESC' },
      }),
    );
  });

  it('rechaza un rango invertido en listar, evolución y exportar', async () => {
    finca_repo.findOne.mockResolvedValue(finca);

    await expect(
      service.listar(12, {
        fecha_desde: '2026-09-30',
        fecha_hasta: '2026-09-01',
      }),
    ).rejects.toMatchObject({ errorCode: 'INVALID_DATE_RANGE' });

    await expect(
      service.evolucion_mensual(12, {
        fecha_desde: '2026-09-30',
        fecha_hasta: '2026-09-01',
      }),
    ).rejects.toMatchObject({ errorCode: 'INVALID_DATE_RANGE' });

    await expect(
      service.exportar(12, {
        fecha_desde: '2026-09-30',
        fecha_hasta: '2026-09-01',
        imagen_grafico: PNG_1X1,
      }),
    ).rejects.toMatchObject({ errorCode: 'INVALID_DATE_RANGE' });

    expect(gasto_repo.find).not.toHaveBeenCalled();
  });

  it('devuelve evolución mensual como array plano con ceros y vacío si no hay gastos', async () => {
    finca_repo.findOne.mockResolvedValue(finca);
    gasto_repo.find.mockResolvedValueOnce([]);

    await expect(service.evolucion_mensual(12, {})).resolves.toEqual([]);

    gasto_repo.find.mockResolvedValueOnce([
      gasto_persistido({ fecha_gp: '2026-04-10', monto_gp: '12000' }),
      gasto_persistido({
        id_gasto_produccion: 89,
        fecha_gp: '2026-06-01',
        monto_gp: '3000',
      }),
    ]);

    const meses = await service.evolucion_mensual(12, {
      fecha_desde: '2026-04-01',
      fecha_hasta: '2026-06-30',
    });

    expect(meses).toEqual([
      { mes: '2026-04', monto: 12000 },
      { mes: '2026-05', monto: 0 },
      { mes: '2026-06', monto: 3000 },
    ]);
  });

  it('rechaza exportar sin filas y arma un PDF válido con el nombre de la finca', async () => {
    finca_repo.findOne.mockResolvedValue(finca);
    gasto_repo.find.mockResolvedValueOnce([]);

    await expect(
      service.exportar(12, { imagen_grafico: PNG_1X1 }),
    ).rejects.toMatchObject({ errorCode: 'EMPTY_EXPORT_RESULT' });

    gasto_repo.find.mockResolvedValueOnce([
      gasto_persistido({ monto_gp: '45000.50' }),
    ]);

    const archivo = await service.exportar(12, {
      fecha_desde: '2026-09-01',
      fecha_hasta: '2026-09-30',
      imagen_grafico: PNG_1X1,
    });

    expect(archivo.buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(archivo.filename).toMatch(
      /^costos_finca-la-esperanza_\d{4}-\d{2}-\d{2}\.pdf$/,
    );
  });
});
