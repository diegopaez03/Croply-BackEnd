# Croply — Backend API

NestJS v11 · TypeORM · PostgreSQL 16 · TypeScript · OpenAPI (Swagger)

## Setup local (sin Docker)

```bash
# 1. Instalar dependencias
pnpm install

# 2. Copiar variables de entorno
cp .env.example .env

# 3. PostgreSQL local corriendo + DB creada (ej. croply_db)

# 4. Levantar en modo desarrollo (hot-reload)
pnpm start:dev
```

| Recurso | URL |
| --- | --- |
| API | `http://localhost:3000/api/v1` |
| Swagger UI | `http://localhost:3000/api/v1/docs` |
| OpenAPI JSON | `http://localhost:3000/api/v1/docs-json` |

## Credenciales de prueba (seed)

Al arrancar se crean automáticamente (si no existen) tres admins Croply:

| Usuario | Email | Contraseña |
| --- | --- | --- |
| Diego Páez | `diego@croply.app` | `CroplyAdmin123!` |
| Rodrigo Sanz | `rodrigo@croply.app` | `CroplyAdmin123!` |
| Paula Rodríguez | `paula@croply.app` | `CroplyAdmin123!` |

La contraseña se puede cambiar con `SEED_ADMIN_PASSWORD` en `.env`.

Probar login: `POST /api/v1/auth/login` con `{ "email": "diego@croply.app", "contrasena": "CroplyAdmin123!" }`.

## Qué hay implementado

**Épica 1 — Gestionar el Acceso:** auth (login, registro admin/invitado, olvide/resetear/cambiar contraseña, primer acceso), solicitudes de digitalización, errores transversales, seed de admins.

Detalle y fuera de alcance: [`CONTEXT.md`](./CONTEXT.md) y el [contrato de Épica 1](./docs/epicas/Contrato%20de%20API%20—%20Épica%201%20Gestionar%20el%20Acceso.md).

## Documentación

| Doc | Uso |
| --- | --- |
| [CONTEXT.md](./CONTEXT.md) | Contexto completo del backend |
| [docs/swagger-guidelines.md](./docs/swagger-guidelines.md) | Convenciones OpenAPI |
| [docs/epicas/…](./docs/epicas/) | Contratos por épica |
| [docs/diseño/Contexto — Diagrama de clases.md](./docs/diseño/Contexto%20—%20Diagrama%20de%20clases.md) | UML ↔ código |
| [docs/diseño/Diagrama UML…](./docs/diseño/Diagrama%20UML%20-%20Diagrama%20de%20clases.jpg) | Imagen del diagrama |

Swagger se genera desde el código. Control: `SWAGGER_ENABLED` en `.env`.

Al desarrollar un módulo nuevo, seguir el checklist de la guía y reutilizar `SWAGGER_TAGS`, `@ApiAuth()`, `@ApiErrorResponses()`, DTOs en `src/common/dto`.

## Migrations

```bash
pnpm migration:generate src/database/migrations/NombreMigracion
pnpm migration:run
pnpm migration:revert
```

En desarrollo local el ejemplo usa `DB_SYNCHRONIZE=true`.

## Tests

```bash
pnpm test           # Unit tests
pnpm test:cov       # Coverage
pnpm test:e2e       # E2E (carpeta test/ aún pendiente)
```
