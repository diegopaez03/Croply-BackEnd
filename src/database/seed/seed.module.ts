import { Module } from '@nestjs/common';
import { UsuariosModule } from '../../modules/usuarios';
import { RolesModule } from '../../modules/roles';
import { FincasModule } from '../../modules/fincas';
import { CultivosModule } from '../../modules/cultivos';
import { EstadosTareaModule } from '../../modules/estados-tarea';
import { TiposTareaModule } from '../../modules/tipos-tarea';
import { SeedService } from './seed.service';

@Module({
  imports: [
    UsuariosModule,
    RolesModule,
    FincasModule,
    CultivosModule,
    TiposTareaModule,
    EstadosTareaModule,
  ],
  providers: [SeedService],
})
export class SeedModule {}
