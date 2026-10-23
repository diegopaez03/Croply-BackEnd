import { HttpStatus } from '@nestjs/common';
import { aiServiceUnavailable } from '../../common/exceptions';
import { RecomendacionesIaService } from './recomendaciones-ia.service';

const PRONOSTICO = {
  temp_actual: 20,
  humedad_relativa: 40,
  temp_min_pronostico: 10,
  temp_max_pronostico: 30,
  precip_pronostico_24h: 0,
  viento_kmh: 12,
  wind_gust_kmh: 16,
  et0_diario: 5,
};

function recomendacion(overrides: Record<string, unknown> = {}) {
  return {
    id_recomendacion: 412,
    accion_recomendada: 'REGAR_URGENTE',
    severidad: 'Alta',
    sensor_origen_principal: 'humedad_suelo_pct',
    factores_clave: [{ sensor_ui: 'humedad_suelo_pct', valor: 14.8 }],
    titulo_corto: 'Riego urgente recomendado',
    texto_breve: 'Humedad del suelo baja.',
    texto_explicativo_extendido: 'Regar el lote.',
    fecha_generacion: new Date('2026-10-23T15:00:00Z'),
    valida_hasta: new Date(Date.now() + 30 * 60_000),
    fuente_generacion: 'ollama_gemma4',
    ...overrides,
  };
}

function evaluacion(overrides: Record<string, unknown> = {}) {
  return {
    accion_recomendada: 'SUSPENDER_RIEGO',
    severidad: 'Media',
    sensor_origen_principal: 'lluvia_mm_24h',
    explicabilidad_top3_factores: [{ sensor_ui: 'lluvia_mm_24h', valor: 12 }],
    recomendacion_vigente: {
      titulo_corto: 'Suspender riego',
      texto_breve: 'Llovió suficiente.',
      texto_explicativo_extendido: 'No hace falta regar.',
    },
    fuente_generacion: 'ollama_gemma4',
    ...overrides,
  };
}

describe('RecomendacionesIaService', () => {
  let service: RecomendacionesIaService;
  let recomendacion_repo: { findOne: jest.Mock };
  let parcela_repo: { findOne: jest.Mock };
  let plan_repo: { findOne: jest.Mock };
  let clima_service: { obtener_variables_pronostico: jest.Mock };
  let ai_service: { evaluate_parcel: jest.Mock };
  let repo_tx: { save: jest.Mock; create: jest.Mock };

  beforeEach(() => {
    recomendacion_repo = { findOne: jest.fn().mockResolvedValue(null) };
    parcela_repo = {
      findOne: jest.fn().mockResolvedValue({
        id_parcela: 101,
        finca: { id_finca: 12, fecha_baja_finca: null },
        controladores: [],
      }),
    };
    plan_repo = {
      findOne: jest.fn().mockResolvedValue({
        fecha_inicio_pa: '2026-08-01',
        cultivo_base: { nombre_cultivo_base: 'Tomate' },
        variedad: { nombre_variedad: 'Perita' },
        hitos: [],
      }),
    };
    clima_service = {
      obtener_variables_pronostico: jest.fn().mockResolvedValue(PRONOSTICO),
    };
    ai_service = { evaluate_parcel: jest.fn() };
    repo_tx = {
      create: jest.fn(<T>(data: T): T => data),
      save: jest.fn(
        <T extends { id_recomendacion?: number }>(entity: T) =>
          Promise.resolve({
            ...entity,
            id_recomendacion: entity.id_recomendacion ?? 50,
          }),
      ),
    };
    const data_source = {
      transaction: jest.fn(
        (cb: (manager: { getRepository: () => typeof repo_tx }) => unknown) =>
          cb({ getRepository: () => repo_tx }),
      ),
    };

    service = new RecomendacionesIaService(
      recomendacion_repo as never,
      parcela_repo as never,
      plan_repo as never,
      clima_service as never,
      ai_service as never,
      data_source as never,
    );
  });

  it('devuelve la caché vigente sin consultar al servicio de IA', async () => {
    recomendacion_repo.findOne.mockResolvedValue(recomendacion());

    const result = await service.obtener_recomendacion(101);

    expect(result?.origen_datos).toBe('CACHE_VIGENTE');
    expect(result?.titulo_corto).toBe('Riego urgente recomendado');
    expect(ai_service.evaluate_parcel).not.toHaveBeenCalled();
    expect(clima_service.obtener_variables_pronostico).not.toHaveBeenCalled();
  });

  it('responde vacío si la caché vigente no tiene textos', async () => {
    recomendacion_repo.findOne.mockResolvedValue(
      recomendacion({
        titulo_corto: null,
        texto_breve: null,
        texto_explicativo_extendido: null,
      }),
    );

    await expect(service.obtener_recomendacion(101)).resolves.toBeNull();
    expect(ai_service.evaluate_parcel).not.toHaveBeenCalled();
  });

  it('renueva la vigencia y conserva los textos si la acción no cambia', async () => {
    const previa = recomendacion({
      valida_hasta: new Date(Date.now() - 60_000),
    });
    recomendacion_repo.findOne.mockResolvedValue(previa);
    ai_service.evaluate_parcel.mockResolvedValue(
      evaluacion({
        accion_recomendada: 'REGAR_URGENTE',
        severidad: 'Media',
        sensor_origen_principal: 'humedad_suelo_pct',
      }),
    );
    const antes = Date.now();

    const result = await service.obtener_recomendacion(101);

    expect(result?.origen_datos).toBe('CACHE_RENOVADA_SIN_LLM');
    expect(result?.titulo_corto).toBe('Riego urgente recomendado');
    expect(result?.texto_breve).toBe('Humedad del suelo baja.');
    expect(result?.severidad).toBe('Media');
    expect(result?.fecha_generacion).toBe('2026-10-23T15:00:00.000Z');
    if (!result) {
      throw new Error('se esperaba una recomendación');
    }
    const hasta = new Date(result.valida_hasta).getTime();
    expect(hasta).toBeGreaterThanOrEqual(antes + 60 * 60 * 1000 - 1000);
    expect(hasta).toBeLessThanOrEqual(Date.now() + 60 * 60 * 1000 + 1000);
    expect(ai_service.evaluate_parcel).toHaveBeenCalledWith(
      expect.objectContaining({ accion_previa: 'REGAR_URGENTE', cultivo: 'tomate' }),
    );
  });

  it('persiste una evaluación nueva cuando la acción cambia', async () => {
    recomendacion_repo.findOne.mockResolvedValue(
      recomendacion({ valida_hasta: new Date(Date.now() - 60_000) }),
    );
    ai_service.evaluate_parcel.mockResolvedValue(evaluacion());

    const result = await service.obtener_recomendacion(101);

    expect(result?.origen_datos).toBe('NUEVA_EVALUACION_LLM');
    expect(result?.accion_recomendada).toBe('SUSPENDER_RIEGO');
    expect(result?.titulo_corto).toBe('Suspender riego');
  });

  it('marca el fallback determinista de INTA', async () => {
    ai_service.evaluate_parcel.mockResolvedValue(
      evaluacion({ fuente_generacion: 'fallback_determinista_inta' }),
    );

    const result = await service.obtener_recomendacion(101);

    expect(result?.origen_datos).toBe('FALLBACK_INTA');
  });

  it('guarda la vigencia y no devuelve cuerpo si el lote está en estado óptimo', async () => {
    ai_service.evaluate_parcel.mockResolvedValue(
      evaluacion({
        accion_recomendada: 'ESTADO_OPTIMO_SIN_ACCION',
        fuente_generacion: 'estado_optimo_sin_accion',
        recomendacion_vigente: null,
      }),
    );

    await expect(service.obtener_recomendacion(101)).resolves.toBeNull();
    expect(repo_tx.save).toHaveBeenCalledWith(
      expect.objectContaining({
        accion_recomendada: 'ESTADO_OPTIMO_SIN_ACCION',
        titulo_corto: null,
      }),
    );
  });

  it('propaga AI_SERVICE_UNAVAILABLE si el motor no responde', async () => {
    ai_service.evaluate_parcel.mockRejectedValue(aiServiceUnavailable());

    await expect(service.obtener_recomendacion(101)).rejects.toMatchObject({
      errorCode: 'AI_SERVICE_UNAVAILABLE',
      status: HttpStatus.SERVICE_UNAVAILABLE,
    });
  });

  it('rechaza una parcela sin plan de acción activo', async () => {
    plan_repo.findOne.mockResolvedValue(null);

    await expect(service.obtener_recomendacion(101)).rejects.toMatchObject({
      errorCode: 'PARCEL_WITHOUT_ACTION_PLAN',
    });
    expect(ai_service.evaluate_parcel).not.toHaveBeenCalled();
  });
});
