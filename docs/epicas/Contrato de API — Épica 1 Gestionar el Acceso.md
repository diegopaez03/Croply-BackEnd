# Contrato de API — Épica 1: Gestionar el Acceso a la Plataforma

> Este documento define lo que el **backend debe implementar y devolver**, y lo que el **frontend puede esperar recibir**. No es una definición unilateral del frontend — cada endpoint, código de error y shape de respuesta listado acá es responsabilidad del backend implementarlo tal cual está escrito. El frontend se programa contra esta definición (vía mocks mientras el backend no esté listo), pero la definición en sí es un acuerdo entre ambas partes, no una imposición de un lado sobre el otro.
>
>
> Revisión hecha contra el Diagrama de Clases y el detalle completo de Criterios de Aceptación de cada HU.
>

---

## Errores transversales (aplican a toda la Épica 1, y en general a todo el sistema)

Estos tres casos son genéricos y no se repiten endpoint por endpoint en este documento. **Son responsabilidad del backend implementarlos con este shape exacto** en cualquier endpoint donde aplique — el frontend simplemente los consume de forma centralizada, no los "inventa" ni los completa por su cuenta.

**ERR-01 — Campo obligatorio vacío**

*Backend debe:* validar cada campo obligatorio del payload y, si falta, devolver:

```json
{
  "statusCode": 400,
  "errorCode": "REQUIRED_FIELD",
  "field": "email",
  "message": "Campo requerido"
}
```

*Frontend debe:* mostrar ese mensaje debajo del campo indicado en `field`, en rojo. Además valida en el cliente antes de enviar (por UX, no reemplaza la validación del backend — el backend valida igual por seguridad, no confía en que el frontend ya filtró).

**ERR-02 — Valor duplicado**

*Backend debe:* validar unicidad (ej. email ya registrado) y devolver:

```json
{
  "statusCode": 409,
  "errorCode": "DUPLICATE_VALUE",
  "field": "email",
  "message": "El valor ingresado ya existe"
}
```

*Frontend debe:* mismo tratamiento visual que ERR-01, en el campo indicado por `field`.

**ERR-03 — Error inesperado del servidor**

*Backend debe:* capturar cualquier excepción no controlada (de cualquier endpoint, no solo de esta épica) y devolver este shape en vez de dejar pasar un stack trace o un error interno sin formato:

```json
{
  "statusCode": 500,
  "errorCode": "UNEXPECTED_ERROR",
  "message": "Ha ocurrido un error, intente nuevamente"
}
```

Esto normalmente se resuelve con un **exception filter global** en NestJS (`@Catch()` a nivel aplicación), para no tener que acordarse de implementarlo endpoint por endpoint. Es responsabilidad del backend configurarlo así — si no lo hace, el frontend va a recibir errores con formato inconsistente y no va a poder mostrarlos correctamente.

*Frontend debe:* mostrar un toast genérico con ese mensaje para cualquier error que no matchee ERR-01/ERR-02 ni un error específico documentado más abajo.

> Nota de implementación frontend: como `field` viaja en la respuesta de ERR-01/ERR-02, el frontend puede resolver esto con **una sola función genérica** (ej. `handleFormError(error, setFieldError)`), reutilizada en todos los formularios — no un handler distinto por pantalla. Pero esto solo funciona si el backend efectivamente devuelve el shape acordado arriba.
>

Los endpoints de abajo solo detallan errores **específicos de esa HU** que no entran en este patrón genérico (ej. mensajes de cuenta inactiva, token expirado) — esos si son particulares y el backend los implementa puntualmente en el endpoint correspondiente.

## Convención transversal — Respuestas exitosas con mensaje al usuario

> Esta convención no es exclusiva de la Épica 1: aplica a **todo endpoint del sistema**,
en cualquier épica, que dispare una acción visible para el usuario (crear, actualizar,
confirmar, dar de baja, etc.). Los contratos de las épicas siguientes no necesitan
redefinirla — solo deben cumplirla al definir cada endpoint nuevo.
>

**Backend debe:** en toda respuesta `200 OK` o `201 Created` de un endpoint que dispare
una acción visible para el usuario, incluir siempre un campo `message` de nivel superior
con el texto específico que pide la HU correspondiente, además de los campos propios
del recurso que ya devolvía el endpoint:

```jsx
{  
 "message": "<texto de éxito específico de esa HU>",   
  "...": "resto de los campos propios del recurso" 
}
```

El texto de `message` no es fijo ni compartido entre endpoints — cada uno usa el mensaje
que su HU define. Lo único transversal es que siempre viaja en un campo llamado `message`,
en la misma posición (nivel superior del JSON).

**Frontend debe:** mostrar ese `message` (toast o inline, según lo indique la HU), sin
hardcodear el string en el componente. Esto permite una función genérica reutilizable
(ej. `showSuccessToast(response.message)`), igual que `handleFormError` para los errores
transversales.

---

## HU-AC-01. Iniciar sesión en la plataforma

- **Método HTTP y Ruta:** `POST /api/v1/auth/login`
- **Autenticación:** Pública

### Request

```json
{
  "email": "usuario@finca.com",
  "contrasena": "Password123!"
}
```

### Respuesta Exitosa (`200 OK`)

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsIn...",
  "expiresIn": 3600,
  "debe_cambiar_contrasena": false,
  "usuario": {
  "id_Usuario": 45,
  "email": "[usuario@finca.com](mailto:usuario@finca.com)",
  "nombre": "Juan",
  "apellido": "Pérez",
  "estado": "Activo",
  "fecha_alta": "2026-03-15T10:00:00Z",
  "rol_sistema": null,
  "fincas": [
  { "id_Finca": 12, "nombre_finca": "La Esperanza", "rol_finca": "ADMIN_FINCA" }
  ] 
 }
}
```

> `debe_cambiar_contrasena: true` es lo que dispara el flujo forzado de HU-AC-06 apenas loguea. El frontend debe bloquear cualquier navegación mientras este flag esté en `true` (ver HU-AC-06 más abajo).
`rol_sistema` es `null` si el usuario no tiene rol global (ej. es solo Administrador de Finca), o un código tipo `"ADMIN_CROPLY"` si lo tiene. `fincas` es un array. El mismo payload va incluido en el JWT.
>

### Errores — deben diferenciarse, no usar un solo mensaje genérico

**`401 Unauthorized`** — credenciales incorrectas (HU no permite indicar cuál campo está mal):

```json
{
  "statusCode": 401,
  "errorCode": "INVALID_CREDENTIALS",
  "message": "Correo electrónico o contraseña incorrectos"
}
```

**`403 Forbidden`** — cuenta con credenciales correctas pero no apta para operar:

```json
{
  "statusCode": 403,
  "errorCode": "ACCOUNT_NOT_ACTIVE",
  "message": "Tu cuenta no se encuentra activa. Contactá al administrador."
}
```

Aplica cuando:

- `estado` es `Inactivo`, o
- `estado` es `Pendiente` **y** `debe_cambiar_contrasena` es `false`.

**Excepción (flujo HU-AC-06):** si `estado` es `Pendiente` **y** `debe_cambiar_contrasena` es `true` (contraseña temporal), el login **debe** responder `200` con JWT para que el frontend pueda llamar a `PUT /auth/contrasena-primer-acceso`. Sin esta excepción el primer acceso sería imposible.

El frontend distingue el mensaje a mostrar por `errorCode`, no por el texto del `message` (más robusto si el texto cambia de idioma o redacción a futuro).

---

## HU-AC-02. Registrar Administrador de Finca desde panel Croply

- **Método HTTP y Ruta:** `POST /api/v1/auth/registrar-admin-finca`
- **Autenticación:** Requerida (Rol: Administrador Croply)
- **Headers:** `Authorization: Bearer <JWT>`

### Request

Según el formulario descripto en la HU (Nombre, Apellido, Correo, Teléfono opcional, Contraseña temporal, Rol opcional, Estado con default "Pendiente"):

```json
{
  "email": "nuevoadmin@finca.com",
  "nombre": "Carlos",
  "apellido": "Gómez",
  "telefono": "+5493511234567",
  "contrasena_temporal": "TempClave123!",
  "id_Rol": null,
  "estado": "Pendiente"
}
```

> `estado`: obligatorio, uno de `Activo | Inactivo | Pendiente`, default visual `Pendiente` (el usuario puede cambiarlo en el form).
>

### Respuesta Exitosa (`201 Created`)

```json
{
 "message": "Usuario registrado correctamente",
  "id_Usuario": 46,
  "email": "nuevoadmin@finca.com",
  "nombre": "Carlos",
  "apellido": "Gómez",
  "telefono": "+5493511234567",
  "estado": "Pendiente",
  "id_Rol": null,
  "fecha_alta": "2026-07-14T15:30:00Z",
  "fecha_baja": null
}
```

### Errores

`VALIDATION_ERROR` (campo vacío) y `EMAIL_ALREADY_EXISTS` (email duplicado) → ver sección **Errores transversales** (ERR-01 y ERR-02) al inicio del documento. No hay errores particulares de esta HU fuera de esos dos.

---

## HU-AC-03. Registrar usuario invitado mediante enlace de invitación

Esta HU necesita **dos** endpoints, no uno: validar el token antes de mostrar el formulario, y procesar el registro al enviarlo.

### 3a. Validar token de invitación (nuevo)

- **Método HTTP y Ruta:** `GET /api/v1/auth/validar-invitacion/:token`
- **Autenticación:** Pública

Se llama al cargar la pantalla, antes de mostrar el formulario, para precargar el email y detectar si el enlace ya fue usado o expiró.

**`200 OK`** — token válido:

```json
{
  "valido": true,
  "email_invitado": "luis_invitado@finca.com",
  "id_InvitacionFinca": 102
}
```

**`410 Gone`** — token ya usado:

```json
{
  "statusCode": 410,
  "errorCode": "INVITATION_ALREADY_USED",
  "message": "Este enlace de invitación ya fue utilizado. Contactá al administrador."
}
```

**`410 Gone`** — token expirado (mismo status, distinto código/mensaje según la HU):

```json
{
  "statusCode": 410,
  "errorCode": "INVITATION_EXPIRED",
  "message": "Este enlace de invitación no es válido o ha expirado. Contactá al administrador."
}
```

### 3b. Completar registro

- **Método HTTP y Ruta:** `POST /api/v1/auth/registrar-invitado`
- **Autenticación:** Pública (token validado en el paso anterior)

### Request

```json
{
  "id_InvitacionFinca": 102,
  "nombre": "Luis",
  "apellido": "Martínez",
  "contrasena": "InvitadoClave2026!"
}
```

### Respuesta Exitosa (`201 Created`)

```json
{
  "message": "Registro completado con éxito.",
  "usuario": {
    "id_Usuario": 47,
    "email": "luis_invitado@finca.com",
    "nombre": "Luis",
    "apellido": "Martínez",
    "estado": "Activo",
    "fecha_alta": "2026-07-14T16:00:00Z"
  }
}
```

---

## HU-AC-04. Recuperar contraseña olvidada

### 4a. Solicitar el enlace de recuperación

- **Método HTTP y Ruta:** `POST /api/v1/auth/olvide-mi-contrasena`
- **Autenticación:** Pública

### Request

```json
{
  "email": "usuario@finca.com"
}
```

### Respuesta (`200 OK`) — siempre el mismo mensaje, exista o no la cuenta (por seguridad, tal cual pide la HU)

```json
{
  "message": "Si el correo ingresado está registrado, recibirás un enlace para restablecer tu contraseña."
}
```

### 4b. Restablecer la contraseña con el token del mail

- **Método HTTP y Ruta:** `POST /api/v1/auth/resetear-contrasena`
- **Autenticación:** Pública (usa el `token_hash` del mail)

### Request

```json
{
  "token_hash": "a1b2c3d4e5f6g7h8i9j0",
  "nueva_contrasena": "NuevaClave456!",
  "confirmar_contrasena": "NuevaClave456!"
}
```

### Respuesta Exitosa (`200 OK`)

```json
{
  "success": true,
  "message": "Tu contraseña fue restablecida correctamente. Podés iniciar sesión."
}
```

### Errores

**`400 Bad Request`** — contraseñas no coinciden:

```json
{
  "statusCode": 400,
  "errorCode": "PASSWORD_MISMATCH",
  "message": "Las contraseñas no coinciden"
}
```

**`410 Gone`** — token usado o expirado:

```json
{
  "statusCode": 410,
  "errorCode": "TOKEN_EXPIRED",
  "message": "Este enlace de recuperación no es válido o ha expirado. Solicitá uno nuevo."
}
```

---

## HU-AC-05. Modificar contraseña desde el perfil

- **Método HTTP y Ruta:** `PUT /api/v1/auth/cambio-contrasena`
- **Autenticación:** Requerida
- **Headers:** `Authorization: Bearer <JWT>`

### Request

```json
{
  "contrasena_actual": "ViejaClave123!",
  "nueva_contrasena": "NuevaClave456!",
  "confirmar_contrasena": "NuevaClave456!"
}
```

### Respuesta Exitosa (`200 OK`)

```json
{
  "success": true,
  "message": "Tu contraseña fue actualizada correctamente."
}
```

### Errores

**`400 Bad Request`** — contraseña actual incorrecta (error específico de esta HU, no entra en el patrón transversal porque no es "campo vacío" ni "duplicado"):

```json
{
  "statusCode": 400,
  "errorCode": "CURRENT_PASSWORD_INCORRECT",
  "message": "La contraseña actual es incorrecta"
}
```

**`400 Bad Request`** — nueva contraseña no coincide con confirmación:

```json
{
  "statusCode": 400,
  "errorCode": "PASSWORD_MISMATCH",
  "message": "Las contraseñas no coinciden"
}
```

---

## HU-AC-06. Cambiar contraseña en primer acceso

**Reescrito completo** — el contrato original modelaba esto como flujo por token de mail, pero la HU dice que ocurre inmediatamente después de un login exitoso con contraseña temporal. Es un endpoint **autenticado** (usa el JWT que ya devolvió el login con `debe_cambiar_contrasena: true`), no uno público con token.

- **Método HTTP y Ruta:** `PUT /api/v1/auth/contrasena-primer-acceso`
- **Autenticación:** Requerida (JWT obtenido en el login, aunque `debe_cambiar_contrasena` sea `true`)
- **Headers:** `Authorization: Bearer <JWT>`

### Request

```json
{
  "nueva_contrasena": "MiPrimerClaveSegura1!",
  "confirmar_contrasena": "MiPrimerClaveSegura1!"
}
```

### Respuesta Exitosa (`200 OK`)

Cambia el estado del usuario de `Pendiente` a `Activo` y marca `debe_cambiar_contrasena` en `false` para logins futuros.

```json
{
  "success": true,
  "message": "Contraseña configurada con éxito. Su cuenta ya se encuentra activa."
}
```

> Nota de implementación frontend: mientras `debe_cambiar_contrasena` sea `true`, el router debe bloquear cualquier ruta que no sea esta pantalla (así lo pide explícitamente la HU: "Espero que el sistema bloquee la navegación... hasta que el cambio sea completado").
>

---

## HU-AC-07. Solicitar digitalización de finca

- **Método HTTP y Ruta:** `POST /api/v1/solicitudes-digitalizacion`
- **Autenticación:** Pública (landing) — también accesible autenticado desde "Mi Finca", sin diferencias en el payload salvo lo indicado abajo

### Request

```json
{
  "nombre_completo": "Pedro Picapiedra",
  "correo_electronico": "pedro@cantera.com",
  "telefono_contacto": "+5493512345678",
  "provincia": "Córdoba",
  "departamento": "Capital",
  "localidad": "Córdoba",
  "numero_parcelas": 4,
  "superficie_total_hectareas": 150.5,
  "comentario_adicional": "Finca dedicada al cultivo de maíz primavera-verano."
}
```

> Todos los campos del formulario son **obligatorios, excepto el campo “comentario_adicional” que es opcional.**
>

### Respuesta Exitosa (`201 Created`)

```json
{
 "message": "¡Solicitud enviada con éxito! Nuestro equipo se pondrá en contacto a la brevedad.",
  "id_Solicitud": 801,
  "nombre_completo": "Pedro Picapiedra",
  "correo_electronico": "pedro@cantera.com",
  "estado": "Pendiente",
  "fecha_solicitud": "2026-07-14T19:40:00Z"
}
```

---

## Convención de naming

Se mantiene la mezcla `camelCase` / `snake_case` **tal cual figura en el contrato y en el DC/UML del proyecto** (ej. `id_Usuario`, `fecha_alta`, `accessToken`). No se homogeniza a un único estilo — el frontend debe tipar los DTOs respetando esto exactamente.

Valores de `EstadoUsuario` en la API: `Pendiente` | `Activo` | `Inactivo` (el UML muestra `Activa`/`Inactiva`; el contrato API manda).

Diagrama de clases y decisiones UML↔código: [`docs/diseño/Contexto — Diagrama de clases.md`](../diseño/Contexto%20—%20Diagrama%20de%20clases.md).

---

## Estado de implementación (backend) — Épica 1

Implementado en NestJS (`api/v1`):

| HU | Endpoint | Estado |
| --- | --- | --- |
| AC-01 | `POST /auth/login` | Implementado |
| AC-02 | `POST /auth/registrar-admin-finca` | Implementado (JWT + `ADMIN_CROPLY`) |
| AC-03a | `GET /auth/validar-invitacion/:token` | Implementado |
| AC-03b | `POST /auth/registrar-invitado` | Implementado |
| AC-04a | `POST /auth/olvide-mi-contrasena` | Implementado (mailer **stub**: log en consola) |
| AC-04b | `POST /auth/resetear-contrasena` | Implementado |
| AC-05 | `PUT /auth/cambio-contrasena` | Implementado |
| AC-06 | `PUT /auth/contrasena-primer-acceso` | Implementado |
| AC-07 | `POST /solicitudes-digitalizacion` | Implementado (público; JWT opcional) |

Errores transversales ERR-01 / ERR-02 / ERR-03 vía `AllExceptionsFilter` global.

### Fuera de alcance de esta entrega (aunque puedan aparecer en el UML)

- CRUD completo de fincas / usuarios / parcelas / cultivos / reportes
- `Permiso`, `RolPermiso`, RBAC granular
- `LogOperaciones`, notificaciones
- SMTP real (solo stub de mail)
- Refresh token (variables en `.env` existen; este contrato no lo exige)
- Tests e2e Nest (`test/` aún no armado)
- Deploy Railway / CI en este repo

### Credenciales de prueba (seed desarrollo)

Al arrancar con DB disponible se siembran admins Croply (idempotente). Ver `CONTEXT.md` y `.env.example` (`SEED_ADMIN_PASSWORD`).
