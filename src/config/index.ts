/**
 * Config barrel export.
 * Environment-specific configuration factories and OpenAPI metadata.
 */
export {
  SWAGGER_PATH,
  SWAGGER_TAGS,
  buildSwaggerConfig,
} from './swagger.config';
export type { SwaggerTag, SwaggerSetupOptions } from './swagger.config';
