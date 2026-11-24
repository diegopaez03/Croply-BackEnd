import { CODIGO_ADMIN_FINCA, EstadoTransmision } from '../../common/enums';
import {
  MESES_EVOLUCION_FINCAS,
  TableroGlobalService,
  ZONA_HORARIA_TABLERO,
} from './tablero-global.service';

function query_builder(raw: { one?: unknown; many?: unknown[] } = {}) {
  const qb: Record<string, jest.Mock> = {};
  for (const metodo of [
    'innerJoin',
    'select',
    'addSelect',
    'where',
    'andWhere',
    'groupBy',
    'from',
    'setParameters',
  ]) {
    qb[metodo] = jest.fn(() => qb);
  }
  qb.getQuery = jest.fn(() => 'SELECT 1');
  qb.getParameters = jest.fn(() => ({ codigo_admin_finca: CODIGO_ADMIN_FINCA }));
  qb.getRawOne = jest.fn().mockResolvedValue(raw.one);
  qb.getRawMany = jest.fn().mockResolvedValue(raw.many ?? []);
  return qb;
}

const SEIS_MESES = [
  { mes: '2026-05', nuevas_fincas: '2' },
  { mes: '2026-06', nuevas_fincas: '0' },
  { mes: '2026-07', nuevas_fincas: '1' },
  { mes: '2026-08', nuevas_fincas: '0' },
  { mes: '2026-09', nuevas_fincas: '3' },
  { mes: '2026-10', nuevas_fincas: '0' },
];

describe('TableroGlobalService', () => {
  let service: TableroGlobalService;
  let finca_repo: { createQueryBuilder: jest.Mock; query: jest.Mock };
  let sensor_repo: { createQueryBuilder: jest.Mock };
  let usuario_finca_repo: {
    createQueryBuilder: jest.Mock;
    manager: { createQueryBuilder: jest.Mock };
  };
  let hectareas_qb: ReturnType<typeof query_builder>;
  let sensores_qb: ReturnType<typeof query_builder>;
  let clientes_sub_qb: ReturnType<typeof query_builder>;
  let clientes_qb: ReturnType<typeof query_builder>;

  function mock_datos({
    sensores = [],
    hectareas = { total: '0', provincias: '0' },
    clientes = { total: '0', nuevos_este_mes: '0' },
    evolucion = SEIS_MESES,
  }: {
    sensores?: { estado_senal: EstadoTransmision; cantidad: string }[];
    hectareas?: unknown;
    clientes?: unknown;
    evolucion?: typeof SEIS_MESES;
  } = {}) {
    hectareas_qb = query_builder({ one: hectareas });
    sensores_qb = query_builder({ many: sensores });
    clientes_sub_qb = query_builder();
    clientes_qb = query_builder({ one: clientes });
    finca_repo.createQueryBuilder.mockReturnValue(hectareas_qb);
    finca_repo.query.mockResolvedValue(evolucion);
    sensor_repo.createQueryBuilder.mockReturnValue(sensores_qb);
    usuario_finca_repo.createQueryBuilder.mockReturnValue(clientes_sub_qb);
    usuario_finca_repo.manager.createQueryBuilder.mockReturnValue(clientes_qb);
  }

  beforeEach(() => {
    finca_repo = { createQueryBuilder: jest.fn(), query: jest.fn() };
    sensor_repo = { createQueryBuilder: jest.fn() };
    usuario_finca_repo = {
      createQueryBuilder: jest.fn(),
      manager: { createQueryBuilder: jest.fn() },
    };
    service = new TableroGlobalService(
      finca_repo as never,
      sensor_repo as never,
      usuario_finca_repo as never,
    );
  });

  it('devuelve el shape anidado esperado, sin crecimiento_porcentaje ni estado', async () => {
    mock_datos({
      sensores: [
        { estado_senal: EstadoTransmision.TRANSMITIENDO, cantidad: '23030' },
        { estado_senal: EstadoTransmision.SIN_SENAL, cantidad: '1894' },
      ],
      hectareas: { total: '15420.5', provincias: '9' },
      clientes: { total: '128', nuevos_este_mes: '7' },
    });

    const result = await service.obtener_tablero();

    expect(result).toEqual({
      clientes: { total: 128, nuevos_este_mes: 7 },
      sensores: {
        activos: 23030,
        porcentaje_parque_total: 92.4,
        total_activos: 23030,
        total_inactivos: 1894,
      },
      hectareas: { total: 15420.5, provincias: 9 },
      evolucion_fincas: [
        { mes: '2026-05', nuevas_fincas: 2 },
        { mes: '2026-06', nuevas_fincas: 0 },
        { mes: '2026-07', nuevas_fincas: 1 },
        { mes: '2026-08', nuevas_fincas: 0 },
        { mes: '2026-09', nuevas_fincas: 3 },
        { mes: '2026-10', nuevas_fincas: 0 },
      ],
    });
    expect(result.clientes).not.toHaveProperty('crecimiento_porcentaje');
    expect(result.sensores).not.toHaveProperty('estado');
    expect(result.sensores.activos).toBe(result.sensores.total_activos);
  });

  it('devuelve porcentaje 0 cuando no hay sensores vivos (sin dividir por cero)', async () => {
    mock_datos({ sensores: [] });

    const { sensores } = await service.obtener_tablero();

    expect(sensores).toEqual({
      activos: 0,
      porcentaje_parque_total: 0,
      total_activos: 0,
      total_inactivos: 0,
    });
  });

  it('redondea el porcentaje del parque a 1 decimal', async () => {
    mock_datos({
      sensores: [
        { estado_senal: EstadoTransmision.TRANSMITIENDO, cantidad: '2' },
        { estado_senal: EstadoTransmision.SIN_SENAL, cantidad: '1' },
      ],
    });

    const { sensores } = await service.obtener_tablero();

    expect(sensores.porcentaje_parque_total).toBe(66.7);
  });

  it('da 100% cuando todos los sensores transmiten', async () => {
    mock_datos({
      sensores: [{ estado_senal: EstadoTransmision.TRANSMITIENDO, cantidad: '5' }],
    });

    const { sensores } = await service.obtener_tablero();

    expect(sensores.porcentaje_parque_total).toBe(100);
    expect(sensores.total_inactivos).toBe(0);
  });

  it('filtra sensores vivos y agrupa por estado_senal', async () => {
    mock_datos();

    await service.obtener_tablero();

    expect(sensores_qb.groupBy).toHaveBeenCalledWith('s.estado_senal');
    expect(sensores_qb.where).toHaveBeenCalledWith('s.fecha_baja IS NULL');
    expect(sensores_qb.andWhere).toHaveBeenCalledWith('c.fecha_baja IS NULL');
    expect(sensores_qb.andWhere).toHaveBeenCalledWith('p.fecha_baja_parcela IS NULL');
    expect(sensores_qb.andWhere).toHaveBeenCalledWith('f.fecha_baja_finca IS NULL');
  });

  it('cuenta clientes con vínculo ADMIN_FINCA vigente usando la constante del dominio', async () => {
    mock_datos({ clientes: { total: '3', nuevos_este_mes: '1' } });

    const { clientes } = await service.obtener_tablero();

    expect(clientes).toEqual({ total: 3, nuevos_este_mes: 1 });
    expect(clientes_sub_qb.where).toHaveBeenCalledWith('uf.fecha_fin_rol IS NULL');
    expect(clientes_sub_qb.andWhere).toHaveBeenCalledWith(
      'r.codigo_rol_finca = :codigo_admin_finca',
      { codigo_admin_finca: CODIGO_ADMIN_FINCA },
    );
    expect(clientes_sub_qb.andWhere).toHaveBeenCalledWith('f.fecha_baja_finca IS NULL');
    expect(clientes_sub_qb.andWhere).toHaveBeenCalledWith('u.fecha_baja IS NULL');
    expect(clientes_qb.setParameters).toHaveBeenCalledWith(
      expect.objectContaining({ tz: ZONA_HORARIA_TABLERO }),
    );
  });

  it('devuelve 0 en hectáreas y clientes cuando no hay filas', async () => {
    mock_datos({ hectareas: undefined, clientes: undefined });

    const result = await service.obtener_tablero();

    expect(result.hectareas).toEqual({ total: 0, provincias: 0 });
    expect(result.clientes).toEqual({ total: 0, nuevos_este_mes: 0 });
  });

  it('evolucion_fincas devuelve 6 meses en formato YYYY-MM y en zona de Buenos Aires', async () => {
    mock_datos();

    const { evolucion_fincas } = await service.obtener_tablero();

    expect(evolucion_fincas).toHaveLength(6);
    evolucion_fincas.forEach((item) => {
      expect(item.mes).toMatch(/^\d{4}-\d{2}$/);
      expect(typeof item.nuevas_fincas).toBe('number');
    });
    const [sql, params] = finca_repo.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('generate_series');
    expect(sql).not.toContain('fecha_baja_finca');
    expect(params).toEqual([ZONA_HORARIA_TABLERO, MESES_EVOLUCION_FINCAS]);
  });
});
