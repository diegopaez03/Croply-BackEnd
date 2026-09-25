import { HttpStatus } from '@nestjs/common';
import { EstadoPlanAccion } from '../../common/enums';
import { EstadoNotaCampo } from './entities/nota-campo.entity';
import { NotasCampoService } from './notas-campo.service';

function repo() {
  return {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ id_nota_campo: 88, ...value })),
  };
}

const autor = {
  id_usuario_finca: 34,
  fecha_fin_rol: null,
  usuario: { nombre: 'Roberto', apellido: 'Sánchez' },
  rol_finca: { nombre_rol: 'Encargado' },
  finca: { id_finca: 12 },
};

describe('NotasCampoService', () => {
  let service: NotasCampoService;
  let nota_repo: ReturnType<typeof repo>;
  let finca_repo: ReturnType<typeof repo>;
  let parcela_repo: ReturnType<typeof repo>;
  let usuario_finca_repo: ReturnType<typeof repo>;
  let plan_repo: ReturnType<typeof repo>;
  let hito_repo: ReturnType<typeof repo>;
  let planes_service: { crear_tarea: jest.Mock };

  beforeEach(() => {
    nota_repo = repo();
    finca_repo = repo();
    parcela_repo = repo();
    usuario_finca_repo = repo();
    plan_repo = repo();
    hito_repo = repo();
    planes_service = { crear_tarea: jest.fn() };
    service = new NotasCampoService(
      nota_repo as never,
      finca_repo as never,
      parcela_repo as never,
      usuario_finca_repo as never,
      plan_repo as never,
      hito_repo as never,
      planes_service as never,
    );
  });

  it('guarda una nota sincronizada con la fecha del servidor si no viene fecha', async () => {
    finca_repo.findOne.mockResolvedValue({ id_finca: 12, fecha_baja_finca: null });
    usuario_finca_repo.find.mockResolvedValue([autor]);

    const result = await service.crear(
      {
        id_finca: 12,
        id_parcela: null,
        contenido_nota_campo: '  Manchas foliares  ',
      },
      { id_usuario: 7 } as never,
    );

    expect(result.message).toBe('Nota guardada correctamente');
    expect(result.estado).toBe(EstadoNotaCampo.SINCRONIZADA);
    expect(result.contenido_nota_campo).toBe('Manchas foliares');
    expect(result.id_parcela).toBeNull();
    expect(result.nombre_usuario).toBe('Roberto Sánchez');
    expect(result.nombre_rol_finca).toBe('Encargado');
    expect(result.fecha_captura_nc).toEqual(expect.any(String));
  });

  it('persiste la fecha de captura cuando la nota viene de la cola offline', async () => {
    finca_repo.findOne.mockResolvedValue({ id_finca: 12, fecha_baja_finca: null });
    usuario_finca_repo.find.mockResolvedValue([autor]);

    const result = await service.crear(
      {
        id_finca: 12,
        contenido_nota_campo: 'Nota offline',
        fecha_captura_nc: '2026-09-20T09:15:00.000Z',
      },
      { id_usuario: 7 } as never,
    );

    expect(result.fecha_captura_nc).toBe('2026-09-20T09:15:00.000Z');
  });

  it('rechaza la nota si el usuario no tiene membresía vigente', async () => {
    finca_repo.findOne.mockResolvedValue({ id_finca: 12, fecha_baja_finca: null });
    usuario_finca_repo.find.mockResolvedValue([]);

    await expect(
      service.crear(
        { id_finca: 12, contenido_nota_campo: 'Nota' },
        { id_usuario: 7 } as never,
      ),
    ).rejects.toMatchObject({
      errorCode: 'FINCA_NOT_AVAILABLE',
      status: HttpStatus.FORBIDDEN,
    });
  });

  it('rechaza una parcela que no pertenece a la finca', async () => {
    finca_repo.findOne.mockResolvedValue({ id_finca: 12, fecha_baja_finca: null });
    usuario_finca_repo.find.mockResolvedValue([autor]);
    parcela_repo.findOne.mockResolvedValue(null);

    await expect(
      service.crear(
        {
          id_finca: 12,
          id_parcela: 999,
          contenido_nota_campo: 'Nota',
        },
        { id_usuario: 7 } as never,
      ),
    ).rejects.toMatchObject({ errorCode: 'RESOURCE_NOT_FOUND' });
  });

  it('lista las notas de la finca por fecha de captura descendente', async () => {
    finca_repo.findOne.mockResolvedValue({ id_finca: 12 });
    nota_repo.find.mockResolvedValue([
      {
        id_nota_campo: 88,
        contenido_nota_campo: 'Nota',
        fecha_captura_nc: new Date('2026-09-20T11:05:00.000Z'),
        estado: EstadoNotaCampo.SINCRONIZADA,
        parcela: null,
        usuario_finca: autor,
      },
    ]);

    const result = await service.listar_por_finca(12);

    expect(nota_repo.find).toHaveBeenCalledWith(
      expect.objectContaining({ order: { fecha_captura_nc: 'DESC' } }),
    );
    expect(result.notas[0]).toMatchObject({
      id_nota_campo: 88,
      id_parcela: null,
      nombre_parcela: null,
      nombre_rol_finca: 'Encargado',
    });
  });

  it('rechaza convertir una nota que ya fue convertida', async () => {
    nota_repo.findOne.mockResolvedValue({
      id_nota_campo: 88,
      estado: EstadoNotaCampo.CONVERTIDA_A_TAREA,
      tarea: { id_tarea: 501 },
      usuario_finca: { finca: { id_finca: 12 } },
    });

    await expect(
      service.convertir(88, { id_parcela: 101, id_hito_real: 201 } as never, {
        id_usuario: 7,
      } as never),
    ).rejects.toMatchObject({
      errorCode: 'NOTE_ALREADY_CONVERTED',
      status: HttpStatus.CONFLICT,
    });
  });

  it('rechaza convertir si la parcela no tiene plan activo', async () => {
    nota_repo.findOne.mockResolvedValue({
      id_nota_campo: 88,
      estado: EstadoNotaCampo.SINCRONIZADA,
      tarea: null,
      usuario_finca: { finca: { id_finca: 12 } },
    });
    usuario_finca_repo.find.mockResolvedValue([autor]);
    parcela_repo.findOne.mockResolvedValue({
      id_parcela: 101,
      finca: { id_finca: 12 },
    });
    plan_repo.count.mockResolvedValue(0);

    await expect(
      service.convertir(
        88,
        {
          id_parcela: 101,
          id_hito_real: 201,
          nombre_tarea: 'Fungicida',
          descripcion_tarea: 'Manchas',
          fecha_planificada_tarea: '2026-09-22',
          id_tipo_tarea: 2,
        },
        { id_usuario: 7 } as never,
      ),
    ).rejects.toMatchObject({
      errorCode: 'PARCEL_WITHOUT_ACTION_PLAN',
      status: HttpStatus.BAD_REQUEST,
    });
  });

  it('convierte la nota en una tarea del plan activo', async () => {
    const nota = {
      id_nota_campo: 88,
      estado: EstadoNotaCampo.SINCRONIZADA,
      tarea: null,
      usuario_finca: { finca: { id_finca: 12 } },
    };
    nota_repo.findOne.mockResolvedValue(nota);
    usuario_finca_repo.find.mockResolvedValue([autor]);
    parcela_repo.findOne.mockResolvedValue({
      id_parcela: 101,
      finca: { id_finca: 12 },
    });
    plan_repo.count.mockResolvedValue(1);
    hito_repo.findOne.mockResolvedValue({
      id_hito: 201,
      plan_accion: {
        id_plan_accion: 77,
        estado: EstadoPlanAccion.ACTIVO,
        parcela: { id_parcela: 101 },
      },
    });
    planes_service.crear_tarea.mockResolvedValue({
      message: 'Tarea agregada correctamente',
      id_tarea: 501,
      nombre_tarea: 'Fungicida',
    });

    const result = await service.convertir(
      88,
      {
        id_parcela: 101,
        id_hito_real: 201,
        nombre_tarea: 'Fungicida',
        descripcion_tarea: 'Manchas',
        fecha_planificada_tarea: '2026-09-22',
        id_tipo_tarea: 2,
      },
      { id_usuario: 7 } as never,
    );

    expect(planes_service.crear_tarea).toHaveBeenCalledWith(
      77,
      201,
      expect.objectContaining({ nombre_tarea: 'Fungicida' }),
    );
    expect(result.message).toBe('Nota convertida en tarea correctamente');
    expect(result.id_tarea).toBe(501);
    expect(nota.estado).toBe(EstadoNotaCampo.CONVERTIDA_A_TAREA);
  });
});
