import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TipoOperacion } from '../../common/enums';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { LogOperaciones } from './entities/log-operaciones.entity';

@Injectable()
export class LogOperacionesService {
  private readonly logger = new Logger(LogOperacionesService.name);

  constructor(
    @InjectRepository(LogOperaciones)
    private readonly log_repo: Repository<LogOperaciones>,
  ) {}

  /**
   * Side-effect de auditoría. Nunca debe fallar la operación principal.
   */
  async registrar(params: {
    usuario?: Usuario | null;
    tipo_operacion: TipoOperacion;
    descripcion: string;
    recurso?: string | null;
  }): Promise<void> {
    try {
      await this.log_repo.save(
        this.log_repo.create({
          usuario: params.usuario ?? null,
          tipo_operacion: params.tipo_operacion,
          descripcion: params.descripcion,
          recurso: params.recurso ?? null,
        }),
      );
    } catch (error) {
      this.logger.warn(
        `No se pudo registrar LogOperaciones: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
