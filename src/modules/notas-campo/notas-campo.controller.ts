import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiAuth, ApiErrorResponses } from '../../common/decorators';
import { PERMISO_FINCA } from '../../common/enums';
import { SWAGGER_TAGS } from '../../common/swagger';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminFincaGuard } from '../auth/guards/admin-finca.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermisoGuard } from '../auth/guards/permiso.guard';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ConvertirNotaDto, CrearNotaCampoDto } from './dto/notas-campo.dto';
import { MembresiaFincaPorParcelaGuard } from './guards/membresia-finca-por-parcela.guard';
import { NotasCampoService } from './notas-campo.service';

@ApiTags(SWAGGER_TAGS.NOTAS_CAMPO)
@Controller('notas-campo')
@UseGuards(JwtAuthGuard, PermisoGuard)
@RequirePermiso(PERMISO_FINCA.NOTAS_CAMPO)
@ApiAuth()
export class NotasCampoController {
  constructor(private readonly notas_service: NotasCampoService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Capturar una nota de campo' })
  @ApiCreatedResponse({ description: 'Nota guardada' })
  @ApiErrorResponses({ forbidden: true, notFound: true })
  crear(@Body() dto: CrearNotaCampoDto, @CurrentUser() usuario: Usuario) {
    return this.notas_service.crear(dto, usuario);
  }

  @Post(':id_nota_campo/convertir-en-tarea')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Convertir una nota de campo en tarea' })
  @ApiCreatedResponse({ description: 'Nota convertida en tarea' })
  @ApiErrorResponses({
    badRequest: true,
    forbidden: true,
    notFound: true,
    conflict: true,
  })
  convertir(
    @Param('id_nota_campo', ParseIntPipe) id_nota_campo: number,
    @Body() dto: ConvertirNotaDto,
    @CurrentUser() usuario: Usuario,
  ) {
    return this.notas_service.convertir(id_nota_campo, dto, usuario);
  }
}

@ApiTags(SWAGGER_TAGS.NOTAS_CAMPO)
@Controller('fincas')
@UseGuards(JwtAuthGuard, AdminFincaGuard, PermisoGuard)
@RequirePermiso(PERMISO_FINCA.NOTAS_CAMPO)
@ApiAuth()
export class NotasCampoFincaController {
  constructor(private readonly notas_service: NotasCampoService) {}

  @Get(':id_finca/notas-campo')
  @ApiOperation({ summary: 'Listar notas de campo de una finca' })
  @ApiOkResponse({ description: 'Notas de la finca' })
  @ApiErrorResponses({ badRequest: false, forbidden: true, notFound: true })
  listar(@Param('id_finca', ParseIntPipe) id_finca: number) {
    return this.notas_service.listar_por_finca(id_finca);
  }
}

@ApiTags(SWAGGER_TAGS.NOTAS_CAMPO)
@Controller('parcelas')
@UseGuards(JwtAuthGuard, MembresiaFincaPorParcelaGuard, PermisoGuard)
@RequirePermiso(PERMISO_FINCA.NOTAS_CAMPO)
@ApiAuth()
export class NotasCampoParcelaController {
  constructor(private readonly notas_service: NotasCampoService) {}

  @Get(':id_parcela/notas-campo')
  @ApiOperation({ summary: 'Listar notas de campo de una parcela' })
  @ApiOkResponse({ description: 'Notas de la parcela' })
  @ApiErrorResponses({ badRequest: false, forbidden: true, notFound: true })
  listar(@Param('id_parcela', ParseIntPipe) id_parcela: number) {
    return this.notas_service.listar_por_parcela(id_parcela);
  }
}
