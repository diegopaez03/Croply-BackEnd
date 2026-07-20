# CONTEXT — Croply Backend

Guía de contexto para desarrollar con eficiencia en este repositorio. Resume propósito, setup, convenciones y forma de trabajo del equipo.

> **Alcance:** solo el backend NestJS. Frontend, simulador IoT y documentación de diseño viven fuera de este repo.

---

## 1. Descripción del proyecto

**Croply** es una plataforma web de apoyo a la gestión agrícola orientada a pequeños y medianos productores. Centraliza datos del entorno productivo (sensores/simulador IoT, clima, tareas de campo) para mejorar la toma de decisiones: visualizar el estado del cultivo, registrar actividades y generar alertas y recomendaciones contextuales.

**Este backend** es la API REST versionada (`api/v1`) que concentra el dominio transaccional:

- Autenticación y usuarios (JWT)
- Fincas, parcelas y cultivos
- Reportes

### Estado actual

Scaffold NestJS listo para crecer. Implementado: `HealthModule` (`GET /api/v1/health`). Placeholders (aún no montados en `AppModule`)

---

## 2. Guía de configuración inicial

### Requisitos

- Node.js ≥ 20
- pnpm ≥ 9 (el repo fija `pnpm@11.5.1`)
- PostgreSQL 16 en local

### Setup (desarrollo local)

Hoy el flujo es **solo local**. Railway y CI automáticos están previstos en el diseño del proyecto, pero **no están activos** en este repo.

```bash
# 1. Instalar dependencias
pnpm install

# 2. Variables de entorno
cp .env.example .env
# Ajustar DB_* si tu Postgres local usa otros valores

# 3. Asegurar que PostgreSQL está corriendo y que existe la DB (ej. croply_db)

# 4. Arrancar en hot-reload
pnpm start:dev
```

| Recurso | URL |
| --- | --- |
| API | `http://localhost:3000/api/v1` |
| Swagger UI | `http://localhost:3000/api/v1/docs` |
| OpenAPI JSON | `http://localhost:3000/api/v1/docs-json` |

Variables clave (ver `.env.example`): `PORT`, `API_PREFIX`, `SWAGGER_ENABLED`, `DB_*`, `JWT_*`, `CORS_ORIGIN`, `THROTTLE_*`.

### Migraciones

Preferir migraciones TypeORM automaticas durante el desarrollo. Mantener `DB_SYNCHRONIZE=true` (valor por defecto del ejemplo).

### Comandos útiles

```bash
pnpm build
pnpm start:dev
pnpm test
pnpm test:cov
pnpm test:e2e   # requiere carpeta test/ (aún pendiente de armar)
pnpm lint
pnpm format
```

---

## 3. Estructura del proyecto y roles del equipo

### Árbol relevante

```
src/
├── main.ts                 # Bootstrap: helmet, CORS, ValidationPipe, Swagger
├── app.module.ts           # Root; importar aquí cada feature module
├── config/                 # Swagger config, constantes de tags
├── database/               # TypeORM root + migrations/
├── common/
│   ├── dto/                # Paginación, errores, respuestas compartidas
│   ├── decorators/         # @ApiAuth, @ApiErrorResponses, @ApiPaginatedResponse
│   ├── swagger/            # setup + isSwaggerEnabled
│   └── guards|filters|...  # Preparados (stubs) para cross-cutting
├── utils/
└── modules/
    ├── health/             # Implementado — referencia de estilo
    ├── auth|usuarios|fincas|.../  # Pendientes
```

Path aliases (`tsconfig.json`): `@modules/*`, `@config/*`, `@common/*`, `@database/*`.

### Roles (equipo de 3)

Cada integrante combina varios roles. Para PRs a `main`, la revisión prioritaria es del Arquitecto.

| Persona | Roles principales |
| --- | --- |
| **Rodrigo Sanz** | Coordinador de proyecto; desarrollo FE/BE; análisis funcional |
| **Diego Páez** | **Arquitecto de Software**; desarrollo FE/BE; análisis funcional |
| **Paula Rodríguez** | Desarrollo frontend; análisis funcional; QA |

### Comunicación

| Canal | Uso |
| --- | --- |
| WhatsApp | Coordinación rápida, avisos, imprevistos |
| Discord | Trabajo colaborativo, debates técnicos, reuniones con minuta |
| Notion | Tablero Kanban y seguimiento de tareas |

---

## 4. Estándares y convenciones de código

### Naming

- Carpetas de módulos en **español** (`fincas`, `cultivos`, `parcelas`).
- Tags Swagger / lenguaje de dominio en **español** (`Fincas`, `Cultivos`, `Parcelas`).
- Archivos Nest: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.entity.ts`, `*.dto.ts`, `*.spec.ts`.
- DTOs: `CreateXDto`, `UpdateXDto`, `XResponseDto`, `XQueryDto`.
- Clases en PascalCase; atributos, métodos y variables de código en snake_case; constantes en `SCREAMING_SNAKE` (`SWAGGER_TAGS`).
- Nombres en la base de datos (Entidades) en snake_case

Mapeo tag ↔ carpeta (detalle en `docs/swagger-guidelines.md`):

| Tag Swagger | Módulo |
| --- | --- |
| Health | `modules/health` |
| Auth | `modules/auth` |
| Usuarios | `modules/usuarios` |
| Fincas | `modules/fincas` |
| Cultivos | `modules/cultivos` |
| Parcelas | `modules/parcelas` |
| ... | |

### Capas por feature

`*.module.ts` → `*.controller.ts` → `*.service.ts` → `entities/` + `dto/`. Registrar entidades con `TypeOrmModule.forFeature([...])` dentro del feature module. Exportar vía `index.ts` (barrel).

### Commits (Conventional Commits)

```
tipo(scope): descripción corta en minúsculas
```

Tipos habituales: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`.

Ejemplos: `feat(farms): agregar listado paginado de fincas`, `fix(auth): corregir expiración de refresh token`.

### Swagger / contrato API

Documentación OpenAPI **junto al código**. Checklist mínimo por endpoint:

1. `@ApiTags(SWAGGER_TAGS.X)` en el controller
2. `@ApiOperation({ summary, description })`
3. Body/query/params tipados con DTOs + `@ApiProperty`
4. Respuesta de éxito (`@ApiOkResponse` / `@ApiCreatedResponse` / `@ApiPaginatedResponse`)
5. Errores con `@ApiErrorResponses`
6. Si requiere JWT: `@ApiAuth()`

Reutilizar decoradores y DTOs de `src/common` antes de inventar esquemas nuevos. Guía completa: [`docs/swagger-guidelines.md`](docs/swagger-guidelines.md).

---

## 5. Stack tecnológico y herramientas clave

| Área | Tecnología |
| --- | --- |
| Runtime / lenguaje | Node ≥ 20, TypeScript ~5.4 |
| Framework | NestJS 11 |
| ORM / DB | TypeORM 0.3 + PostgreSQL 16 |
| Auth (deps listas) | JWT, Passport (local/jwt), bcrypt |
| Validación | class-validator + class-transformer |
| Docs API | @nestjs/swagger |
| Seguridad HTTP | helmet, compression, throttler |
| Package manager | pnpm |
| Tests | Jest, @nestjs/testing, supertest |

### Fuera de este repo (contexto)

Integraciones previstas a nivel proyecto (no setup en este scaffold): Railway (deploy futuro), Open-Meteo (clima), Croply IoT Simulator / series temporales. No bloquean el desarrollo local de módulos CRUD/auth.

---

## 6. Decisiones arquitectónicas y principios de diseño

1. **API modular Nest** — un feature module por dominio; el root (`AppModule`) solo orquesta imports.
2. **Contrato primero** — OpenAPI generado desde controllers/DTOs es la fuente de verdad para frontend y QA.
3. **PostgreSQL para datos transaccionales** — usuarios, fincas, parcelas, cultivos, tareas, etc.
4. **Auth JWT + refresh** — variables ya definidas en `.env.example`; el módulo `auth`/`users` es el siguiente paso natural.
5. **Validación y seguridad en el borde** — `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`), CORS configurable, rate limiting, helmet (CSP relajado fuera de producción para Swagger).
6. **Prefijo global `API_PREFIX`** — el controller solo declara el segmento local (`@Controller('health')` → `/api/v1/health`). En OpenAPI, el **server** es el origen (`http://localhost:3000`), sin repetir `api/v1`.

---

## 7. Flujo de trabajo

### Ramas

| Rama | Propósito |
| --- | --- |
| `main` | Producción / versión estable. Solo merge desde `develop` vía PR aprobado |
| `develop` | Integración de features validadas |
| `feature/nombre-descriptivo` | Trabajo de funcionalidad (desde `develop`) |
| `fix/descripcion-breve` | Bugs (desde `develop`; hotfix crítico puede salir de `main`) |
| `docs/nombre` | Solo documentación |

No hay push directo a `main` ni `develop`.

### Deploy (hoy vs objetivo)

| Hoy | Objetivo de diseño |
| --- | --- |
| Desarrollo y prueba en máquina local | Deploy en Railway; CI (GitHub Actions) al integrar |

---

## 8. Procesos de testing y calidad

### Estándar: TDD con Jest

Al agregar o cambiar lógica de un módulo, trabajar en ciclo **red → green**:

1. Escribir el test que falla (comportamiento en la interfaz pública / seam acordado).
2. Implementar lo mínimo para pasarlo.
3. Repetir en slices verticales; no acoplar tests a detalles internos.

Referencia de práctica TDD en el repo: [`.agent/skills/Test-Driven Development/`](.agent/skills/Test-Driven%20Development/).

### Qué cubrir

- **Unitarios** de servicios y reglas de negocio con mocks (sin Postgres real).
- Scripts: `pnpm test`, `pnpm test:watch`, `pnpm test:cov`.
- **E2E**: script `pnpm test:e2e` existe, pero la carpeta `test/` / `jest-e2e.json` **aún no está armada** — documentar e implementar al adoptar e2e de verdad.

### Antes de pasar una tarjeta a revisión

- [ ] Tests del cambio en verde
- [ ] Checklist Swagger del endpoint (sección 4)
- [ ] Validación local (`pnpm start:dev` + probar en Swagger si aplica)
- [ ] Commit con Conventional Commits

### Deuda conocida de calidad

- Dependencias ESLint/Prettier y scripts `lint`/`format` presentes; **falta config de proyecto** (eslint/prettier) — no asumir que `pnpm lint` está listo sin verificar.
- Sin workflows CI en este repo todavía.

---

## 9. Troubleshooting común

| Síntoma | Qué revisar |
| --- | --- |
| La app no arranca / error de conexión a DB | Postgres local levantado; `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` en `.env`; base creada |
| Swagger no carga o assets bloqueados | `SWAGGER_ENABLED`; fuera de `production` helmet desactiva CSP a propósito en `main.ts` |
| URLs duplicadas tipo `/api/v1/api/v1/...` en OpenAPI | El server OpenAPI debe ser solo el origen (`http://localhost:3000`), no incluir `API_PREFIX` |
| Endpoint 404 de un módulo nuevo | ¿Está importado el feature module en `app.module.ts`? ¿Coincide el path del `@Controller`? |
| Schema desfasado o tablas inexistentes | Correr `pnpm migration:run`; no activar `DB_SYNCHRONIZE=true` como atajo en entornos serios |
| `pnpm test:e2e` falla de entrada | Falta `test/jest-e2e.json` — deuda conocida |
| `pnpm lint` / `format` confusos | Config ESLint/Prettier de proyecto aún no cerrada |

Health de humo: `GET http://localhost:3000/api/v1/health` debe responder status del servicio.

---

## 10. Contactos y referencias

### Equipo

- **Rodrigo Sanz** — Coordinador
- **Diego Páez** — Arquitecto de Software (review prioritario a `main`)
- **Paula Rodríguez** — Frontend / QA

Canales: WhatsApp (día a día), Discord (técnico), Notion (tablero).

### Docs en este repo

- [`README.md`](README.md) — setup rápido
- [`docs/swagger-guidelines.md`](docs/swagger-guidelines.md) — contrato OpenAPI
- [`.env.example`](.env.example) — variables documentadas
- [`.agent/skills/Test-Driven Development/`](.agent/skills/Test-Driven%20Development/) — práctica TDD

---

*Documento vivo: actualizarlo cuando cambie el flujo real (CI, Railway, primer módulo de dominio, o convenciones de lint).*
