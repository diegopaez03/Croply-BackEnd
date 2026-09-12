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

**Épica 1 — Gestionar el Acceso**, **Épica 2 — Administrar Usuarios y Roles**, **Épica 4 — Planificar Cultivos** (HU-BC-01 a HU-BC-05) y **Épica 3 — Etapa 1** (HU-FP-01, 02, 03, 04, 06, 07) implementadas. **Épica 7 — HU-IoT-01** (ABM de tipos de sensor) también implementada, con un pendiente puntual (ver sección 8, "Épicas en curso").

| Módulo | Contenido |
| --- | --- |
| `health` | `GET /health` |
| `auth` | Login, registro admin finca / invitado, reset y cambio de contraseña, primer acceso |
| `usuarios` | Perfil `/me`, listado Croply, asignar rol sistema, cambiar estado |
| `fincas` | ABM de Finca, propietario, roles de finca, usuarios de finca (scoped y multi-finca), invitaciones, asignación de rol |
| `roles` | ABM roles sistema, catálogo de permisos, `Permiso` / `RolPermiso` |
| `solicitudes-digitalizacion` | Alta pública + listado/detalle/estado (Admin Croply) |
| `log-operaciones` | Auditoría interna (HU-GU-12), sin endpoint FE |
| `cultivos` | Biblioteca de cultivos base y variedades; plantillas de plan base (hitos/tareas); búsqueda y filtros |
| `tipos-sensor` | ABM de `TipoSensor` (Épica 7, HU-IoT-01) |
| `parcelas` | ABM de `Parcela`, `ControladorSensor`, `Sensor`, `CodigoQR` (Épica 3) |
| `planes-accion` | `PlanAccion`, `Hito`, `Tarea` materializados desde plantillas (Épica 3/4) |
| `database/seed` | Admins Croply + fincas demo + biblioteca demo (Tomate, Ajo, plantilla general de Tomate) + roles + catálogo de permisos |

Placeholder (sin lógica de negocio aún): `reportes`.

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

Variables clave (ver `.env.example`): `PORT`, `API_PREFIX`, `SWAGGER_ENABLED`, `DB_*`, `JWT_*`, `CORS_ORIGIN`, `THROTTLE_*`, `SEED_ADMIN_PASSWORD`.

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
│   ├── mailer/             # MailerStubService (log de links)
│   ├── enums/              # EstadoUsuario, roles, etc.
│   └── swagger/
└── modules/
    ├── health/
    ├── auth/               # JWT, guards, endpoints /auth/*
    ├── usuarios/           # perfil, listados, estado, rol sistema
    ├── fincas/             # ABM finca, propietario, roles finca, usuarios, invitaciones
    ├── roles/              # ABM sistema, permisos
    ├── log-operaciones/    # auditoría interna
    ├── solicitudes-digitalizacion/
    ├── cultivos/           # biblioteca + plantillas base (Épica 4)
    ├── tipos-sensor/       # ABM de TipoSensor (Épica 7, HU-IoT-01)
    ├── parcelas/           # Parcela, ControladorSensor, Sensor, CodigoQR (Épica 3)
    ├── planes-accion/      # PlanAccion, Hito, Tarea (Épica 3/4)
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
- DTOs: `CrearXDto`, `ActualizarXDto`, `XResponseDto`, `XQueryDto` 
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
| TiposSensor | `modules/tipos-sensor` |
| Parcelas | `modules/parcelas` |
| PlanesAccion | `modules/planes-accion` |
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
9. **Multi-finca** — un usuario puede administrar varias fincas. El alcance nunca se infiere del JWT: viaja en la URL (`/fincas/:id_finca/...`) o en la query (`/fincas/usuarios?id_finca=`). `GET /fincas/mis-fincas` alimenta el selector de finca activa del frontend.

### Regla de login (Épica 1)

- `Inactivo` → 403 `ACCOUNT_NOT_ACTIVE`
- `Pendiente` sin cambio forzado de clave → 403
- `Pendiente` + `debe_cambiar_contrasena: true` → 200 (habilita HU-AC-06)
- `Activo` → 200

---

## 7. Fuera de alcance (hoy)

Respecto del diagrama completo y épicas futuras:

- CRUD de reportes
- HU-BC-06 (plan de acción real sobre parcela) — espera Épicas 3 y 5
- ABM de `TipoTarea` / entidad `Tarea` (hoy hay un catálogo mock en `cultivos/tipo-tarea.catalog.ts`)
- RBAC middleware por permiso individual (los permisos se administran; la auth HTTP sigue por rol)
- Notificaciones
- SMTP real
- Refresh token como endpoint
- Suite e2e Nest (`test/jest-e2e.json` pendiente)
- CI (GitHub Actions) y deploy Railway en este repo
- Cerrar todos los findings de ESLint (la config está lista; el backlog vive en `docs/calidad/`)


## 8. Épicas en curso — notas de implementación

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

### EP-03 — Etapa 1 (Fincas, Parcelas, Infraestructura IoT y Planes de Acción)

**Alcance implementado:** ABM completo de Finca (propietario único vía UsuarioFinca, sin edición de ubicación tras creación), Parcela + ControladorSensor + Sensor (sin integración real con el simulador), PlanAccion/Hito/Tarea materializados desde plantillas de Épica 4 (sin ABM propio de Tarea), historial de cultivos por parcela, y código QR de parcela.

**Ubicación de Finca no editable:** longitud/latitud/departamento/provincia se cargan solo al crear la finca. PUT /fincas/:id_finca no los incluye — está definido así en el contrato de Épica 3, no es una omisión.

**EstadoPlanAccion — estados terminales, sin reactivación:** Activo es el único estado no terminal. Finalizado, FinalizadoPorContingencia e Inactivado son terminales: un PlanAccion que llega a cualquiera de esos tres nunca vuelve a Activo. Si se necesita un plan nuevo para la misma parcela, se crea un PlanAccion nuevo desde cero. No existe un campo motivo_finalizacion separado — la causa de finalización se representa únicamente con el valor del estado.

**Integración con simulador IoT postergada a Épica 7:** en esta etapa, Sensor se crea con estado_senal: Sin_senal, ultimo_valor: null, fecha_ultima_lectura: null, e ip_sensor persistido pero sin uso funcional. No hay ninguna llamada HTTP al simulador, ni reintentos, ni notificaciones. La sincronización real, y la integración con la API de clima, se implementan al retomar Épica 7.

**RESOURCE_IN_USE de TipoSensor (Épica 7) — ahora desbloqueable:** con Sensor ya implementado en esta etapa, TiposSensorService.contar_sensores_activos_asociados() puede reemplazarse por un count() real cuando se retome Épica 7. Habilitar también el test actualmente it.skip en tipos-sensor.service.spec.ts en ese momento.

**Catálogo temporal de TipoTarea:** Tarea/TareaPlantilla usan id_tipo_tarea como número plano (sin FK), resuelto contra src/modules/cultivos/tipo-tarea.catalog.ts. Es intencional y temporal — Épica 5 reemplaza este catálogo por una entidad TipoTarea real. No implementar ABM real de TipoTarea/Tarea como parte de EP-03/EP-04.

**Naming de ControladorSensor:** el nombre contractual definitivo del identificador es `id_controlador_sensor` (singular). Debe utilizarse de forma consistente en entidad, DTOs, requests y responses. No utilizar `id_controlador_sensores`.

**Código QR en Etapa 1:** HU-FP-07 no depende de `GET /api/v1/parcelas/:id_parcela` de HU-FP-05, ya que HU-FP-05 queda fuera de la Etapa 1. El frontend determina si debe mostrar "Generar QR" o "Ver QR" utilizando `GET /api/v1/parcelas/:id_parcela/codigo-qr`: HTTP 200 indica que el QR existe; HTTP 404 con `RESOURCE_NOT_FOUND` indica que todavía no existe.

**Integración con simulador y clima:** queda explícitamente postergada para Épica 7. Esta Etapa 1 solamente implementa las entidades y relaciones necesarias para Finca, Parcela, ControladorSensor y Sensor, sin realizar llamadas reales a APIs externas.

**Pendientes para Épica 7 (en este orden):**

1. **`RESOURCE_IN_USE` real de `TipoSensor`** — primera tarea, sin excepción,
   antes de cualquier otra cosa de esta épica.
2. Integración real con el simulador IoT (HU-IoT-02).
3. Integración con la API de clima (HU-IoT-03).
4. HU IoT correspondiente / completar funcionalidades dependientes de IoT.

**Pendientes para Épica 5:**

* TipoTarea real (entidad + ABM).
* Tarea real con ABM propio.
* Reemplazo del catálogo mock `tipo-tarea.catalog.ts`.
* Migración de `id_tipo_tarea` desde número plano a FK real cuando corresponda.

### HU-IoT-02 — Visualizar datos de sensores en tiempo real (Épica 7)

**Orden de trabajo obligatorio al retomar Épica 7:** primero completar
`RESOURCE_IN_USE` de HU-IoT-01, recién después HU-IoT-02. No invertir el orden.

**Endpoint nuevo:** `GET /api/v1/parcelas/:id_parcela/monitoreo-sensores`
(contrato de Épica 7). Es independiente de `GET /fincas/:id_finca` (Épica 3) —
no la reemplaza, aunque ambas expongan campos de la misma entidad `Sensor`.

**`LecturaSensor` (entidad nueva):** histórico propio de Croply, independiente
del historial del simulador. Se inserta ANTES de sobrescribir
`Sensor.ultimo_valor`, para no perder el valor anterior. Relación
`Sensor 1 → 0..* LecturaSensor`.

**Cálculo de `estado_senal`:** 100% lógica de Croply. El simulador no envía
ningún campo de estado en su respuesta de lectura — Croply lo calcula según
si la última sincronización fue exitosa y reciente (ver criterio de ventana
de tolerancia en el documento de contexto de backend de Épica 7).

**Fuente de lectura:** `GET /parcelas/{id}/estado` del simulador. Nunca
`GET /parcelas/{id}/lecturas`.

**Intervalo de sincronización:** configurable por variable de entorno del
lado de Croply, default `25` (alineado con el simulador). Nunca hardcodear
un valor fijo en código.

**Múltiples controladores por parcela:** ya soportado en ambos sistemas desde
la corrección aplicada al simulador (`Croply_Simulador`, commit `4fc08cd` en
adelante). Sin trabajo pendiente relacionado.

**Mapeo de `EstadoTransmision` hacia el simulador:** los valores de Croply
(`Transmitiendo`/`Sin_senal`) no coinciden textualmente con los del simulador
(`TRANSMITIENDO`/`SIN_SEÑAL`). Mapeo necesario solo al sincronizar estructura
hacia el simulador, nunca al leer.

**Origen de `latitud`/`longitud` para el simulador:** `Parcela` no tiene
columnas propias — se usa `parcela.finca.latitud`/`longitud` (convertidas a
`float`). Decisión de negocio: se asume ubicación climática compartida dentro
de una misma finca.

**Pendiente de decisión de negocio (no bloquea esta HU):**
`ControladorSensor.estado_controlador` sigue naciendo en `Transmitiendo` por
defecto (definido en Épica 3, HU-FP-03). Evaluar en el futuro si debería
nacer en `Sin_señal` hasta la primera sincronización real, igual que `Sensor`.

**El frontend nunca se comunica directamente con el simulador IoT.**

**Reintentos en sincronización estructural:** hasta 3 intentos para
`POST`/`PUT`/`DELETE`/`PATCH` hacia el simulador. Si Croply falla al persistir,
no se sincroniza nada.

### HU-IoT-03 — Pronóstico meteorológico por finca (Épica 7)


**Endpoint nuevo:** `GET /api/v1/fincas/:id_finca/clima` (contrato de Épica 7).
Guard: `AdminFincaGuard` original — esta ruta tiene `:id_finca` directo, no
`:id_parcela`, así que **no** usa la variante "por parcela" creada para
HU-IoT-02/FP-04/06/07.

**Sin entidad ni persistencia:** cada request dispara una llamada real a
Open-Meteo, sin caché ni tabla propia. Es la HU más simple de Épica 7 en
términos de modelo de datos — no agrega nada a TypeORM.

**Cliente HTTP nuevo:** requiere `@nestjs/axios`, que todavía no está
instalado en el proyecto (mismo tipo de dependencia nueva que la integración
con el simulador de HU-IoT-02).

**Mapeo `weather_code` → `condicion`:** tabla estática en el módulo backend
basada en los WMO Weather codes que usa Open-Meteo — no vive en base de datos,
no se expone el código crudo al frontend. Detalle completo de la tabla en el
contrato de Épica 7.

**Overrides por temperatura, aplicados después del mapeo base:**
- `Helada`: temperatura relevante `<= 0°C`.
- `Temperatura elevada`: temperatura relevante `>= 35°C` (umbral confirmado).

**Qué temperatura es "la relevante" en cada caso:** `clima_actual` usa la
temperatura actual devuelta por Open-Meteo; cada entrada de `pronostico`
evalúa `Helada` contra la `temperatura_min` de ese día y `Temperatura elevada`
contra la `temperatura_max` de ese día — nunca la misma temperatura para
ambos chequeos.

**Origen de `latitud`/`longitud`:** de `Finca` directamente (a diferencia de
HU-IoT-02, acá no hace falta heredar de ningún lado — la finca ya tiene sus
propias coordenadas). Mismo parseo `string` → `float` que en HU-IoT-02.

**Sin dependencia técnica de HU-FP-05:** aunque la card de clima también se
muestra en el detalle de parcela según la HU funcional (además de en "Mi
finca"), el endpoint solo necesita `id_finca` — no tiene relación con
`Parcela`. Puede implementarse sin esperar a esa HU, igual que ya pasó con
HU-IoT-02 y con el QR de HU-FP-07.

**Polling y caché son responsabilidad exclusiva del frontend:** 30 minutos de
`refetchInterval`, sin ningún mecanismo de caché ni reintento del lado
backend. Si Open-Meteo no responde, el backend devuelve `503
WEATHER_SERVICE_UNAVAILABLE` una sola vez, sin reintentar — es el frontend
quien decide cuándo volver a intentar (en el próximo ciclo de polling).


### HU-FP-05 y HU-FP-08 — Detalle de parcela y vista general de finca (Épica 3)

**HU-FP-05 — implementada.** `GET /parcelas/:id_parcela`, sin infraestructura
nueva, combina datos de HU-FP-03/FP-04/HU-IoT-02.

**Regla especial en `GET /parcelas/:id_parcela` — única excepción del proyecto:**
`RESOURCE_NOT_FOUND` se dispara solo si el `id_parcela` no existe. Una parcela
dada de baja devuelve `200` con sus datos completos — intencional, no corregir.

**HU-FP-08 — en desarrollo.** Tres endpoints nuevos, ninguno reutiliza
`GET /fincas/:id_finca` (HU-FP-01, exclusivo de Administrador Croply, expone
datos de gestión interna — propietario, IPs de infraestructura — que no le
corresponden a un Administrador de Finca):

- `GET /mi-finca/fincas` — independiente de `GET /fincas/mis-fincas` (Épica 2).
  Esta consulta el estado real de la finca al momento de la llamada; la de
  Épica 2 filtra por vigencia de rol. No reemplaza ni deprecia a la anterior.
- `GET /fincas/:id_finca/resumen` — vista liviana (nombre + parcelas resumidas),
  guard `AdminFincaGuard`. `403 FINCA_NOT_AVAILABLE` si la finca está inactiva.
- `GET /parcelas/:id_parcela/resumen` — card liviana para "Mi finca", distinta
  del detalle completo de HU-FP-05 (no compartir lógica ni DTO entre ambos).

**Botón "Solicitar digitalización de finca":** sin endpoint nuevo, reutiliza
`POST /api/v1/solicitudes-digitalizacion` de Épica 1 tal cual.

**`recomendacion_ia_resumen`:** sigue en `null`, depende de HU-NA-03 (sin
contrato todavía).

---

## 9. Flujo de trabajo

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

## 10. Testing y calidad

Estándar: **TDD** (red → green) en seams acordados. Skill: [`.agent/skills/Test-Driven Development/`](.agent/skills/Test-Driven%20Development/).

Seams actuales: `AllExceptionsFilter`, `AuthService`, `RolesService`, `UsuariosService`, `SolicitudesDigitalizacionService`, `SeedService`, `CultivosBaseService`, `PlantillasBaseService`.

Antes de pasar a revisión:

- [ ] Tests en verde
- [ ] `pnpm lint` ejecutado (no se espera cero findings todavía; ver `docs/calidad/`)
- [ ] Checklist Swagger
- [ ] Probar en Swagger si aplica
- [ ] Commit Conventional Commits

---

## 11. Troubleshooting

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

## 12. Contactos y referencias

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
