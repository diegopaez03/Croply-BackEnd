# Croply — Backend API

NestJS v11 · TypeORM · PostgreSQL 16 · TypeScript · OpenAPI (Swagger)

## Setup local (sin Docker)

```bash
# 1. Instalar dependencias
pnpm install

# 2. Copiar variables de entorno
cp .env.example .env

# 3. Levantar en modo desarrollo (hot-reload)
pnpm start:dev
```

La API estará disponible en `http://localhost:3000/api/v1`  
Swagger UI en `http://localhost:3000/api/v1/docs`  
OpenAPI JSON en `http://localhost:3000/api/v1/docs-json`

## Documentación de la API (Swagger)

La documentación OpenAPI se genera desde el código (controllers, DTOs y decoradores).

- **Guía de convenciones:** [docs/swagger-guidelines.md](./docs/swagger-guidelines.md)
- **Endpoint de ejemplo:** `GET /api/v1/health` (módulo Health)
- **Control:** variable `SWAGGER_ENABLED` en `.env` (por defecto activo fuera de `production`)

Al desarrollar un módulo nuevo, seguir el checklist de la guía y reutilizar:

- `SWAGGER_TAGS` — tags del dominio
- `@ApiAuth()` — endpoints protegidos con JWT
- `@ApiErrorResponses()` — errores HTTP estándar
- `@ApiPaginatedResponse(Dto)` — listados paginados
- DTOs en `src/common/dto`

## Migrations

```bash
# Generar nueva migración
pnpm migration:generate src/database/migrations/NombreMigracion

# Ejecutar migraciones pendientes
pnpm migration:run

# Revertir última migración
pnpm migration:revert
```

## Tests

```bash
pnpm test           # Unit tests
pnpm test:cov       # With coverage report
pnpm test:e2e       # End-to-end tests
```
