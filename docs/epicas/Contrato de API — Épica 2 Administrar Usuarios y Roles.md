# Contrato de API — Épica 2 Administrar Usuarios y Roles

> Se define lo que el backend debe implementar y lo que el frontend puede esperar recibir. Es un acuerdo entre ambas partes, no una imposición de un lado sobre el otro.
>
> Este contrato **no repite** las convenciones transversales ya definidas en la epica anterior (ERR-01, ERR-02, ERR-03, y la convención de `message` en respuestas exitosas). Antes de implementar cualquier manejo de errores o mensajes de éxito en esta épica, se debe revisar cómo ya están resueltos en el repositorio (servicios, handlers y componentes existentes) y **reutilizarlos tal cual están** — no redefinirlos ni crear una versión paralela. Solo se detallan acá los errores y casos **específicos** de los endpoints de esta épica, que no entran en ese patrón ya resuelto.

---

## Convención transversal: multi-finca

Un usuario puede administrar **más de una finca**. El backend nunca infiere la finca desde el JWT: el alcance viaja siempre en la URL o en la query.

- `GET /api/v1/fincas/mis-fincas` devuelve las fincas del usuario autenticado. Alimenta el **selector de finca activa** del frontend, que fija el alcance del resto del sistema.

```json
{
  "fincas": [
    {
      "id_finca": 12,
      "nombre_finca": "Finca Demo Croply",
      "rol_finca": "ADMIN_FINCA",
      "nombre_rol": "Administrador de Finca",
      "es_admin": true
    }
  ]
}
```

- Los endpoints `/api/v1/fincas/:id_finca/...` siguen scoped a una finca puntual y devuelven `403 FORBIDDEN` si el usuario no la administra.
- Para la vista agregada ("ver todas las fincas juntas") existe `GET /api/v1/fincas/usuarios`, descripto en HU-GU-08/09/10.

Las vinculaciones vencidas (`fecha_fin_rol` pasada) no cuentan en ninguno de los dos casos.

**Naming de identificadores:** todos los `id_*` del contrato van en **minúscula con guion bajo**, tanto en URLs como en bodies (`id_rol`, `id_usuario`, `id_finca`, `id_invitacion_finca`, `id_solicitud_df`). Cualquier aparición previa en CamelCase (`id_Rol`, `id_InvitacionFinca`) era una errata de la documentación; el backend nunca las expuso así.

---

## Errores Transversales que se agregan en esta Épica

**ERR-04 — Recurso en uso, no se puede eliminar**
*Backend debe:* si se intenta dar de baja un recurso que tiene entidades activas dependiendo de él (ej. un rol con usuarios asignados), devolver:

```json
{
  "statusCode": 409,
  "errorCode": "RESOURCE_IN_USE",
  "message": "No puede eliminar un rol que está asignado a usuarios activos. Reasigne a los trabajadores antes de continuar."
}
```

*Frontend debe:* mostrar el mensaje sin ejecutar el borrado. Nota: esto solo aplica al caso de roles de **finca** (HU-GU-03), donde dar de baja con usuarios asignados está prohibido. Para roles de **sistema** (HU-GU-01), el negocio permite la baja igual y desasigna a los usuarios — ahí no aplica ERR-04, se resuelve del lado del éxito (ver HU-GU-01 más abajo).

**ERR-05 — Recurso no encontrado**
*Backend debe:* Devolver este error cada vez que el frontend intente consultar, editar, eliminar o accionar sobre una entidad utilizando un identificador en la URL (ej. `:id_rol`, `:id_usuario`, `:id_finca`, `:id_solicitud_df`) que no existe en la base de datos, fue eliminado previamente, o pertenece a un ámbito al que el usuario no tiene acceso.

```json
{
  "statusCode": 404,
  "errorCode": "RESOURCE_NOT_FOUND",
  "message": "El recurso solicitado no existe o ya fue eliminado."
}
```

**Frontend debe:** Interceptar el error y actuar según el contexto:

- **En carga inicial (GET de un detalle):** Redirigir al usuario a la vista de listado correspondiente y mostrar el mensaje en una notificación (toast).
- **En acciones (PUT/DELETE/POST):** Mostrar el mensaje de error y, de ser necesario, refrescar el listado local para limpiar el registro fantasma que el usuario estaba intentando manipular.

---

## HU-GU-01. ABM de roles de sistema

- **Autenticación:** Requerida (Rol: Administrador Croply)
- **Headers:** `Authorization: Bearer <JWT>`

### Listar roles

`GET /api/v1/roles/sistema`

```json
{
  "roles": [
    {
      "id_rol": 5,
      "nombre_rol": "Administrador de Finca",
      "descripcion": "Rol con acceso completo a la gestión de una finca",
      "permisos": [
        { "id_permiso": 1, "nombre_permiso": "Gestión de finca y parcelas" }
      ],
      "cantidad_usuarios_asignados": 12
    }
  ]
}
```

> `cantidad_usuarios_asignados` es clave: el frontend lo usa para decidir **qué texto de confirmación mostrar** antes de dar de baja un rol (el mensaje es distinto si tiene 0 usuarios vs 1+), sin tener que hacer una consulta aparte.
>
> `permisos` viene con el mismo shape que en el listado de roles de finca, para que el modal de edición pueda precargar los checkboxes sin una consulta adicional. Un rol recién creado, sin permisos guardados todavía, devuelve `permisos: []`.

### Crear rol

`POST /api/v1/roles/sistema`

```json
{ "nombre_rol": "Supervisor", "descripcion": "Supervisión de operaciones" }
```

`201 Created`:

```json
{
  "message": "Rol creado correctamente",
  "id_rol": 9,
  "nombre_rol": "Supervisor",
  "descripcion": "Supervisión de operaciones",
  "cantidad_usuarios_asignados": 0
}
```

### Editar rol

`PUT /api/v1/roles/sistema/:id_rol`

Mismo shape que la creación en el request. `200 OK` con `message: "Rol actualizado correctamente"`.

### Dar de baja rol

`DELETE /api/v1/roles/sistema/:id_rol`

Se ejecuta una baja lógica, seteando ‘fecha_baja_rol’.

`200 OK` — comportamiento distinto según si tenía usuarios asignados o no, pero **la request es la misma**, el backend decide el mensaje:

```json
{
  "message": "Rol dado de baja correctamente. Los usuarios afectados quedaron sin rol asignado.",
  "id_rol": 9
}
```

> Si el rol no tenía usuarios asignados, `message` es simplemente `"Rol dado de baja correctamente"`.

### Errores

`REQUIRED_FIELD` / `DUPLICATE_VALUE` (nombre repetido) → ERR-01/ERR-02 transversales.

---

## HU-GU-02. Asignar rol de sistema a usuario

- **Autenticación:** Requerida (Rol: Administrador Croply)

`PUT /api/v1/usuarios/:id_usuario/rol-sistema`

```json
{ "id_rol": 5 }
```

`200 OK`:

```json
{
  "message": "Rol de sistema asignado correctamente.",
  "id_usuario": 46,
  "id_rol": 5,
  "nombre_rol": "Administrador de Finca"
}
```

### Errores a usar

**ERR-05** (`RESOURCE_NOT_FOUND`).

---

## HU-GU-03. ABM de roles de finca

- **Autenticación:** Requerida (Rol: Administrador de Finca)
- Todos los endpoints son scoped a la finca del administrador autenticado (se resuelve por JWT).

### Listar roles de la finca

`GET /api/v1/fincas/:id_finca/roles`

```json
{
  "roles": [
    {
      "id_rol": 21,
      "nombre_rol": "Encargado",
      "descripcion": "Responsable de turno",
      "permisos": [
        { "id_permiso": 3, "nombre_permiso": "Registro de agroquímicos" }
      ],
      "cantidad_usuarios_asignados": 4
    }
  ]
}
```

### Crear rol de finca

`POST /api/v1/fincas/:id_finca/roles`

```json
{
  "nombre_rol": "Operario",
  "descripcion": "Trabajador de campo",
  "permisos": [3, 7]
}
```

> `nombre_rol`: obligatorio, entre 3 y 30 caracteres alfanuméricos — **el backend debe validar longitud y formato**, no solo presencia (esto es más estricto que un simple ERR-01).

`201 Created` con `message: "Rol creado correctamente"` y el shape del rol creado (igual al de listar).

### Editar / Dar de baja

`PUT /api/v1/fincas/:id_finca/roles/:id_rol` y `DELETE /api/v1/fincas/:id_finca/roles/:id_rol`, mismos shapes, soft delete.

### Errores

- `REQUIRED_FIELD` / `DUPLICATE_VALUE` (nombre repetido en la finca) → ERR-01/ERR-02.
- `400 Bad Request` — sin ningún permiso seleccionado:

```json
    { "statusCode": 400, "errorCode": "NO_PERMISSIONS_SELECTED", "message": "Debe seleccionar al menos un permiso para guardar el rol." }
```

- `409 Conflict` — intento de dar de baja un rol con usuarios asignados → **ERR-04** (`RESOURCE_IN_USE`).

---

## HU-GU-04. Asignar rol a usuario dentro de la finca

- **Autenticación:** Requerida (Rol: Administrador de Finca)

`PUT /api/v1/fincas/:id_finca/usuarios/:id_usuario_finca/rol`

```json
{ "id_rol": 21 }
```

> La key del body es `id_rol` en minúscula, igual que en el resto del contrato.

`200 OK`:

```json
{
  "message": "Rol asignado correctamente.",
  "id_usuario_finca": 302,
  "id_rol": 21,
  "nombre_rol": "Encargado"
}
```

> `id_usuario_finca` es el identificador de la vinculación usuario-finca, no el del usuario. Viene en el listado de HU-GU-08.

### Errores

**ERR-05** (`RESOURCE_NOT_FOUND`).

---

## HU-GU-05. Gestión de asignación de permisos por rol

- **Autenticación:** Requerida (Rol: Administrador Croply o Administrador de Finca, según el rol que se esté editando)

### Catálogo de permisos disponibles

`GET /api/v1/roles/permisos?ambito=sistema` (para Admin Croply) o `GET /api/v1/roles/permisos?ambito=finca` (para Admin de Finca)

```json
{
  "permisos": [
    { "id_permiso": 1, "nombre_permiso": "Gestión de finca y parcelas" },
    { "id_permiso": 2, "nombre_permiso": "Planificación de cultivos" }
  ]
}
```

> Nota: el listado de permisos por ámbito (los 7 módulos para sistema vs los 3 para finca) es **dato maestro del backend**, no algo que el frontend deba hardcodear — por eso este endpoint, aunque la HU no lo menciona explícitamente como pantalla propia, es necesario para que el modal de permisos no tenga los módulos hardcodeados en el frontend.

### Permisos ya asignados a un rol

No hay endpoint dedicado: tanto `GET /api/v1/roles/sistema` como `GET /api/v1/fincas/:id_finca/roles` devuelven el array `permisos` de cada rol. Con eso alcanza para precargar los checkboxes al abrir el modal de edición.

### Guardar permisos de un rol

`PUT /api/v1/roles/sistema/:id_rol/permisos` (sistema) o `PUT /api/v1/fincas/:id_finca/roles/:id_rol/permisos` (finca)

```json
{ "permisos": [1, 2, 5] }
```

`200 OK` con `message: "Rol actualizado correctamente."`

### Errores

`400 Bad Request` — sin ningún permiso seleccionado:

```json
{ "statusCode": 400, "errorCode": "NO_PERMISSIONS_SELECTED", "message": "Un rol debe contener al menos un permiso habilitado." }
```

---

## HU-GU-06. Administrar estado de cuenta de usuario

- **Autenticación:** Requerida (Rol: Administrador Croply o Administrador de Finca, según el usuario objetivo)

`PUT /api/v1/usuarios/:id_usuario/estado`

```json
{ "estado": "Inactivo" }
```

> `estado`: uno de `Activo | Inactivo` para Admin de Finca; `Activo | Inactivo | Pendiente` para Admin Croply. **El backend valida que el rol del solicitante tenga permiso para setear el valor recibido** — si un Admin de Finca intenta mandar `"Pendiente"`, es un `403 Forbidden`, no un simple error de validación de campo.

`200 OK`:

```json
{
  "message": "Estado de cuenta actualizado correctamente.",
  "id_usuario": 46,
  "estado": "Inactivo"
}
```

> Si el usuario pasa de `Activo` a `Inactivo`: el backend debe invalidar cualquier sesión activa de ese usuario (no solo cambiar el estado en la base).
> `message` es distinto en un caso puntual: si el usuario estaba en `Pendiente` (invitación no aceptada) y se lo pasa a `Inactivo`, el mensaje es `"Estado de cuenta actualizado correctamente. La invitación pendiente fue cancelada."` — mismo patrón que vimos en HU-AC-03a/HU-GU-01, el backend decide el texto exacto según el caso, la estructura (`message`) es siempre la misma.

### Errores

`403 Forbidden` — el rol del solicitante no tiene permiso para setear ese valor de estado:

```json
{ "statusCode": 403, "errorCode": "STATE_NOT_ALLOWED", "message": "No tenés permisos para asignar este estado de cuenta." }
```

---

## HU-GU-07. Generar y enviar invitación por email a empleado

- **Autenticación:** Requerida (Rol: Administrador de Finca)

`POST /api/v1/fincas/:id_finca/invitaciones`

```json
{ "email_invitado": "empleado@correo.com", "id_rol": 21 }
```

`201 Created`:

```json
{
  "message": "Invitación enviada correctamente",
  "id_invitacion_finca": 130,
  "email_invitado": "empleado@correo.com",
  "id_rol": 21,
  "estado": "Pendiente",
  "fecha_envio": "2026-07-18T15:00:00Z"
}
```

### Reenviar invitación

`POST /api/v1/invitaciones/:id_invitacion_finca/reenviar`

`200 OK` con `message: "Invitación reenviada correctamente."` — invalida el token anterior y genera uno nuevo.

> El path param es `id_invitacion_finca` en minúscula, igual que el campo que devuelve el alta y que el 409 de más abajo.

### Errores

`409 Conflict` — ya existe una invitación pendiente para ese correo en esta finca. **Este NO es un error bloqueante clásico**: la HU pide que el frontend muestre, dentro del mismo modal, un botón "Reenviar invitación" en vez de un simple mensaje de error. Por eso el shape trae el `id_invitacion_finca` existente, para que el frontend pueda llamar directo al endpoint de reenvío sin tener que buscarlo:

```json
{
  "statusCode": 409,
  "errorCode": "PENDING_INVITATION_EXISTS",
  "message": "Ya existe una invitación pendiente para este correo.",
  "id_invitacion_finca": 130
}
```

`400 Bad Request` — el correo ya pertenece a un usuario activo vinculado a esta finca:

```json
{ "statusCode": 400, "errorCode": "USER_ALREADY_LINKED", "message": "Este usuario ya se encuentra vinculado a tu establecimiento." }
```

---

## HU-GU-08, HU-GU-09, HU-GU-10. Listar, buscar y filtrar usuarios vinculados

Las tres HU comparten el mismo endpoint — búsqueda y filtros son query params, no endpoints separados.

- **Autenticación:** Requerida (Rol: Administrador Croply o Administrador de Finca)

Hay tres endpoints según el ámbito, con los mismos query params y la misma envoltura de paginación:

| Endpoint | Ámbito | Cuándo se usa |
| --- | --- | --- |
| `GET /api/v1/usuarios` | Croply | Pestaña "Lista de administradores" |
| `GET /api/v1/fincas/:id_finca/usuarios` | Una finca | Gestión de usuarios con una finca activa seleccionada |
| `GET /api/v1/fincas/usuarios` | Todas las fincas administradas | Vista multi-finca con columna "Finca" |

**Query params:** `page` (default 1), `pageSize` (default 10), `search` (nombre/apellido/correo, case-insensitive), `id_rol`, `estado`. `GET /api/v1/fincas/usuarios` acepta además `id_finca` para acotar a una finca puntual sin cambiar de endpoint.

> Los filtros van omitidos cuando no aplican: el backend valida `id_rol` como entero y `estado` como enum, así que valores centinela de la UI (`"todos"`, `""`) devuelven `400`.

### Ámbito Croply

```json
{
  "usuarios": [
    {
      "id_usuario": 46,
      "nombre": "Carlos",
      "apellido": "Mendoza",
      "email": "c.mendoza@agroterra.com",
      "telefono": "+549115550123",
      "rol": { "id_rol": 21, "nombre_rol": "Encargado" },
      "estado": "Pendiente"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "totalItems": 124,
    "totalPages": 13
  }
}
```

> **Alcance:** el filtrado es responsabilidad del backend, no del frontend. `GET /api/v1/usuarios` devuelve los usuarios de ámbito Croply — administradores Croply, clientes dados de alta desde "Gestión de Clientes" y administradores de finca — **tengan o no un rol de sistema asignado** (`rol: null` si todavía no se les asignó uno). Los empleados vinculados únicamente a una finca no aparecen acá: se listan por los endpoints de ámbito finca.

### Ámbito finca

Una fila por **vinculación usuario-finca**, no por usuario: en la vista multi-finca un mismo usuario aparece una vez por cada finca en la que trabaja.

```json
{
  "usuarios": [
    {
      "id_usuario": 46,
      "id_usuario_finca": 302,
      "nombre": "Carlos",
      "apellido": "Mendoza",
      "email": "c.mendoza@agroterra.com",
      "telefono": "+549115550123",
      "rol": { "id_rol": 21, "nombre_rol": "Encargado" },
      "finca": { "id_finca": 12, "nombre_finca": "Finca Demo Croply" },
      "estado": "Pendiente"
    }
  ],
  "pagination": { "page": 1, "pageSize": 10, "totalItems": 124, "totalPages": 13 }
}
```

> `id_usuario_finca` identifica la relación puntual entre ese usuario y esa finca, y es lo que consume HU-GU-04 (`PUT /fincas/:id_finca/usuarios/:id_usuario_finca/rol`). `finca` alimenta la columna "Finca" de la vista multi-finca; en el listado scoped a una finca viene igual, siempre con el mismo valor.
>
> En el listado de ámbito Croply ninguno de los dos campos aplica y no se envían.

Para el ámbito Croply, HU-GU-08 pide dos pestañas separadas (Administradores / Solicitudes de clientes) — la pestaña "Solicitudes" **no** usa este endpoint, usa el de HU-GU-13 más abajo.

Sin resultados (lista vacía por falta de datos, no por filtro): `usuarios: []`, `pagination.totalItems: 0` — el frontend distingue "no hay usuarios en el entorno" de "no hay resultados para el filtro" mirando si había `search`/`id_rol`/`estado` en la request que disparó la respuesta vacía, no por un campo del backend.

### Errores

Ninguno específico — es una consulta, no dispara ERR-01/02/03 salvo error inesperado (ERR-03).

---

## HU-GU-11. Gestionar perfil propio

- **Autenticación:** Requerida (cualquier usuario logueado)

`GET /api/v1/usuarios/me`

```json
{
  "id_usuario": 46,
  "nombre": "Carlos",
  "apellido": "Mendoza",
  "email": "c.mendoza@agroterra.com",
  "telefono": "+549115550123"
}
```

`PUT /api/v1/usuarios/me`

```json
{ "nombre": "Carlos", "apellido": "Mendoza", "telefono": "+549115550999" }
```

> `email` no viaja en el request — es no editable, tal cual pide la HU. Si el backend recibe `email` en el body igual, debe ignorarlo, no rechazarlo (para no romper si el frontend algún día lo manda por error de armado del payload).

`200 OK` con `message: "Perfil actualizado correctamente."` y el objeto actualizado.

### Errores

`REQUIRED_FIELD` → ERR-01 (para Nombre/Apellido si se vacían).

---

## HU-GU-12. Registrar log de operaciones críticas

**No expone ningún endpoint consumido por el frontend.** Es responsabilidad exclusiva del backend: cada endpoint de esta épica (y de las anteriores/futuras que involucren altas, cambios de estado, cambios de rol u operaciones destructivas) debe internamente escribir en `LogOperaciones` al ejecutarse con éxito.

> El cambio de estado de solicitudes de digitalización (HU-GU-13) entra en el alcance de esta HU: queda registrado en `LogOperaciones` con actor, recurso, descripción y fecha. Eso cubre también la trazabilidad de "última modificación de estado" que pide el AC de HU-GU-13, sin necesidad de exponerla en ningún endpoint.

> Importante para el backend: si el logging falla, la operación principal **igual debe completarse con éxito** para el usuario — el log es un side-effect, no debe bloquear ni degradar la respuesta del endpoint principal. Esto no cambia nada del contrato de request/response de los endpoints ya definidos arriba, es una nota de implementación.

---

## HU-GU-13. Gestionar solicitudes de digitalización de finca

- **Autenticación:** Requerida (Rol: Administrador Croply)

### Listar solicitudes

`GET /api/v1/solicitudes-digitalizacion?page=1&pageSize=10`

**Query params:** `page` (default 1), `pageSize` (default 10), `search` (nombre completo o correo, case-insensitive), `estado` (`Pendiente | Contactado | Aprobada | Rechazada`).

```json
{
  "solicitudes": [
    {
      "id_solicitud_df": 801,
      "fecha_solicitud": "2026-07-14T19:40:00Z",
      "nombre_completo": "Pedro Picapiedra",
      "correo_electronico": "pedro@cantera.com",
      "telefono_contacto": "+5493512345678",
      "estado": "Pendiente"
    }
  ],
  "pagination": { "page": 1, "pageSize": 10, "totalItems": 42, "totalPages": 5 }
}
```

> Ordenado por `fecha_solicitud` descendente — responsabilidad del backend, no del frontend.

### Ver detalle de una solicitud

`GET /api/v1/solicitudes-digitalizacion/:id_solicitud_df`

```json
{
  "id_solicitud_df": 801,
  "fecha_solicitud": "2026-07-14T19:40:00Z",
  "nombre_completo": "Pedro Picapiedra",
  "correo_electronico": "pedro@cantera.com",
  "telefono_contacto": "+5493512345678",
  "provincia": "Córdoba",
  "departamento": "Capital",
  "localidad": "Córdoba",
  "numero_parcelas": 4,
  "superficie_total_hectareas": 150.5,
  "comentario_adicional": "Finca dedicada al cultivo de maíz primavera-verano.",
  "estado": "Pendiente"
}
```

### Actualizar estado de una solicitud

`PUT /api/v1/solicitudes-digitalizacion/:id_solicitud_df/estado`

```json
{ "estado": "Contactado" }
```

> `estado`: uno de `Pendiente | Contactado | Aprobada | Rechazada`.

`200 OK` con `message: "Estado actualizado correctamente."`

### Sin solicitudes registradas

El frontend distingue "vacío por no haber datos" mirando `pagination.totalItems === 0` sin `search` ni `estado` en la request, mismo criterio que HU-GU-08/09/10.

### Fuera de alcance

El borrado de solicitudes no está contemplado: una solicitud se resuelve cambiando su estado a `Rechazada`, no eliminándola, para no perder la trazabilidad.

### Errores

Ninguno específico más allá de los transversales.