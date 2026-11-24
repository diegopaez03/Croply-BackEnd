import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CODIGO_ADMIN_FINCA,
  EstadoParcela,
  EstadoPlanAccion,
  PERMISO_FINCA,
} from '../../common/enums';
import { resourceNotFound } from '../../common/exceptions';
import { Notificacion } from '../alertas-climaticas/entities/notificacion.entity';
import { TipoNotificacion } from '../alertas-climaticas/enums/tipo-notificacion.enum';
import { Tarea } from '../planes-accion/entities/tarea.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { NotificacionResponseDto } from './dto/notificacion-response.dto';

const RELACIONES = [
  'alerta',
  'alerta.finca',
  'tarea',
  'tarea.hito',
  'tarea.hito.plan_accion',
  'tarea.hito.plan_accion.parcela',
  'tarea.hito.plan_accion.parcela.finca',
];

@Injectable()
export class NotificacionesService {
  constructor(
    @InjectRepository(Notificacion)
    private readonly notificacion_repo: Repository<Notificacion>,
    @InjectRepository(Tarea)
    private readonly tarea_repo: Repository<Tarea>,
  ) {}

  async listar(usuario: Usuario) {
    await this.materializar_tareas_de_hoy(usuario);
    const notificaciones = await this.notificacion_repo.find({
      where: { usuario: { id_usuario: usuario.id_usuario } },
      relations: RELACIONES,
      order: { fecha_creacion: 'DESC', id_notificacion: 'DESC' },
    });
    const mapeadas = notificaciones.map((item) => this.mapear(item));
    return {
      no_leidas: mapeadas.filter((item) => !item.leida).length,
      notificaciones: mapeadas,
    };
  }

  async marcar_leida(usuario: Usuario, id_notificacion: number) {
    const notificacion = await this.notificacion_repo.findOne({
      where: {
        id_notificacion,
        usuario: { id_usuario: usuario.id_usuario },
      },
      relations: RELACIONES,
    });
    if (!notificacion) {
      throw resourceNotFound();
    }
    if (!notificacion.leida) {
      notificacion.leida = true;
      notificacion.fecha_lectura = new Date();
      await this.notificacion_repo.save(notificacion);
    }
    return this.mapear(notificacion);
  }

  async marcar_todas_leidas(usuario: Usuario) {
    const pendientes = await this.notificacion_repo.find({
      where: {
        usuario: { id_usuario: usuario.id_usuario },
        leida: false,
      },
    });
    const ahora = new Date();
    for (const notificacion of pendientes) {
      notificacion.leida = true;
      notificacion.fecha_lectura = ahora;
    }
    if (pendientes.length > 0) {
      await this.notificacion_repo.save(pendientes);
    }
    return { no_leidas: 0 };
  }

  private async materializar_tareas_de_hoy(usuario: Usuario) {
    const ids_finca = this.fincas_con_tareas(usuario);
    if (ids_finca.length === 0) {
      return;
    }
    const hoy = hoy_iso();
    const tareas = (await this.buscar_tareas(ids_finca, hoy)).filter(
      (tarea) =>
        tarea.estado_tarea?.es_estado_finalizador === false &&
        fecha_dia(tarea.fecha_planificada_tarea) === hoy,
    );
    if (tareas.length === 0) {
      return;
    }
    const ya = await this.ids_notificadas_hoy(
      usuario.id_usuario,
      tareas.map((tarea) => Number(tarea.id_tarea)),
      hoy,
    );
    const nuevas = tareas.filter((tarea) => !ya.has(Number(tarea.id_tarea)));
    if (nuevas.length === 0) {
      return;
    }
    await this.notificacion_repo.save(
      nuevas.map((tarea) => {
        const parcela = tarea.hito.plan_accion.parcela;
        return this.notificacion_repo.create({
          usuario: { id_usuario: usuario.id_usuario } as Usuario,
          tarea,
          alerta: null,
          tipo: TipoNotificacion.TAREA_PENDIENTE,
          titulo: tarea.nombre_tarea,
          mensaje: parcela.nombre_parcela,
          leida: false,
          fecha_lectura: null,
        });
      }),
    );
  }

  private fincas_con_tareas(usuario: Usuario): number[] {
    const ahora = Date.now();
    const ids: number[] = [];
    for (const membresia of usuario.usuario_fincas ?? []) {
      if (
        membresia.fecha_fin_rol != null &&
        membresia.fecha_fin_rol.getTime() <= ahora
      ) {
        continue;
      }
      if (membresia.finca?.fecha_baja_finca != null) {
        continue;
      }
      if (membresia.finca?.id_finca == null) {
        continue;
      }
      const es_admin =
        membresia.rol_finca?.codigo_rol_finca === CODIGO_ADMIN_FINCA;
      const tiene_permiso = (membresia.rol_finca?.rol_permisos ?? []).some(
        (rol_permiso) =>
          rol_permiso.permiso?.nombre_permiso === PERMISO_FINCA.TAREAS_CAMPO,
      );
      if (es_admin || tiene_permiso) {
        ids.push(Number(membresia.finca.id_finca));
      }
    }
    return ids;
  }

  private buscar_tareas(ids_finca: number[], hoy: string): Promise<Tarea[]> {
    return this.tarea_repo
      .createQueryBuilder('tarea')
      .innerJoinAndSelect('tarea.estado_tarea', 'estado')
      .innerJoinAndSelect('tarea.hito', 'hito')
      .innerJoinAndSelect('hito.plan_accion', 'plan')
      .innerJoinAndSelect('plan.parcela', 'parcela')
      .innerJoinAndSelect('parcela.finca', 'finca')
      .where('plan.estado = :estado_plan', {
        estado_plan: EstadoPlanAccion.ACTIVO,
      })
      .andWhere('parcela.estado_parcela = :estado_parcela', {
        estado_parcela: EstadoParcela.ACTIVA,
      })
      .andWhere('parcela.fecha_baja_parcela IS NULL')
      .andWhere('finca.fecha_baja_finca IS NULL')
      .andWhere('finca.id_finca IN (:...ids_finca)', { ids_finca })
      .andWhere('tarea.fecha_planificada_tarea = :hoy', { hoy })
      .andWhere('estado.es_estado_finalizador = false')
      .getMany();
  }

  private async ids_notificadas_hoy(
    id_usuario: number,
    ids_tarea: number[],
    hoy: string,
  ): Promise<Set<number>> {
    const inicio = new Date(`${hoy}T00:00:00.000Z`);
    const fin = new Date(inicio.getTime() + 86_400_000);
    const existentes = await this.notificacion_repo
      .createQueryBuilder('notificacion')
      .innerJoinAndSelect('notificacion.tarea', 'tarea')
      .innerJoin('notificacion.usuario', 'usuario')
      .where('usuario.id_usuario = :id_usuario', { id_usuario })
      .andWhere('notificacion.tipo = :tipo', {
        tipo: TipoNotificacion.TAREA_PENDIENTE,
      })
      .andWhere('notificacion.fecha_creacion >= :inicio', { inicio })
      .andWhere('notificacion.fecha_creacion < :fin', { fin })
      .andWhere('tarea.id_tarea IN (:...ids_tarea)', { ids_tarea })
      .getMany();
    return new Set(
      existentes
        .map((item) => item.tarea?.id_tarea)
        .filter((id): id is number => id != null)
        .map((id) => Number(id)),
    );
  }

  private mapear(notificacion: Notificacion): NotificacionResponseDto {
    const parcela = notificacion.tarea?.hito?.plan_accion?.parcela;
    const finca_alerta = notificacion.alerta?.finca;
    const finca_tarea = parcela?.finca;
    return {
      id_notificacion: Number(notificacion.id_notificacion),
      tipo: notificacion.tipo,
      titulo: notificacion.titulo,
      descripcion: notificacion.mensaje,
      leida: notificacion.leida,
      fecha_creacion: new Date(notificacion.fecha_creacion).toISOString(),
      fecha_lectura: notificacion.fecha_lectura
        ? new Date(notificacion.fecha_lectura).toISOString()
        : null,
      id_finca: finca_alerta
        ? Number(finca_alerta.id_finca)
        : finca_tarea
          ? Number(finca_tarea.id_finca)
          : null,
      id_parcela: parcela ? Number(parcela.id_parcela) : null,
      id_tarea: notificacion.tarea ? Number(notificacion.tarea.id_tarea) : null,
    };
  }
}

function hoy_iso(): string {
  return new Date().toISOString().slice(0, 10);
}

function fecha_dia(fecha: string | Date): string {
  if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}/.test(fecha)) {
    return fecha.slice(0, 10);
  }
  const date = fecha instanceof Date ? fecha : new Date(fecha);
  return date.toISOString().slice(0, 10);
}
