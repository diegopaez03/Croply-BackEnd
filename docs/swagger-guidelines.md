# Guía de documentación OpenAPI (Swagger) — Croply Backend

Esta guía define cómo documentar endpoints, DTOs y errores en el backend NestJS
para mantener la especificación OpenAPI consistente y útil para frontend, QA y stakeholders.

## Acceso

Las rutas dependen de `API_PREFIX` en `.env` (valor por defecto: `api/v1`).

| Recurso | URL (desarrollo) |
| --- | --- |
| Base de la API | `http://localhost:3000/api/v1` |
| Swagger UI | `http://localhost:3000/api/v1/docs` |
| OpenAPI JSON | `http://localhost:3000/api/v1/docs-json` |

Swagger se registra solo si `isSwaggerEnabled()` lo permite:

- Por defecto: **habilitado** cuando `NODE_ENV !== production`
- Override explícito: `SWAGGER_ENABLED=true|false` en `.env` (ver `.env.example`)

## Configuración (cómo encaja todo)

| Pieza | Ubicación | Rol |
| --- | --- | --- |
| Prefijo global | `main.ts` → `app.setGlobalPrefix(API_PREFIX)` | Todas las rutas HTTP llevan `/{API_PREFIX}/...` |
| DocumentBuilder | `src/config/swagger.config.ts` → `buildSwaggerConfig()` | Título, descripción, tags, Bearer, **servidores OpenAPI** |
| Registro UI/JSON | `src/common/swagger/swagger.setup.ts` → `setupSwagger()` | Monta docs en `/{API_PREFIX}/docs` |
| Constantes | `SWAGGER_TAGS`, `SWAGGER_PATH` | Tags y segmento `docs` |

Flujo en arranque (`main.ts`):

1. Leer `PORT`, `NODE_ENV`, `API_PREFIX`
2. Aplicar prefijo global
3. Si Swagger está habilitado → `setupSwagger(app, { apiPrefix, port, nodeEnv })`

### Servidores OpenAPI y prefijo global

Nest incluye el prefijo global en cada **path** del documento (ej. `/api/v1/health`).

Por eso el servidor local en OpenAPI debe ser **solo el origen**, sin repetir el prefijo:

- Correcto: `http://localhost:3000` + path `/api/v1/health` → `http://localhost:3000/api/v1/health`
- Incorrecto: `http://localhost:3000/api/v1` + path `/api/v1/health` → URL duplicada

En producción, `buildSwaggerConfig()` agrega `https://api.croply.app` (origen, sin path extra).

### UI de Swagger

Opciones relevantes en `setupSwagger()`:

- `persistAuthorization: true` — conserva el JWT al recargar
- `tryItOutEnabled: true` — “Try it out” activo por defecto
- `jsonDocumentUrl` — expone el JSON en `/{API_PREFIX}/docs-json`

En desarrollo, `helmet` desactiva CSP para que carguen los assets de Swagger UI (`main.ts`).

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

Ruta expuesta: `/{API_PREFIX}/<controller-path>` — el controller define solo el segmento local (ej. `@Controller('health')` → `GET /api/v1/health`).

## Estructura recomendada de un controller

Referencia viva: `src/modules/health/health.controller.ts` (`GET /api/v1/health`, sin auth).

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
import { FincaResponseDto } from './dto/finca-response.dto';

@ApiTags(SWAGGER_TAGS.FINCAS)
@ApiAuth()
@Controller('fincas')
export class FincasController {
  @Get()
  @ApiOperation({
    summary: 'Listar fincas',
    description: 'Devuelve las fincas del usuario autenticado, paginadas.',
  })
  @ApiPaginatedResponse(FincaResponseDto)
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

export class CreateFincaDto {
  @ApiProperty({
    description: 'Nombre de la finca',
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
  "path": "/api/v1/auth/login"
}
```

Usar `@ApiErrorResponses()` y activar solo los códigos relevantes
(`forbidden`, `notFound`, etc.).

## Autenticación en Swagger UI

1. Obtener JWT con `POST /api/v1/auth/login` (usar un admin del seed, ej. `diego@croply.app`).
2. En Swagger UI → **Authorize** → pegar el token (sin prefijo `Bearer`).
3. `persistAuthorization` está activo: el token se conserva al recargar en desarrollo.

El nombre del security scheme es **`access-token`**. Debe coincidir con `@ApiBearerAuth('access-token')` / `@ApiAuth()`.

## Shape de errores

Alineado al contrato de Épica 1 (`ErrorResponseDto`):

```json
{
  "statusCode": 400,
  "errorCode": "REQUIRED_FIELD",
  "field": "email",
  "message": "Campo requerido"
}
```

Usar `@ApiErrorResponses()` y activar solo los códigos relevantes (`forbidden`, `conflict`, `gone`, etc.).

## Tags del dominio

Los valores de tag en Swagger coinciden con `SWAGGER_TAGS`. Las carpetas de módulos están en **español**.

| Constante `SWAGGER_TAGS` | Tag en Swagger | Módulo (carpeta) |
| --- | --- | --- |
| `HEALTH` | Health | `modules/health` |
| `AUTH` | Auth | `modules/auth` |
| `USUARIOS` | Usuarios | `modules/usuarios` |
| `FINCAS` | Fincas | `modules/fincas` |
| `CULTIVOS` | Cultivos | `modules/cultivos` |
| `PARCELAS` | Parcelas | `modules/parcelas` |
| `REPORTS` | Reportes | `modules/reportes` |
| `SOLICITUDES_DIGITALIZACION` | SolicitudesDigitalizacion | `modules/solicitudes-digitalizacion` |

Al agregar un dominio nuevo:

1. Añadir entrada en `SWAGGER_TAGS` (`swagger.config.ts`)
2. Registrar `.addTag(...)` en `buildSwaggerConfig()`
3. Usar `@ApiTags(SWAGGER_TAGS.NUEVO)` en el controller

## Plugin `@nestjs/swagger`

Configurado en `nest-cli.json` con:

- `classValidatorShim`: refleja validadores en el schema
- `introspectComments`: usa comentarios JSDoc como descripción si faltan decoradores
- sufijos `.dto.ts`, `.entity.ts`, `.controller.ts`

Tras cambiar opciones del plugin, reiniciar `pnpm start:dev`.

## Referencia de archivos

| Archivo | Rol |
| --- | --- |
| `src/config/swagger.config.ts` | Metadata OpenAPI, tags, Bearer, servidores |
| `src/common/swagger/swagger.setup.ts` | Registro de UI/JSON, opciones de Swagger UI |
| `src/common/swagger/index.ts` | Reexport de setup + tags |
| `src/common/dto/*` | Envelopes, paginación y errores compartidos |
| `src/common/decorators/*` | `@ApiAuth`, `@ApiErrorResponses`, `@ApiPaginatedResponse` |
| `src/modules/health/*` | Endpoint de ejemplo documentado de punta a punta |
| `src/modules/auth/*` | Login y resto de HU de acceso (Épica 1) |
| `docs/diseño/Contexto — Diagrama de clases.md` | UML ↔ entidades implementadas |

## Anti-patrones a evitar

- Tags o descriptions hardcodeadas distintas a `SWAGGER_TAGS`
- Endpoints sin `@ApiOperation`
- DTOs sin `@ApiProperty` (schemas vacíos en Swagger)
- Documentar 200 con un tipo genérico `object` cuando existe un DTO concreto
- Exponer Swagger en producción sin decisión explícita (`SWAGGER_ENABLED`)
- **Incluir `API_PREFIX` en `addServer()`** — duplica rutas en “Try it out”
- Asumir paths sin prefijo en ejemplos de `path` en errores (usar `/api/v1/...`)
