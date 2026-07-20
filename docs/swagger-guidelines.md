# Guía de documentación OpenAPI (Swagger) — Croply Backend

Esta guía define cómo documentar endpoints, DTOs y errores en el backend NestJS
para mantener la especificación OpenAPI consistente y útil para frontend, QA y stakeholders.

## Acceso

| Recurso | URL |
| --- | --- |
| Swagger UI | `http://localhost:3000/api/docs` |
| OpenAPI JSON | `http://localhost:3000/api/docs-json` |

Controlado por `SWAGGER_ENABLED` (ver `.env.example`). Por defecto está **habilitado**
fuera de `production`.

## Principios

1. **La documentación vive junto al código** — decoradores en controllers/DTOs, no docs sueltas desactualizadas.
2. **Contrato primero** — cada endpoint público debe declarar operación, body/query, respuestas de éxito y errores típicos.
3. **Reutilizar** — usar DTOs y decoradores de `src/common` antes de inventar esquemas nuevos.
4. **Ejemplos reales** — `example` en `@ApiProperty` con valores representativos del dominio agrícola.
5. **Tags estables** — usar `SWAGGER_TAGS` de `src/config/swagger.config.ts` (no strings sueltos).

## Checklist por endpoint

Al crear o modificar un handler:

- [ ] `@ApiTags(SWAGGER_TAGS.X)` en el controller
- [ ] `@ApiOperation({ summary, description })` en el método
- [ ] Body / query / params tipados con DTOs + `@ApiProperty` / validadores
- [ ] Respuesta de éxito (`@ApiOkResponse`, `@ApiCreatedResponse` o `@ApiPaginatedResponse`)
- [ ] Errores con `@ApiErrorResponses({ ... })`
- [ ] Si requiere JWT: `@ApiAuth()` (o `@ApiBearerAuth('access-token')` a nivel controller)

## Estructura recomendada de un controller

```ts
import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SWAGGER_TAGS } from '../../common/swagger';
import {
  ApiAuth,
  ApiErrorResponses,
  ApiPaginatedResponse,
} from '../../common/decorators';
import { PaginationQueryDto } from '../../common/dto';
import { FarmResponseDto } from './dto/farm-response.dto';

@ApiTags(SWAGGER_TAGS.FARMS)
@ApiAuth()
@Controller('farms')
export class FarmsController {
  @Get()
  @ApiOperation({
    summary: 'Listar establecimientos',
    description: 'Devuelve los farms del usuario autenticado, paginados.',
  })
  @ApiPaginatedResponse(FarmResponseDto)
  @ApiErrorResponses({ forbidden: true })
  findAll(@Query() query: PaginationQueryDto) {
    // ...
  }
}
```

## DTOs

### Reglas

- Un DTO por responsabilidad: `CreateXDto`, `UpdateXDto`, `XResponseDto`, `XQueryDto`.
- Documentar **todos** los campos con `@ApiProperty` o `@ApiPropertyOptional`.
- Incluir `description`, `example` y, si aplica, `enum` / `minimum` / `maximum`.
- Combinar con `class-validator` (`@IsString`, `@IsEmail`, etc.): el plugin de Nest
  (`nest-cli.json`) refleja muchas restricciones en el schema automáticamente.

### Ejemplo

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateFarmDto {
  @ApiProperty({
    description: 'Nombre del establecimiento',
    example: 'Estancia La Esperanza',
    maxLength: 120,
  })
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({
    description: 'Notas internas',
    example: 'Campo con riego por pivote',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
```

## Errores estándar

El shape documentado es `ErrorResponseDto`:

```json
{
  "statusCode": 400,
  "message": ["email must be an email"],
  "error": "Bad Request",
  "timestamp": "2026-07-20T15:30:00.000Z",
  "path": "/api/auth/login"
}
```

Usar `@ApiErrorResponses()` y activar solo los códigos relevantes
(`forbidden`, `notFound`, etc.).

## Autenticación en Swagger UI

1. Obtener JWT (endpoint de login, cuando exista).
2. En Swagger UI → **Authorize** → pegar el token (sin prefijo `Bearer`).
3. `persistAuthorization` está activo: el token se conserva al recargar en desarrollo.

El nombre del security scheme es **`access-token`**. Debe coincidir con `@ApiBearerAuth('access-token')` / `@ApiAuth()`.

## Tags del dominio

| Tag | Módulo |
| --- | --- |
| Health | `modules/health` |
| Auth | `modules/auth` |
| Users | `modules/users` |
| Farms | `modules/farms` |
| Crops | `modules/crops` |
| Plots | `modules/plots` |
| Reports | `modules/reports` |

Al agregar un dominio nuevo: declarar el tag en `SWAGGER_TAGS` y en `buildSwaggerConfig()`.

## Plugin `@nestjs/swagger`

Configurado en `nest-cli.json` con:

- `classValidatorShim`: refleja validadores en el schema
- `introspectComments`: usa comentarios JSDoc como descripción si faltan decoradores
- sufijos `.dto.ts`, `.entity.ts`, `.controller.ts`

Tras cambiar opciones del plugin, reiniciar `pnpm start:dev`.

## Referencia de archivos

| Archivo | Rol |
| --- | --- |
| `src/config/swagger.config.ts` | Metadata OpenAPI, tags, Bearer |
| `src/common/swagger/swagger.setup.ts` | Registro de UI/JSON |
| `src/common/dto/*` | Envelopes y errores compartidos |
| `src/common/decorators/*` | `@ApiAuth`, `@ApiErrorResponses`, `@ApiPaginatedResponse` |
| `src/modules/health/*` | Endpoint de ejemplo documentado de punta a punta |

## Anti-patrones a evitar

- Tags o descriptions hardcodeadas distintas a `SWAGGER_TAGS`
- Endpoints sin `@ApiOperation`
- DTOs sin `@ApiProperty` (schemas vacíos en Swagger)
- Documentar 200 con un tipo genérico `object` cuando existe un DTO concreto
- Exponer Swagger en producción sin decisión explícita (`SWAGGER_ENABLED`)
