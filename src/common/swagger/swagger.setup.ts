import { INestApplication } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import {
  SWAGGER_PATH,
  SwaggerSetupOptions,
  buildSwaggerConfig,
} from '../../config/swagger.config';

/**
 * Registers Swagger UI and the OpenAPI JSON document on the Nest application.
 *
 * - UI:   `/{apiPrefix}/docs`
 * - JSON: `/{apiPrefix}/docs-json`
 */
export function setupSwagger(
  app: INestApplication,
  options: SwaggerSetupOptions,
): void {
  const config = buildSwaggerConfig(options);
  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (_controllerKey: string, methodKey: string) =>
      methodKey,
    deepScanRoutes: true,
  });

  SwaggerModule.setup(`${options.apiPrefix}/${SWAGGER_PATH}`, app, document, {
    customSiteTitle: 'Croply API Docs',
    customfavIcon: 'https://nestjs.com/img/logo-small.svg',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
      showRequestDuration: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      tryItOutEnabled: true,
    },
    jsonDocumentUrl: `${options.apiPrefix}/${SWAGGER_PATH}-json`,
  });
}

/**
 * Whether Swagger UI should be exposed for the current environment.
 * Enabled by default outside production; override with SWAGGER_ENABLED=true|false.
 */
export function isSwaggerEnabled(nodeEnv: string): boolean {
  const flag = process.env.SWAGGER_ENABLED;

  if (flag !== undefined) {
    return flag === 'true' || flag === '1';
  }

  return nodeEnv !== 'production';
}
