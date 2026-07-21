# CONTEXT — Croply Backend

Guía de contexto para desarrollar con eficiencia en este repositorio. Resume propósito, setup, convenciones y forma de trabajo del equipo.

> **Alcance:** solo el backend NestJS. Frontend y simulador IoT viven fuera de este repo. La documentación de diseño de dominio (diagrama de clases) **sí** vive aquí bajo [`docs/diseño/`](docs/diseño/).

---

## 1. Descripción del proyecto

**Croply** es una plataforma web de apoyo a la gestión agrícola orientada a pequeños y medianos productores. Centraliza datos del entorno productivo (sensores/simulador IoT, clima, tareas de campo) para mejorar la toma de decisiones: visualizar el estado del cultivo, registrar actividades y generar alertas y recomendaciones contextuales.

**Este backend** es la API REST versionada (`api/v1`) que concentra el dominio transaccional:

- Autenticación y usuarios (JWT)
- Fincas, parcelas y cultivos
- Reportes
- Solicitudes de digitalización

### Estado actual

**Épica 1 — Gestionar el Acceso** implementada:

| Módulo | Contenido |
| --- | --- |
| `health` | `GET /health` |
| `auth` | Login, registro admin finca / invitado, reset y cambio de contraseña, primer acceso |
| `usuarios` | Entidad + servicio de usuarios |
| `fincas` | Stub `Finca`, `UsuarioFinca`, `InvitacionFinca` |
| `roles` | STI `Rol` / `RolSistema` / `RolFinca` + seed de códigos |
| `solicitudes-digitalizacion` | `POST /solicitudes-digitalizacion` |
| `database/seed` | Admins Croply del equipo (Diego, Rodrigo, Paula) |

Placeholders (sin lógica de negocio aún): `parcelas`, `cultivos`, `reportes`.

Contrato: [`docs/epicas/Contrato de API — Épica 1 Gestionar el Acceso.md`](docs/epicas/Contrato%20de%20API%20—%20Épica%201%20Gestionar%20el%20Acceso.md).

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

Variables clave (ver `.env.example`): `PORT`, `API_PREFIX`, `SWAGGER_ENABLED`, `DB_*`, `JWT_*`, `CORS_ORIGIN`, `THROTTLE_*`, `SEED_ADMIN_PASSWORD`.

### Credenciales de prueba (seed)

Al arrancar, si la DB responde, se crean (si no existen) tres usuarios `ADMIN_CROPLY`:

| Persona | Email | Contraseña |
| --- | --- | --- |
| Diego Páez | `diego@croply.app` | `CroplyAdmin123!` (o `SEED_ADMIN_PASSWORD`) |
| Rodrigo Sanz | `rodrigo@croply.app` | misma |
| Paula Rodríguez | `paula@croply.app` | misma |

Estado: `Activo`. Seed idempotente (`src/database/seed`).

### Migraciones

Preferir `DB_SYNCHRONIZE=true` en desarrollo local (valor por defecto del ejemplo). En entornos serios: migraciones TypeORM (`pnpm migration:*`).

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
├── main.ts                 # Bootstrap: helmet, CORS, ValidationPipe, filter global, Swagger
├── app.module.ts           # Root; feature modules + SeedModule
├── config/                 # Swagger config, constantes de tags
├── database/
│   ├── database.module.ts
│   ├── migrations/
│   └── seed/               # Admins Croply de desarrollo
├── common/
│   ├── dto/                # Paginación, ErrorResponse (errorCode/field), respuestas
│   ├── decorators/         # @ApiAuth, @ApiErrorResponses, @ApiPaginatedResponse
│   ├── exceptions/         # DomainException + helpers ERR-01/02/03
│   ├── filters/            # AllExceptionsFilter
│   ├── mailer/             # MailerStubService (log de links)
│   ├── enums/              # EstadoUsuario, roles, etc.
│   └── swagger/
└── modules/
    ├── health/
    ├── auth/               # JWT, guards, endpoints /auth/*
    ├── usuarios/
    ├── fincas/
    ├── roles/
    ├── solicitudes-digitalizacion/
    ├── parcelas/           # placeholder
    ├── cultivos/           # placeholder
    └── reportes/           # placeholder
```

Path aliases (`tsconfig.json`): `@modules/*`, `@config/*`, `@common/*`, `@database/*`.

### Roles (equipo de 3)

| Persona | Roles principales |
| --- | --- |
| **Rodrigo Sanz** | Coordinador de proyecto; desarrollo FE/BE; análisis funcional |
| **Diego Páez** | **Arquitecto de Software**; desarrollo FE/BE; análisis funcional |
| **Paula Rodríguez** | Desarrollo frontend; análisis funcional; QA |

Para PRs a `main`, la revisión prioritaria es del Arquitecto.

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
- Tags Swagger / lenguaje de dominio en **español**.
- Archivos Nest: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.entity.ts`, `*.dto.ts`, `*.spec.ts`.
- DTOs: `CreateXDto`, `UpdateXDto`, `XResponseDto`, `XQueryDto`.
- Clases en PascalCase; atributos, métodos y variables de código en snake_case; constantes en `SCREAMING_SNAKE`.
- Columnas DB en snake_case; JSON de API según contrato (mezcla `id_Usuario` / `accessToken`).

| Tag Swagger | Módulo |
| --- | --- |
| Health | `modules/health` |
| Auth | `modules/auth` |
| Usuarios | `modules/usuarios` |
| Fincas | `modules/fincas` |
| Cultivos | `modules/cultivos` |
| Parcelas | `modules/parcelas` |
| Reportes | `modules/reportes` |
| SolicitudesDigitalizacion | `modules/solicitudes-digitalizacion` |

### Capas por feature

`*.module.ts` → `*.controller.ts` → `*.service.ts` → `entities/` + `dto/`. Registrar entidades con `TypeOrmModule.forFeature([...])`. Exportar vía `index.ts`.

### Errores API (shape transversal)

```json
{ "statusCode": 400, "errorCode": "REQUIRED_FIELD", "field": "email", "message": "Campo requerido" }
```

Implementado en `AllExceptionsFilter` + `DomainException`. Ver contrato Épica 1 (ERR-01/02/03).

### Commits (Conventional Commits)

```
tipo(scope): descripción corta en minúsculas
```

Tipos: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`.

### Swagger / contrato API

Checklist por endpoint: `@ApiTags`, `@ApiOperation`, DTOs + `@ApiProperty`, respuesta de éxito, `@ApiErrorResponses`, `@ApiAuth()` si JWT.

Guía: [`docs/swagger-guidelines.md`](docs/swagger-guidelines.md).

---

## 5. Stack tecnológico y herramientas clave

| Área | Tecnología |
| --- | --- |
| Runtime / lenguaje | Node ≥ 20, TypeScript ~5.4 |
| Framework | NestJS 11 |
| ORM / DB | TypeORM 0.3 + PostgreSQL 16 |
| Auth | JWT, Passport JWT, bcrypt |
| Validación | class-validator + class-transformer |
| Docs API | @nestjs/swagger |
| Seguridad HTTP | helmet, compression, throttler |
| Package manager | pnpm |
| Tests | Jest, @nestjs/testing |

### Fuera de este repo (contexto)

Railway (deploy futuro), Open-Meteo (clima), Croply IoT Simulator. No bloquean el desarrollo local de auth/CRUD.

---

## 6. Decisiones arquitectónicas

1. **API modular Nest** — un feature module por dominio; `AppModule` solo orquesta.
2. **Contrato primero** — OpenAPI + docs de épica; el frontend se programa contra el contrato.
3. **PostgreSQL** para datos transaccionales.
4. **Auth JWT** — access token en login; refresh previsto en `.env` pero **fuera de alcance** de Épica 1.
5. **Validación y seguridad en el borde** — `ValidationPipe` global, CORS, throttle, helmet, filter de excepciones.
6. **Prefijo `API_PREFIX`** — el controller solo declara el segmento local. Server OpenAPI = origen sin prefijo.
7. **Mailer stub** en desarrollo (links en log); SMTP real fuera de alcance actual.
8. **UML ↔ código**: ver [`docs/diseño/Contexto — Diagrama de clases.md`](docs/diseño/Contexto%20—%20Diagrama%20de%20clases.md).

### Regla de login (Épica 1)

- `Inactivo` → 403 `ACCOUNT_NOT_ACTIVE`
- `Pendiente` sin cambio forzado de clave → 403
- `Pendiente` + `debe_cambiar_contrasena: true` → 200 (habilita HU-AC-06)
- `Activo` → 200

---

## 7. Fuera de alcance (hoy)

Respecto de Épica 1 y del diagrama completo:

- CRUD de fincas, parcelas, cultivos, reportes
- `Permiso` / `RolPermiso` / RBAC granular
- `LogOperaciones`, notificaciones
- SMTP real
- Refresh token como endpoint
- Suite e2e Nest (`test/jest-e2e.json` pendiente)
- CI (GitHub Actions) y deploy Railway en este repo
- Config ESLint/Prettier de proyecto cerrada (scripts existen; no asumir que `pnpm lint` está listo)

---

## 8. Flujo de trabajo

| Rama | Propósito |
| --- | --- |
| `main` | Producción / estable. Merge desde `develop` vía PR |
| `develop` | Integración de features |
| `feature/nombre-descriptivo` | Funcionalidad (desde `develop`) |
| `fix/descripcion-breve` | Bugs |
| `docs/nombre` | Solo documentación |

No hay push directo a `main` ni `develop`.

| Hoy | Objetivo |
| --- | --- |
| Desarrollo local | Railway + CI al integrar |

---

## 9. Testing y calidad

Estándar: **TDD** (red → green) en seams acordados. Skill: [`.agent/skills/Test-Driven Development/`](.agent/skills/Test-Driven%20Development/).

Seams actuales de Épica 1: `AllExceptionsFilter`, `AuthService`, `SolicitudesDigitalizacionService`, `SeedService`.

Antes de pasar a revisión:

- [ ] Tests en verde
- [ ] Checklist Swagger
- [ ] Probar en Swagger si aplica
- [ ] Commit Conventional Commits

---

## 10. Troubleshooting

| Síntoma | Qué revisar |
| --- | --- |
| App no arranca / error DB | Postgres; `DB_*` en `.env`; base creada |
| Swagger bloqueado | `SWAGGER_ENABLED`; CSP relajado fuera de `production` |
| URLs `/api/v1/api/v1/...` en OpenAPI | Server OpenAPI solo origen |
| Endpoint 404 | ¿Módulo importado en `AppModule`? ¿Path del `@Controller`? |
| No hay admins para login | Seed al arrancar; emails `*@croply.app`; ver logs `SeedService` |
| Schema / tablas | `DB_SYNCHRONIZE=true` en local; migraciones en entornos serios |
| `pnpm test:e2e` | Falta `test/jest-e2e.json` |

Health: `GET /api/v1/health`. Login de humo: `POST /api/v1/auth/login` con un admin del seed.

---

## 11. Contactos y referencias

- **Rodrigo Sanz** — Coordinador
- **Diego Páez** — Arquitecto (review prioritario a `main`)
- **Paula Rodríguez** — Frontend / QA

### Docs en este repo

| Doc | Contenido |
| --- | --- |
| [`README.md`](README.md) | Setup rápido |
| [`CONTEXT.md`](CONTEXT.md) | Este archivo |
| [`docs/swagger-guidelines.md`](docs/swagger-guidelines.md) | OpenAPI |
| [`docs/epicas/Contrato de API — Épica 1 ...`](docs/epicas/) | Contrato Épica 1 |
| [`docs/diseño/Contexto — Diagrama de clases.md`](docs/diseño/Contexto%20—%20Diagrama%20de%20clases.md) | UML ↔ implementación |
| [`docs/diseño/Diagrama UML - Diagrama de clases.jpg`](docs/diseño/Diagrama%20UML%20-%20Diagrama%20de%20clases.jpg) | Imagen UML |
| [`.env.example`](.env.example) | Variables |

---

*Documento vivo: actualizarlo cuando cambie el alcance real (nueva épica, CI, Railway, o convenciones).*
