import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { EstadoPlanAccion } from '../../common/enums';
import {
  DomainException,
  noteAlreadyConverted,
  parcelWithoutActionPlan,
  resourceNotFound,
} from '../../common/exceptions';
import { UsuarioFinca } from '../fincas/entities/usuario-finca.entity';
import { Finca } from '../fincas/entities/finca.entity';
import { PlanesAccionService } from '../planes-accion/planes-accion.service';
import { Hito } from '../planes-accion/entities/hito.entity';
import { PlanAccion } from '../planes-accion/entities/plan-accion.entity';
import { Parcela } from '../parcelas/entities/parcela.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ConvertirNotaDto, CrearNotaCampoDto } from './dto/notas-campo.dto';
import { EstadoNotaCampo, NotaCampo } from './entities/nota-campo.entity';

@Injectable()
export class NotasCampoService {
  constructor(
    @InjectRepository(NotaCampo)
    private readonly nota_repo: Repository<NotaCampo>,
    @InjectRepository(Finca)
    private readonly finca_repo: Repository<Finca>,
    @InjectRepository(Parcela)
    private readonly parcela_repo: Repository<Parcela>,
    @InjectRepository(UsuarioFinca)
    private readonly usuario_finca_repo: Repository<UsuarioFinca>,
    @InjectRepository(PlanAccion)
    private readonly plan_repo: Repository<PlanAccion>,
    @InjectRepository(Hito)
    private readonly hito_repo: Repository<Hito>,
    private readonly planes_service: PlanesAccionService,
  ) {}

  async crear(dto: CrearNotaCampoDto, actor: Usuario) {
    const finca = await this.require_finca(dto.id_finca);
    if (finca.fecha_baja_finca != null) {
      throw this.finca_no_disponible();
    }
    const autor = await this.require_membresia(actor.id_usuario, dto.id_finca);
    const parcela = await this.resolve_parcela(dto.id_parcela, dto.id_finca);

    const nota = await this.nota_repo.save(
      this.nota_repo.create({
        contenido_nota_campo: dto.contenido_nota_campo.trim(),
        fecha_captura_nc: dto.fecha_captura_nc
          ? new Date(dto.fecha_captura_nc)
          : new Date(),
        estado: EstadoNotaCampo.SINCRONIZADA,
        usuario_finca: autor,
        parcela,
        tarea: null,
      }),
    );
    nota.usuario_finca = autor;
    nota.parcela = parcela;

    return {
      message: 'Nota guardada correctamente',
      ...this.to_detalle(nota, dto.id_finca),
    };
  }

  async listar_por_finca(id_finca: number) {
    await this.require_finca(id_finca);
    const notas = await this.nota_repo.find({
      where: { usuario_finca: { finca: { id_finca } } },
      relations: this.relaciones_listado(),
      order: { fecha_captura_nc: 'DESC' },
    });
    return { notas: notas.map((nota) => this.to_listado(nota)) };
  }

  async listar_por_parcela(id_parcela: number) {
    const parcela = await this.parcela_repo.findOne({
      where: { id_parcela },
    });
    if (!parcela) {
      throw resourceNotFound();
    }
    const notas = await this.nota_repo.find({
      where: { parcela: { id_parcela } },
      relations: this.relaciones_listado(),
      order: { fecha_captura_nc: 'DESC' },
    });
    return { notas: notas.map((nota) => this.to_listado(nota)) };
  }

  async convertir(id_nota_campo: number, dto: ConvertirNotaDto, actor: Usuario) {
    const nota = await this.nota_repo.findOne({
      where: { id_nota_campo },
      relations: ['usuario_finca', 'usuario_finca.finca', 'tarea'],
    });
    if (!nota) {
      throw resourceNotFound();
    }
    if (
      nota.estado === EstadoNotaCampo.CONVERTIDA_A_TAREA ||
      nota.tarea != null
    ) {
      throw noteAlreadyConverted();
    }

    const id_finca = Number(nota.usuario_finca.finca.id_finca);
    await this.require_membresia(actor.id_usuario, id_finca);
    await this.resolve_parcela(dto.id_parcela, id_finca);

    const hito = await this.require_hito_de_plan_activo(
      dto.id_parcela,
      dto.id_hito_real,
    );
    const creada = await this.planes_service.crear_tarea(
      Number(hito.plan_accion.id_plan_accion),
      dto.id_hito_real,
      dto,
    );

    nota.estado = EstadoNotaCampo.CONVERTIDA_A_TAREA;
    nota.tarea = { id_tarea: creada.id_tarea } as NotaCampo['tarea'];
    await this.nota_repo.save(nota);

    return {
      ...creada,
      message: 'Nota convertida en tarea correctamente',
    };
  }

  private async require_hito_de_plan_activo(
    id_parcela: number,
    id_hito_real: number,
  ): Promise<Hito> {
    const activos = await this.plan_repo.count({
      where: {
        parcela: { id_parcela },
        estado: EstadoPlanAccion.ACTIVO,
      },
    });
    if (activos === 0) {
      throw parcelWithoutActionPlan();
    }

    const hito = await this.hito_repo.findOne({
      where: { id_hito: id_hito_real },
      relations: ['plan_accion', 'plan_accion.parcela'],
    });
    const plan = hito?.plan_accion;
    const es_de_la_parcela =
      plan != null &&
      Number(plan.parcela?.id_parcela) === Number(id_parcela) &&
      plan.estado === EstadoPlanAccion.ACTIVO;
    if (!hito || !es_de_la_parcela) {
      throw resourceNotFound();
    }
    return hito;
  }

  private async require_finca(id_finca: number): Promise<Finca> {
    const finca = await this.finca_repo.findOne({ where: { id_finca } });
    if (!finca) {
      throw resourceNotFound();
    }
    return finca;
  }

  private async require_membresia(
    id_usuario: number,
    id_finca: number,
  ): Promise<UsuarioFinca> {
    const candidatas = await this.usuario_finca_repo.find({
      where: {
        usuario: { id_usuario },
        finca: { id_finca },
      },
      relations: ['usuario', 'rol_finca', 'finca'],
    });
    const now = Date.now();
    const membresia = candidatas.find(
      (uf) => uf.fecha_fin_rol == null || uf.fecha_fin_rol.getTime() > now,
    );
    if (!membresia) {
      throw this.finca_no_disponible();
    }
    return membresia;
  }

  private async resolve_parcela(
    id_parcela: number | null | undefined,
    id_finca: number,
  ): Promise<Parcela | null> {
    if (id_parcela == null) {
      return null;
    }
    const parcela = await this.parcela_repo.findOne({
      where: {
        id_parcela,
        fecha_baja_parcela: IsNull(),
        finca: { id_finca },
      },
      relations: ['finca'],
    });
    if (!parcela) {
      throw resourceNotFound();
    }
    return parcela;
  }

  private relaciones_listado(): string[] {
    return [
      'usuario_finca',
      'usuario_finca.usuario',
      'usuario_finca.rol_finca',
      'parcela',
    ];
  }

  private to_detalle(nota: NotaCampo, id_finca: number) {
    const usuario = nota.usuario_finca.usuario;
    return {
      id_nota_campo: Number(nota.id_nota_campo),
      contenido_nota_campo: nota.contenido_nota_campo,
      fecha_captura_nc: nota.fecha_captura_nc.toISOString(),
      estado: nota.estado,
      id_finca,
      id_parcela: nota.parcela ? Number(nota.parcela.id_parcela) : null,
      id_usuario_finca: Number(nota.usuario_finca.id_usuario_finca),
      nombre_usuario: `${usuario.nombre} ${usuario.apellido}`.trim(),
      nombre_rol_finca: nota.usuario_finca.rol_finca.nombre_rol,
    };
  }

  private to_listado(nota: NotaCampo) {
    const usuario = nota.usuario_finca.usuario;
    return {
      id_nota_campo: Number(nota.id_nota_campo),
      contenido_nota_campo: nota.contenido_nota_campo,
      fecha_captura_nc: nota.fecha_captura_nc.toISOString(),
      estado: nota.estado,
      id_parcela: nota.parcela ? Number(nota.parcela.id_parcela) : null,
      nombre_parcela: nota.parcela?.nombre_parcela ?? null,
      nombre_usuario: `${usuario.nombre} ${usuario.apellido}`.trim(),
      nombre_rol_finca: nota.usuario_finca.rol_finca.nombre_rol,
    };
  }

  private finca_no_disponible(): DomainException {
    return new DomainException(
      'FINCA_NOT_AVAILABLE',
      'La finca seleccionada no está disponible.',
      HttpStatus.FORBIDDEN,
    );
  }
}
