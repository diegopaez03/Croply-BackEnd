import { DocumentBuilder, OpenAPIObject } from '@nestjs/swagger';

/**
 * Metadata and OpenAPI document options for Croply API.
 * Keep tags, servers and auth schemes in sync with feature modules.
 */
export const SWAGGER_PATH = 'docs';

export const SWAGGER_TAGS = {
  HEALTH: 'Health',
  AUTH: 'Auth',
  USUARIOS: 'Usuarios',
  FINCAS: 'Fincas',
  CULTIVOS: 'Cultivos',
  PARCELAS: 'Parcelas',
  REPORTS: 'Reportes',
  SOLICITUDES_DIGITALIZACION: 'SolicitudesDigitalizacion',
} as const;

export type SwaggerTag = (typeof SWAGGER_TAGS)[keyof typeof SWAGGER_TAGS];

export interface SwaggerSetupOptions {
  apiPrefix: string;
  port: number;
  nodeEnv: string;
}

/**
 * Builds the OpenAPI DocumentBuilder used by SwaggerModule.
 */
export function buildSwaggerConfig(
  options: Pick<SwaggerSetupOptions, 'apiPrefix' | 'port' | 'nodeEnv'>,
): Omit<OpenAPIObject, 'paths'> {
  const localUrl = `http://localhost:${options.port}`;

  const builder = new DocumentBuilder()
    .setTitle('Croply API')
    .setDescription(
      `
## Descripción

API REST del sistema de gestión agrícola **Croply**.

Permite administrar usuarios, fincas, parcelas, cultivos y reportes asociados a la operación agrícola.

## Autenticación

La mayoría de los endpoints requieren un JWT Bearer Token.

1. Obtener token vía \`POST /auth/login\`.
2. Incluir el header: \`Authorization: Bearer <token>\`.

## Convenciones

| Aspecto | Convención |
| --- | --- |
| Formato | JSON (\`application/json\`) |
| Prefijo | \`/${options.apiPrefix}\` |
| Fechas | ISO 8601 (\`YYYY-MM-DDTHH:mm:ss.sssZ\`) |
| Errores | Objeto con \`statusCode\`, \`errorCode\`, \`message\` y opcionalmente \`field\` |

## Ambientes

- **development**: documentación interactiva habilitada
- **production**: la UI de Swagger puede deshabilitarse por seguridad
      `.trim(),
    )
    .setVersion('0.1.0')
    .addServer(localUrl, 'Servidor local')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Ingresá el JWT obtenido en el login. Ejemplo: `eyJhbGciOi...`',
        in: 'header',
      },
      'access-token',
    )
    .addTag(SWAGGER_TAGS.HEALTH, 'Estado y disponibilidad del servicio')
    .addTag(SWAGGER_TAGS.AUTH, 'Registro, login y renovación de tokens')
    .addTag(SWAGGER_TAGS.USUARIOS, 'Gestión de usuarios')
    .addTag(SWAGGER_TAGS.FINCAS, 'Fincas')
    .addTag(SWAGGER_TAGS.CULTIVOS, 'Cultivos')
    .addTag(SWAGGER_TAGS.PARCELAS, 'Parcelas')
    .addTag(SWAGGER_TAGS.REPORTS, 'Reportes e informes')
    .addTag(
      SWAGGER_TAGS.SOLICITUDES_DIGITALIZACION,
      'Solicitudes de digitalización de finca',
    );

  if (options.nodeEnv === 'production') {
    builder.addServer('https://api.croply.app', 'Producción');
  }

  return builder.build();
}
