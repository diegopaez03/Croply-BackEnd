import { HttpStatus } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TipoOperacion } from '../../common/enums';
import { CrearPreguntaFrecuenteDto } from './dto/crear-pregunta-frecuente.dto';
import { PreguntasFrecuentesService } from './preguntas-frecuentes.service';

describe('PreguntasFrecuentesService', () => {
  let service: PreguntasFrecuentesService;
  let pregunta_frecuente_repo: Record<string, jest.Mock>;
  let log_service: { registrar: jest.Mock };
  const actor = { id_usuario: 1 } as never;

  beforeEach(() => {
    pregunta_frecuente_repo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      save: jest.fn((pregunta: Record<string, unknown>) =>
        Promise.resolve({
          id_pregunta_frecuente: '7',
          fecha_alta_pf: new Date('2026-10-20T00:00:00.000Z'),
          fecha_baja_pf: null,
          ...pregunta,
        }),
      ),
      create: jest.fn((pregunta: Record<string, unknown>) => pregunta),
    };
    log_service = { registrar: jest.fn().mockResolvedValue(undefined) };

    service = new PreguntasFrecuentesService(
      pregunta_frecuente_repo as never,
      log_service as never,
    );
  });

  describe('crear', () => {
    it('crea la pregunta, devuelve el contrato y registra auditoría EXITO', async () => {
      const dto = {
        pregunta: '¿Cómo registro una aplicación de agroquímico?',
        respuesta: 'Ingresá a Agroquímicos.\nPresioná "Registrar Aplicación".',
      };

      const result = await service.crear(dto, actor);

      expect(pregunta_frecuente_repo.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual({
        message: 'Pregunta frecuente creada correctamente.',
        id_pregunta_frecuente: 7,
        ...dto,
      });
      expect(log_service.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo_operacion: TipoOperacion.EXITO,
          recurso: 'PreguntaFrecuente:7',
        }),
      );
    });

    it('rechaza un duplicado por normalización con DUPLICATE_VALUE', async () => {
      pregunta_frecuente_repo.find.mockResolvedValue([
        { id_pregunta_frecuente: '3', pregunta: '¿Cómo cargo un gasto?' },
      ]);

      await expect(
        service.crear(
          { pregunta: 'Como cargo un gasto', respuesta: 'Desde Costos.' },
          actor,
        ),
      ).rejects.toMatchObject({
        errorCode: 'DUPLICATE_VALUE',
        status: HttpStatus.CONFLICT,
        field: 'pregunta',
      });
      expect(pregunta_frecuente_repo.save).not.toHaveBeenCalled();
      expect(log_service.registrar).not.toHaveBeenCalled();
    });

    it('solo compara contra preguntas activas, así que se puede recrear una dada de baja', async () => {
      pregunta_frecuente_repo.find.mockResolvedValue([]);

      await expect(
        service.crear(
          { pregunta: '¿Cómo cargo un gasto?', respuesta: 'Desde Costos.' },
          actor,
        ),
      ).resolves.toMatchObject({ id_pregunta_frecuente: 7 });
      expect(pregunta_frecuente_repo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { fecha_baja_pf: expect.anything() },
        }),
      );
    });
  });

  describe('actualizar', () => {
    it('actualiza la pregunta y registra auditoría EXITO', async () => {
      const pregunta = {
        id_pregunta_frecuente: '7',
        pregunta: 'Vieja',
        respuesta: 'Vieja',
        fecha_baja_pf: null,
      };
      pregunta_frecuente_repo.findOne.mockResolvedValue(pregunta);
      pregunta_frecuente_repo.find.mockResolvedValue([pregunta]);

      const result = await service.actualizar(
        7,
        { pregunta: '¿Vieja?', respuesta: 'Texto actualizado.' },
        actor,
      );

      expect(pregunta_frecuente_repo.save).toHaveBeenCalledWith(pregunta);
      expect(result).toEqual({
        message: 'Pregunta frecuente actualizada correctamente.',
        id_pregunta_frecuente: 7,
        pregunta: '¿Vieja?',
        respuesta: 'Texto actualizado.',
      });
      expect(log_service.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo_operacion: TipoOperacion.EXITO,
          recurso: 'PreguntaFrecuente:7',
        }),
      );
    });

    it('rechaza un duplicado de otra fila al editar', async () => {
      pregunta_frecuente_repo.findOne.mockResolvedValue({
        id_pregunta_frecuente: '7',
        pregunta: 'Otra',
        respuesta: 'x',
        fecha_baja_pf: null,
      });
      pregunta_frecuente_repo.find.mockResolvedValue([
        { id_pregunta_frecuente: '7', pregunta: 'Otra' },
        { id_pregunta_frecuente: '3', pregunta: '¿Cómo cargo un gasto?' },
      ]);

      await expect(
        service.actualizar(
          7,
          { pregunta: 'COMO CARGO UN GASTO', respuesta: 'x' },
          actor,
        ),
      ).rejects.toMatchObject({
        errorCode: 'DUPLICATE_VALUE',
        field: 'pregunta',
      });
      expect(pregunta_frecuente_repo.save).not.toHaveBeenCalled();
    });

    it('rechaza una pregunta inexistente o dada de baja con RESOURCE_NOT_FOUND', async () => {
      pregunta_frecuente_repo.findOne.mockResolvedValue(null);

      await expect(
        service.actualizar(99, { pregunta: 'P', respuesta: 'R' }, actor),
      ).rejects.toMatchObject({
        errorCode: 'RESOURCE_NOT_FOUND',
        status: HttpStatus.NOT_FOUND,
      });
      expect(pregunta_frecuente_repo.findOne).toHaveBeenCalledWith({
        where: { id_pregunta_frecuente: 99, fecha_baja_pf: expect.anything() },
      });
    });
  });

  describe('dar_baja', () => {
    it('hace baja lógica y registra OPERACION_DESTRUCTIVA', async () => {
      const pregunta = {
        id_pregunta_frecuente: '7',
        pregunta: 'P',
        respuesta: 'R',
        fecha_baja_pf: null as Date | null,
      };
      pregunta_frecuente_repo.findOne.mockResolvedValue(pregunta);

      const result = await service.dar_baja(7, actor);

      expect(pregunta.fecha_baja_pf).toBeInstanceOf(Date);
      expect(pregunta_frecuente_repo.save).toHaveBeenCalledWith(pregunta);
      expect(result).toEqual({
        message: 'Pregunta frecuente eliminada correctamente.',
        id_pregunta_frecuente: 7,
      });
      expect(log_service.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo_operacion: TipoOperacion.OPERACION_DESTRUCTIVA,
          recurso: 'PreguntaFrecuente:7',
        }),
      );
    });

    it('rechaza una pregunta inexistente o dada de baja con RESOURCE_NOT_FOUND', async () => {
      pregunta_frecuente_repo.findOne.mockResolvedValue(null);

      await expect(service.dar_baja(99, actor)).rejects.toMatchObject({
        errorCode: 'RESOURCE_NOT_FOUND',
        status: HttpStatus.NOT_FOUND,
      });
      expect(pregunta_frecuente_repo.save).not.toHaveBeenCalled();
    });
  });

  describe('listar_gestion', () => {
    it('pagina activas ordenadas por fecha de alta y id descendentes', async () => {
      pregunta_frecuente_repo.findAndCount.mockResolvedValue([
        [
          {
            id_pregunta_frecuente: '12',
            pregunta: 'P',
            respuesta: 'R',
            fecha_alta_pf: new Date(),
            fecha_baja_pf: null,
          },
        ],
        23,
      ]);

      const result = await service.listar_gestion({ page: 3, pageSize: 10 });

      expect(pregunta_frecuente_repo.findAndCount).toHaveBeenCalledWith({
        where: { fecha_baja_pf: expect.anything() },
        order: { fecha_alta_pf: 'DESC', id_pregunta_frecuente: 'DESC' },
        skip: 20,
        take: 10,
      });
      expect(result).toEqual({
        preguntas_frecuentes: [
          { id_pregunta_frecuente: 12, pregunta: 'P', respuesta: 'R' },
        ],
        pagination: { page: 3, pageSize: 10, totalItems: 23, totalPages: 3 },
      });
    });

    it('devuelve lista vacía con pagination correcto si la página está fuera de rango', async () => {
      pregunta_frecuente_repo.findAndCount.mockResolvedValue([[], 23]);

      await expect(
        service.listar_gestion({ page: 9, pageSize: 10 }),
      ).resolves.toEqual({
        preguntas_frecuentes: [],
        pagination: { page: 9, pageSize: 10, totalItems: 23, totalPages: 3 },
      });
    });

    it('usa page 1 y pageSize 10 por defecto', async () => {
      pregunta_frecuente_repo.findAndCount.mockResolvedValue([[], 0]);

      await expect(service.listar_gestion({})).resolves.toEqual({
        preguntas_frecuentes: [],
        pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
      });
      expect(pregunta_frecuente_repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 10 }),
      );
    });
  });

  describe('listar', () => {
    it('ordena alfabéticamente ignorando acentos, mayúsculas y signos iniciales, con desempate por id', async () => {
      const fila = (id: number, pregunta: string) => ({
        id_pregunta_frecuente: String(id),
        pregunta,
        respuesta: `R${id}`,
        fecha_baja_pf: null,
      });
      pregunta_frecuente_repo.find.mockResolvedValue([
        fila(1, 'Zona horaria'),
        fila(9, '¿Cómo cargo un gasto?'),
        fila(2, 'ÁREA de la parcela'),
        fila(4, 'como cargo un gasto'),
        fila(3, '¡Bienvenido!'),
        fila(5, '"Alertas" del tablero'),
        fila(6, 'Ñandú'),
        fila(7, 'Nube'),
      ]);

      const { preguntas_frecuentes } = await service.listar();

      expect(preguntas_frecuentes.map((p) => p.id_pregunta_frecuente)).toEqual(
        [5, 2, 3, 4, 9, 7, 6, 1],
      );
      expect(preguntas_frecuentes[0]).toEqual({
        id_pregunta_frecuente: 5,
        pregunta: '"Alertas" del tablero',
        respuesta: 'R5',
      });
      expect(pregunta_frecuente_repo.find).toHaveBeenCalledWith({
        where: { fecha_baja_pf: expect.anything() },
      });
    });

    it('devuelve preguntas_frecuentes vacío y sin pagination si no hay activas', async () => {
      await expect(service.listar()).resolves.toEqual({
        preguntas_frecuentes: [],
      });
    });
  });
});

describe('CrearPreguntaFrecuenteDto', () => {
  const errores = async (body: Record<string, unknown>) => {
    const dto = plainToInstance(CrearPreguntaFrecuenteDto, body);
    return { dto, errors: await validate(dto) };
  };

  it('recorta espacios antes de validar y conserva los saltos de línea internos', async () => {
    const { dto, errors } = await errores({
      pregunta: '  ¿Qué es Croply?  ',
      respuesta: '  Línea 1\nLínea 2  ',
    });

    expect(errors).toHaveLength(0);
    expect(dto.pregunta).toBe('¿Qué es Croply?');
    expect(dto.respuesta).toBe('Línea 1\nLínea 2');
  });

  it('marca como vacío un valor de solo espacios', async () => {
    const { errors } = await errores({ pregunta: '   ', respuesta: '\n  ' });

    expect(errors.map((e) => e.property)).toEqual(['pregunta', 'respuesta']);
    expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    expect(errors[1].constraints).toHaveProperty('isNotEmpty');
  });

  it('aplica los largos máximos', async () => {
    const { errors } = await errores({
      pregunta: 'a'.repeat(256),
      respuesta: 'b'.repeat(2001),
    });

    expect(errors.map((e) => Object.keys(e.constraints ?? {}))).toEqual([
      ['maxLength'],
      ['maxLength'],
    ]);
  });
});
