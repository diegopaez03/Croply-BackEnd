import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Finca } from './entities/finca.entity';
import { InvitacionFinca } from './entities/invitacion-finca.entity';
import { UsuarioFinca } from './entities/usuario-finca.entity';
import { FincasService } from './fincas.service';

@Module({
  imports: [TypeOrmModule.forFeature([Finca, UsuarioFinca, InvitacionFinca])],
  providers: [FincasService],
  exports: [FincasService, TypeOrmModule],
})
export class FincasModule {}
