import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CODIGO_ADMIN_CROPLY, CODIGO_ADMIN_FINCA } from '../../common/enums';
import { RolFinca, RolSistema } from './entities/rol.entity';

@Injectable()
export class RolesService implements OnModuleInit {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    @InjectRepository(RolSistema)
    private readonly rol_sistema_repo: Repository<RolSistema>,
    @InjectRepository(RolFinca)
    private readonly rol_finca_repo: Repository<RolFinca>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensure_seed_roles();
  }

  async ensure_seed_roles(): Promise<void> {
    await this.ensure_rol_sistema(CODIGO_ADMIN_CROPLY, 'Administrador Croply');
    await this.ensure_rol_finca(CODIGO_ADMIN_FINCA, 'Administrador de Finca');
  }

  async find_rol_sistema_by_codigo(codigo: string): Promise<RolSistema | null> {
    return this.rol_sistema_repo.findOne({ where: { codigo } });
  }

  async find_rol_sistema_by_id(id_rol: number): Promise<RolSistema | null> {
    return this.rol_sistema_repo.findOne({ where: { id_rol } });
  }

  async find_rol_finca_by_codigo(codigo: string): Promise<RolFinca | null> {
    return this.rol_finca_repo.findOne({ where: { codigo_rol_finca: codigo } });
  }

  private async ensure_rol_sistema(
    codigo: string,
    nombre_rol: string,
  ): Promise<void> {
    const existing = await this.rol_sistema_repo.findOne({ where: { codigo } });
    if (!existing) {
      await this.rol_sistema_repo.save(
        this.rol_sistema_repo.create({ codigo, nombre_rol }),
      );
      this.logger.log(`Rol de sistema sembrado: ${codigo}`);
    }
  }

  private async ensure_rol_finca(
    codigo_rol_finca: string,
    nombre_rol: string,
  ): Promise<void> {
    const existing = await this.rol_finca_repo.findOne({
      where: { codigo_rol_finca },
    });
    if (!existing) {
      await this.rol_finca_repo.save(
        this.rol_finca_repo.create({ codigo_rol_finca, nombre_rol }),
      );
      this.logger.log(`Rol de finca sembrado: ${codigo_rol_finca}`);
    }
  }
}
