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

**Épica 1 — Gestionar el Acceso**, **Épica 2 — Administrar Usuarios y Roles** y **Épica 4 — Planificar Cultivos** (HU-BC-01 a HU-BC-05) implementadas:

| Módulo | Contenido |
| --- | --- |
| `health` | `GET /health` |
| `auth` | Login, registro admin finca / invitado, reset y cambio de contraseña, primer acceso |
| `usuarios` | Perfil `/me`, listado Croply, asignar rol sistema, cambiar estado |
| `fincas` | Roles de finca, usuarios de finca (scoped y multi-finca), invitaciones, asignación de rol |
| `roles` | ABM roles sistema, catálogo de permisos, `Permiso` / `RolPermiso` |
| `solicitudes-digitalizacion` | Alta pública + listado/detalle/estado (Admin Croply) |
| `log-operaciones` | Auditoría interna (HU-GU-12), sin endpoint FE |
| `cultivos` | Biblioteca de cultivos base y variedades (incluye `imagen_url` opcional); plantillas de plan base (hitos/tareas); búsqueda y filtros |
| `uploads` | `POST /uploads/imagenes` — subida mediada a Cloudinary (JWT) |
| `database/seed` | Admins Croply + fincas demo + biblioteca demo (Tomate, Ajo, plantilla general de Tomate) + roles + catálogo de permisos |

Placeholders (sin lógica de negocio aún): `parcelas`, `reportes`.

**HU-BC-06** (generar/editar plan de acción en parcela) **no está implementada**: depende de Épica 3 (`Parcela`, `PlanAccion`) y Épica 5 (ABM `TipoTarea` / entidad `Tarea`). Ver [`docs/diseño/Contexto — Diagrama de clases.md`](docs/diseño/Contexto%20—%20Diagrama%20de%20clases.md) § HU-BC-06.

Contratos: [`docs/epicas/`](docs/epicas/).

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

Variables clave (ver `.env.example`): `PORT`, `API_PREFIX`, `SWAGGER_ENABLED`, `DB_*`, `JWT_*`, `CORS_ORIGIN`, `FRONTEND_URL`, `THROTTLE_*`, `SEED_ADMIN_PASSWORD`, `CLOUDINARY_*`, `RESEND_API_KEY`, `MAIL_FROM`.

### Credenciales de prueba (seed)

Al arrancar, si la DB responde, se crean (si no existen) los usuarios de desarrollo. Todos con estado `Activo` y la misma contraseña: `CroplyAdmin123!` (o `SEED_ADMIN_PASSWORD`). Seed idempotente (`src/database/seed`).

**Admin Croply:**

| Persona | Email |
| --- | --- |
| Diego Páez | `diego@croply.app` |
| Rodrigo Sanz | `rodrigo@croply.app` |
| Paula Rodríguez | `paula@croply.app` |

**Ámbito finca** — dos fincas demo (`Finca Demo Croply`, `Finca Demo Sur`) para poder probar el selector multi-finca:

| Rol | Email | Alcance |
| --- | --- | --- |
| Administrador de Finca | `admin.finca@croply.app` | Ambas fincas |
| Encargado | `encargado.finca@croply.app` | Finca Demo Croply |
| Operario | `operario.finca@croply.app` | Finca Demo Croply |

**Biblioteca demo (Épica 4):** al arrancar se siembran (si no existen) el cultivo **Tomate** (variedades Perita y Redondo) con plantilla general `Plan de Cultivo de Tomate`, y el cultivo **Ajo** sin plantilla.

### Migraciones

Preferir `DB_SYNCHRONIZE=true` en desarrollo local (valor por defecto del ejemplo). En entornos serios: migraciones TypeORM (`pnpm migration:*`).

### Comandos útiles

```bash
pnpm build
pnpm start:dev
pnpm test
pnpm test:cov
pnpm test:e2e   # requiere carpeta test/ (aún pendiente de armar)
pnpm lint       # análisis estático (no modifica archivos)
pnpm lint:fix   # auto-fix opcional
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
│   ├── mailer/             # MailerService (console en dev, Resend en prod)
│   ├── cloudinary/         # CloudinaryService (subida de imágenes)
│   ├── enums/              # EstadoUsuario, roles, etc.
│   └── swagger/
└── modules/
    ├── health/
    ├── auth/               # JWT, guards, endpoints /auth/*
    ├── usuarios/           # perfil, listados, estado, rol sistema
    ├── fincas/             # roles finca, usuarios, invitaciones
    ├── roles/              # ABM sistema, permisos
    ├── log-operaciones/    # auditoría interna
    ├── solicitudes-digitalizacion/
    ├── uploads/                # POST /uploads/imagenes (Cloudinary)
    ├── cultivos/               # biblioteca + plantillas base (Épica 4)
    ├── parcelas/               # placeholder
    └── reportes/               # placeholder
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
- Columnas DB en snake_case; JSON de API con `id_*` en minúsculas (`id_usuario`, `id_rol`, …) y `camelCase` solo donde el contrato lo pide (`accessToken`).

| Tag Swagger | Módulo |
| --- | --- |
| Health | `modules/health` |
| Auth | `modules/auth` |
| Usuarios | `modules/usuarios` |
| Roles | `modules/roles` |
| Fincas | `modules/fincas` |
| Cultivos | `modules/cultivos` |
| Uploads | `modules/uploads` |
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
| Mail | Resend en `production`; log en consola fuera de producción |
| Imágenes | Cloudinary (SDK) + multer en memoria |
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
7. **Mail según entorno** — `MailerService` + `MailProvider`: `NODE_ENV=production` envía con Resend; el resto loguea asunto y HTML en la consola del backend. Fallos de envío se loguean y **no** rompen el flujo (reset/invitación).
8. **UML ↔ código**: ver [`docs/diseño/Contexto — Diagrama de clases.md`](docs/diseño/Contexto%20—%20Diagrama%20de%20clases.md).
9. **Uploads mediados** — el frontend nunca habla con Cloudinary. `POST /uploads/imagenes` (JWT) recibe `multipart/form-data` (`archivo`), valida tipo/tamaño y sube el buffer. Cultivo base y variedad persisten solo `imagen_url`.
10. **Multi-finca** — un usuario puede administrar varias fincas. El alcance nunca se infiere del JWT: viaja en la URL (`/fincas/:id_finca/...`) o en la query (`/fincas/usuarios?id_finca=`). `GET /fincas/mis-fincas` alimenta el selector de finca activa del frontend.

### Regla de login (Épica 1)

- `Inactivo` → 403 `ACCOUNT_NOT_ACTIVE`
- `Pendiente` sin cambio forzado de clave → 403
- `Pendiente` + `debe_cambiar_contrasena: true` → 200 (habilita HU-AC-06)
- `Activo` → 200

---

## 7. Fuera de alcance (hoy)

Respecto del diagrama completo y épicas futuras:

- CRUD de fincas, parcelas y reportes
- HU-BC-06 (plan de acción real sobre parcela) — espera Épicas 3 y 5
- ABM de `TipoTarea` / entidad `Tarea` (hoy hay un catálogo mock en `cultivos/tipo-tarea.catalog.ts`)
- RBAC middleware por permiso individual (los permisos se administran; la auth HTTP sigue por rol)
- Notificaciones push
- Refresh token como endpoint
- Suite e2e Nest (`test/jest-e2e.json` pendiente)
- CI (GitHub Actions) y deploy Railway en este repo
- Cerrar todos los findings de ESLint (la config está lista; el backlog vive en `docs/calidad/`)


### HU-IoT-01 — ABM de tipos de sensor (Épica 7)

**Alcance implementado:** ABM completo de `TipoSensor` (`src/modules/tipos-sensor/`):
listar, crear, editar y dar de baja (lógica), protegido con rol Administrador Croply.

**Relación con el simulador IoT:** `codigo_tipo_sensor` es el campo puente entre
Croply y el simulador externo, que expone un catálogo cerrado de 5 valores
(`TEMP_HUME_AMBIENTAL`, `HUMEDAD_SUELO`, `RADIACION_SOLAR`, `PRECIPITACION`, `PH`).
El catálogo vive como `enum CodigoTipoSensor` en `tipos-sensor/enums/`, local al
módulo porque hoy ningún otro módulo lo necesita. Si el simulador incorpora un
código nuevo, se amplía agregando un valor a ese enum — no requiere cambios en
la arquitectura general.

**Auditoría:** `TipoSensor` no tiene `id_usuario` ni `fecha_ultima_modificacion`
propios (decisión de diseño, no un olvido). Alta, edición y baja se registran vía
`LogOperacionesService.registrar(...)`, igual que en `roles`/`fincas`. La baja usa
`TipoOperacion.OPERACION_DESTRUCTIVA`; alta y edición usan `TipoOperacion.EXITO`.

**Pendiente conocido — `RESOURCE_IN_USE`:** el contrato exige bloquear la baja de
un `TipoSensor` si tiene sensores físicos activos asociados. La entidad `Sensor`
todavía no existe en el backend (pertenece a una épica/HU posterior, ej. HU-FP-04).
Por eso, hoy, `DELETE /tipos-sensor/:id` **nunca devuelve 409** — la validación
está aislada en `TiposSensorService.contar_sensores_activos_asociados()`, que
retorna `0` de forma intencional y documentada en el propio código. Cuando se
implemente `Sensor`, hay que: (1) reemplazar ese método por un `count()` real,
(2) revisar y habilitar los tests actualmente marcados `it.skip` en
`tipos-sensor.service.spec.ts`, (3) no fue necesario tocar el contrato ni el
resto del flujo de baja.

**Explícitamente fuera de esta HU:** no existe módulo `sensores/` ni entidad
`Sensor`, ni siquiera parcial. No corresponde crearlos como parte de HU-IoT-01.

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

Seams actuales: `AllExceptionsFilter`, `AuthService`, `RolesService`, `UsuariosService`, `SolicitudesDigitalizacionService`, `SeedService`, `CultivosBaseService`, `PlantillasBaseService`, `MailerService`, `UploadsService`.

Antes de pasar a revisión:

- [ ] Tests en verde
- [ ] `pnpm lint` ejecutado (no se espera cero findings todavía; ver `docs/calidad/`)
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
| Mail no llega en local | Esperado: fuera de `production` se loguea en consola (`[DEV MAIL]`) |
| Mail no llega en production | `RESEND_API_KEY`, `MAIL_FROM`, `FRONTEND_URL`; revisar logs de `MailerService` |
| Subida de imagen 500 | `CLOUDINARY_CLOUD_NAME` / `API_KEY` / `API_SECRET`; tipo JPEG/PNG/WebP y ≤ 5 MB |

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
| [`docs/calidad/informe-analisis-estatico.md`](docs/calidad/informe-analisis-estatico.md) | ESLint: herramienta, Antes/Después |

---

*Documento vivo: actualizarlo cuando cambie el alcance real (nueva épica, CI, Railway, o convenciones).*
