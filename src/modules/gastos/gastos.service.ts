import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, IsNull, Repository } from 'typeorm';
import { TipoOperacion } from '../../common/enums';
import {
  DomainException,
  emptyExportResult,
  invalidDateRange,
  resourceNotFound,
} from '../../common/exceptions';
import { Finca } from '../fincas/entities/finca.entity';
import { UsuarioFinca } from '../fincas/entities/usuario-finca.entity';
import { LogOperacionesService } from '../log-operaciones';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  ActualizarGastoDto,
  CrearGastoDto,
  EvolucionMensualQueryDto,
  ExportarGastosDto,
  ListarGastosQueryDto,
} from './dto/gastos.dto';
import { GastoProduccion } from './entities/gasto-produccion.entity';
import { armar_pdf_historial, nombre_archivo_pdf } from './gastos.pdf';

@Injectable()
export class GastosService {
  constructor(
    @InjectRepository(GastoProduccion)
    private readonly gasto_repo: Repository<GastoProduccion>,
    @InjectRepository(Finca)
    private readonly finca_repo: Repository<Finca>,
    @InjectRepository(UsuarioFinca)
    private readonly usuario_finca_repo: Repository<UsuarioFinca>,
    private readonly log_service: LogOperacionesService,
  ) {}

  async crear(id_finca: number, dto: CrearGastoDto, actor: Usuario) {
    const finca = await this.require_finca(id_finca);
    const responsable = await this.require_responsable(
      id_finca,
      dto.id_responsable,
      true,
    );

    const gasto = await this.gasto_repo.save(
      this.gasto_repo.create({
        nombre_insumo_gp: dto.nombre_insumo_gp.trim(),
        monto_gp: dto.monto_gp.toFixed(2),
        fecha_gp: this.solo_fecha(dto.fecha_gp),
        nombre_responsable: this.nombre_completo(responsable),
        fecha_modificacion_gp: null,
        fecha_baja_gp: null,
        finca,
        responsable,
      }),
    );

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.EXITO,
      descripcion: `Alta de gasto de producción ${gasto.nombre_insumo_gp}`,
      recurso: `GastoProduccion:${gasto.id_gasto_produccion}`,
    });

    return {
      message: 'Gasto registrado correctamente',
      ...this.to_detalle(gasto, finca),
    };
  }

  async actualizar(
    id_finca: number,
    id_gasto_produccion: number,
    dto: ActualizarGastoDto,
    actor: Usuario,
  ) {
    const finca = await this.require_finca(id_finca);
    const gasto = await this.require_gasto(id_finca, id_gasto_produccion);
    const id_actual = Number(gasto.responsable.id_usuario_finca);

    if (dto.id_responsable !== id_actual) {
      gasto.responsable = await this.require_responsable(
        id_finca,
        dto.id_responsable,
        true,
      );
      gasto.nombre_responsable = this.nombre_completo(gasto.responsable);
    }

    gasto.nombre_insumo_gp = dto.nombre_insumo_gp.trim();
    gasto.monto_gp = dto.monto_gp.toFixed(2);
    gasto.fecha_gp = this.solo_fecha(dto.fecha_gp);
    gasto.fecha_modificacion_gp = new Date();
    await this.gasto_repo.save(gasto);

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.EXITO,
      descripcion: `Actualización de gasto de producción ${gasto.nombre_insumo_gp}`,
      recurso: `GastoProduccion:${gasto.id_gasto_produccion}`,
    });

    return {
      message: 'Gasto actualizado correctamente',
      ...this.to_detalle(gasto, finca),
    };
  }

  async dar_baja(
    id_finca: number,
    id_gasto_produccion: number,
    actor: Usuario,
  ) {
    await this.require_finca(id_finca);
    const gasto = await this.require_gasto(id_finca, id_gasto_produccion);
    gasto.fecha_baja_gp = new Date();
    await this.gasto_repo.save(gasto);

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.OPERACION_DESTRUCTIVA,
      descripcion: `Baja de gasto de producción ${gasto.nombre_insumo_gp}`,
      recurso: `GastoProduccion:${gasto.id_gasto_produccion}`,
    });

    return { message: 'Gasto eliminado correctamente' };
  }

  async listar(id_finca: number, query: ListarGastosQueryDto) {
    await this.require_finca(id_finca);
    this.validar_rango(query.fecha_desde, query.fecha_hasta);

    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 10));
    const todos = await this.buscar(id_finca, query.fecha_desde, query.fecha_hasta);
    const monto_total = this.sumar(todos);
    const hay_filtro = Boolean(query.fecha_desde || query.fecha_hasta);

    let monto_total_periodo = monto_total;
    let etiqueta_periodo: 'mes_actual' | 'rango_filtrado' = 'rango_filtrado';
    if (!hay_filtro) {
      etiqueta_periodo = 'mes_actual';
      const prefijo = this.mes_calendario_actual();
      monto_total_periodo = this.sumar(
        todos.filter((gasto) => this.solo_fecha(gasto.fecha_gp).startsWith(prefijo)),
      );
    }

    const start = (page - 1) * pageSize;
    const pagina = todos.slice(start, start + pageSize);

    return {
      gastos: pagina.map((gasto) => this.to_listado(gasto)),
      total: todos.length,
      page,
      pageSize,
      monto_total,
      monto_total_periodo,
      etiqueta_periodo,
    };
  }

  async evolucion_mensual(id_finca: number, query: EvolucionMensualQueryDto) {
    await this.require_finca(id_finca);
    this.validar_rango(query.fecha_desde, query.fecha_hasta);

    const historial = await this.buscar(id_finca);
    if (historial.length === 0) {
      return [];
    }

    const fechas = historial
      .map((gasto) => this.solo_fecha(gasto.fecha_gp))
      .sort();
    const inicio = (query.fecha_desde ?? fechas[0]).slice(0, 7);
    const fin = (query.fecha_hasta ?? fechas[fechas.length - 1]).slice(0, 7);

    return this.meses_entre(inicio, fin).map((mes) => ({
      mes,
      monto: this.sumar(
        historial.filter((gasto) => {
          const fecha = this.solo_fecha(gasto.fecha_gp);
          if (query.fecha_desde && fecha < this.solo_fecha(query.fecha_desde)) {
            return false;
          }
          if (query.fecha_hasta && fecha > this.solo_fecha(query.fecha_hasta)) {
            return false;
          }
          return fecha.startsWith(mes);
        }),
      ),
    }));
  }

  async exportar(id_finca: number, dto: ExportarGastosDto) {
    const finca = await this.require_finca(id_finca);
    this.validar_rango(dto.fecha_desde, dto.fecha_hasta);

    const gastos = await this.buscar(id_finca, dto.fecha_desde, dto.fecha_hasta);
    if (gastos.length === 0) {
      throw emptyExportResult();
    }

    const generado_en = new Date();
    const buffer = await armar_pdf_historial({
      id_finca: Number(finca.id_finca),
      nombre_finca: finca.nombre_finca,
      fecha_desde: dto.fecha_desde,
      fecha_hasta: dto.fecha_hasta,
      generado_en,
      gastos: gastos.map((gasto) => ({
        fecha_gp: this.solo_fecha(gasto.fecha_gp),
        nombre_insumo_gp: gasto.nombre_insumo_gp,
        monto_gp: this.to_monto(gasto.monto_gp),
        nombre_responsable: gasto.nombre_responsable,
      })),
      monto_total_periodo: this.sumar(gastos),
      imagen_grafico: dto.imagen_grafico,
    });

    return {
      buffer,
      filename: nombre_archivo_pdf(finca.nombre_finca, generado_en),
    };
  }

  private async buscar(
    id_finca: number,
    fecha_desde?: string,
    fecha_hasta?: string,
  ): Promise<GastoProduccion[]> {
    const where: FindOptionsWhere<GastoProduccion> = {
      finca: { id_finca },
      fecha_baja_gp: IsNull(),
    };

    const gastos = await this.gasto_repo.find({
      where,
      relations: ['finca', 'responsable', 'responsable.usuario'],
      order: { fecha_gp: 'DESC', fecha_alta_gp: 'DESC' },
    });

    return gastos.filter((gasto) => {
      const fecha = this.solo_fecha(gasto.fecha_gp);
      if (fecha_desde && fecha < this.solo_fecha(fecha_desde)) {
        return false;
      }
      if (fecha_hasta && fecha > this.solo_fecha(fecha_hasta)) {
        return false;
      }
      return true;
    });
  }

  private async require_finca(id_finca: number): Promise<Finca> {
    const finca = await this.finca_repo.findOne({ where: { id_finca } });
    if (!finca) {
      throw resourceNotFound();
    }
    if (finca.fecha_baja_finca) {
      throw new DomainException(
        'FINCA_NOT_AVAILABLE',
        'La finca seleccionada no está disponible.',
        HttpStatus.FORBIDDEN,
      );
    }
    return finca;
  }

  private async require_gasto(
    id_finca: number,
    id_gasto_produccion: number,
  ): Promise<GastoProduccion> {
    const gasto = await this.gasto_repo.findOne({
      where: {
        id_gasto_produccion,
        fecha_baja_gp: IsNull(),
        finca: { id_finca },
      },
      relations: ['finca', 'responsable', 'responsable.usuario'],
    });
    if (!gasto) {
      throw resourceNotFound();
    }
    return gasto;
  }

  private async require_responsable(
    id_finca: number,
    id_responsable: number,
    solo_vigente: boolean,
  ): Promise<UsuarioFinca> {
    const membresia = await this.usuario_finca_repo.findOne({
      where: { id_usuario_finca: id_responsable },
      relations: ['usuario', 'finca'],
    });

    if (!membresia || Number(membresia.finca?.id_finca) !== Number(id_finca)) {
      throw resourceNotFound();
    }

    if (solo_vigente) {
      const now = Date.now();
      if (
        membresia.fecha_fin_rol != null &&
        membresia.fecha_fin_rol.getTime() <= now
      ) {
        throw resourceNotFound();
      }
    }

    return membresia;
  }

  private validar_rango(fecha_desde?: string, fecha_hasta?: string): void {
    if (
      fecha_desde &&
      fecha_hasta &&
      this.solo_fecha(fecha_hasta) < this.solo_fecha(fecha_desde)
    ) {
      throw invalidDateRange();
    }
  }

  private to_detalle(gasto: GastoProduccion, finca: Finca) {
    return {
      ...this.to_listado(gasto),
      id_finca: Number(finca.id_finca),
      nombre_finca: finca.nombre_finca,
      fecha_alta_gp: gasto.fecha_alta_gp.toISOString(),
      fecha_modificacion_gp: gasto.fecha_modificacion_gp
        ? gasto.fecha_modificacion_gp.toISOString()
        : null,
    };
  }

  private to_listado(gasto: GastoProduccion) {
    return {
      id_gasto_produccion: Number(gasto.id_gasto_produccion),
      nombre_insumo_gp: gasto.nombre_insumo_gp,
      monto_gp: this.to_monto(gasto.monto_gp),
      fecha_gp: this.solo_fecha(gasto.fecha_gp),
      id_responsable: Number(gasto.responsable.id_usuario_finca),
      nombre_responsable: gasto.nombre_responsable,
    };
  }

  private nombre_completo(membresia: UsuarioFinca): string {
    return `${membresia.usuario.nombre} ${membresia.usuario.apellido}`.trim();
  }

  private to_monto(valor: string | number): number {
    return Number(Number(valor).toFixed(2));
  }

  private sumar(gastos: GastoProduccion[]): number {
    return this.to_monto(
      gastos.reduce((acc, gasto) => acc + this.to_monto(gasto.monto_gp), 0),
    );
  }

  private solo_fecha(valor: string | Date): string {
    if (valor instanceof Date) {
      const y = valor.getUTCFullYear();
      const m = String(valor.getUTCMonth() + 1).padStart(2, '0');
      const d = String(valor.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return String(valor).slice(0, 10);
  }

  private mes_calendario_actual(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private meses_entre(inicio: string, fin: string): string[] {
    const meses: string[] = [];
    const [y0, m0] = inicio.split('-').map(Number);
    const [y1, m1] = fin.split('-').map(Number);
    let year = y0;
    let month = m0;
    while (year < y1 || (year === y1 && month <= m1)) {
      meses.push(`${year}-${String(month).padStart(2, '0')}`);
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
    return meses;
  }
}
