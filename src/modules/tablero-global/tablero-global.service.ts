import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CODIGO_ADMIN_FINCA, EstadoTransmision } from '../../common/enums';
import { Finca } from '../fincas/entities/finca.entity';
import { UsuarioFinca } from '../fincas/entities/usuario-finca.entity';
import { Sensor } from '../parcelas/entities/sensor.entity';
import {
  TableroClientesDto,
  TableroEvolucionFincasDto,
  TableroGlobalResponseDto,
  TableroHectareasDto,
  TableroSensoresDto,
} from './dto/tablero-global-response.dto';

export const ZONA_HORARIA_TABLERO = 'America/Argentina/Buenos_Aires';
export const MESES_EVOLUCION_FINCAS = 6;

@Injectable()
export class TableroGlobalService {
  constructor(
    @InjectRepository(Finca)
    private readonly finca_repo: Repository<Finca>,
    @InjectRepository(Sensor)
    private readonly sensor_repo: Repository<Sensor>,
    @InjectRepository(UsuarioFinca)
    private readonly usuario_finca_repo: Repository<UsuarioFinca>,
  ) {}

  async obtener_tablero(): Promise<TableroGlobalResponseDto> {
    const [clientes, sensores, hectareas, evolucion_fincas] = await Promise.all([
      this.obtener_clientes(),
      this.obtener_sensores(),
      this.obtener_hectareas(),
      this.obtener_evolucion_fincas(),
    ]);
    return { clientes, sensores, hectareas, evolucion_fincas };
  }

  private async obtener_clientes(): Promise<TableroClientesDto> {
    const primer_vinculo = this.usuario_finca_repo
      .createQueryBuilder('uf')
      .innerJoin('uf.usuario', 'u')
      .innerJoin('uf.finca', 'f')
      .innerJoin('uf.rol_finca', 'r')
      .select('u.id_usuario', 'id_usuario')
      .addSelect('MIN(uf.fecha_asociacion_rol)', 'primer_vinculo')
      .where('uf.fecha_fin_rol IS NULL')
      .andWhere('r.codigo_rol_finca = :codigo_admin_finca', {
        codigo_admin_finca: CODIGO_ADMIN_FINCA,
      })
      .andWhere('f.fecha_baja_finca IS NULL')
      .andWhere('u.fecha_baja IS NULL')
      .groupBy('u.id_usuario');

    // Inicio del mes calendario actual en Buenos Aires, como timestamptz.
    const inicio_mes = `(date_trunc('month', now() AT TIME ZONE :tz) AT TIME ZONE :tz)`;

    const result = await this.usuario_finca_repo.manager
      .createQueryBuilder()
      .select('COUNT(*)', 'total')
      .addSelect(
        `COUNT(*) FILTER (WHERE c.primer_vinculo >= ${inicio_mes} AND c.primer_vinculo < ${inicio_mes} + interval '1 month')`,
        'nuevos_este_mes',
      )
      .from(`(${primer_vinculo.getQuery()})`, 'c')
      .setParameters({
        ...primer_vinculo.getParameters(),
        tz: ZONA_HORARIA_TABLERO,
      })
      .getRawOne<{ total: string; nuevos_este_mes: string }>();

    return {
      total: Number(result?.total ?? 0),
      nuevos_este_mes: Number(result?.nuevos_este_mes ?? 0),
    };
  }

  private async obtener_sensores(): Promise<TableroSensoresDto> {
    // Mismo criterio de "sensor vivo" que FincasService.obtener_stats().
    const filas = await this.sensor_repo
      .createQueryBuilder('s')
      .innerJoin('s.controlador', 'c')
      .innerJoin('c.parcela', 'p')
      .innerJoin('p.finca', 'f')
      .select('s.estado_senal', 'estado_senal')
      .addSelect('COUNT(*)', 'cantidad')
      .where('s.fecha_baja IS NULL')
      .andWhere('c.fecha_baja IS NULL')
      .andWhere('p.fecha_baja_parcela IS NULL')
      .andWhere('f.fecha_baja_finca IS NULL')
      .groupBy('s.estado_senal')
      .getRawMany<{ estado_senal: EstadoTransmision; cantidad: string }>();

    const contar = (estado: EstadoTransmision) =>
      Number(filas.find((fila) => fila.estado_senal === estado)?.cantidad ?? 0);
    const total_activos = contar(EstadoTransmision.TRANSMITIENDO);
    const total_inactivos = contar(EstadoTransmision.SIN_SENAL);

    return {
      activos: total_activos,
      porcentaje_parque_total: this.calcular_porcentaje(
        total_activos,
        total_inactivos,
      ),
      total_activos,
      total_inactivos,
    };
  }

  private async obtener_hectareas(): Promise<TableroHectareasDto> {
    const result = await this.finca_repo
      .createQueryBuilder('f')
      .select('COALESCE(SUM(f.superficie_finca), 0)', 'total')
      .addSelect(
        `COUNT(DISTINCT LOWER(TRIM(f.provincia))) FILTER (WHERE TRIM(f.provincia) <> '')`,
        'provincias',
      )
      .where('f.fecha_baja_finca IS NULL')
      .getRawOne<{ total: string; provincias: string }>();

    return {
      total: Number(result?.total ?? 0),
      provincias: Number(result?.provincias ?? 0),
    };
  }

  private async obtener_evolucion_fincas(): Promise<TableroEvolucionFincasDto[]> {
    // Incluye fincas dadas de baja: es historial de altas.
    const filas: { mes: string; nuevas_fincas: string | number }[] =
      await this.finca_repo.query(
        `
        WITH meses AS (
          SELECT generate_series(
            date_trunc('month', now() AT TIME ZONE $1) - ($2::int - 1) * interval '1 month',
            date_trunc('month', now() AT TIME ZONE $1),
            interval '1 month'
          ) AS mes
        )
        SELECT to_char(m.mes, 'YYYY-MM') AS mes, COUNT(f.id_finca) AS nuevas_fincas
        FROM meses m
        LEFT JOIN fincas f
          ON date_trunc('month', f.fecha_alta_finca AT TIME ZONE $1) = m.mes
        GROUP BY m.mes
        ORDER BY m.mes ASC
        `,
        [ZONA_HORARIA_TABLERO, MESES_EVOLUCION_FINCAS],
      );

    return filas.map((fila) => ({
      mes: fila.mes,
      nuevas_fincas: Number(fila.nuevas_fincas),
    }));
  }

  private calcular_porcentaje(activos: number, inactivos: number): number {
    const total = activos + inactivos;
    if (total === 0) {
      return 0;
    }
    return Math.round((activos / total) * 1000) / 10;
  }
}
