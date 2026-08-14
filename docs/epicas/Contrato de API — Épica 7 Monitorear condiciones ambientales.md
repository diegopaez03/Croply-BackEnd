# Contrato de API — Épica 7: Monitorear condiciones ambientales

Propietario: Rodrigo Sanz

> Se define lo que el backend debe implementar y lo que el frontend puede esperar recibir. Es un acuerdo entre ambas partes, no una imposición de un lado sobre el otro.
> 
> 
> Este contrato **no repite** las convenciones transversales ya definidas en las épicas anteriores (ERR-01, ERR-02, ERR-03, ERR-04, ERR-05 y la convención de `message` en respuestas exitosas). Antes de implementar cualquier manejo de errores o mensajes de éxito en esta épica, se debe revisar cómo ya están resueltos en el repositorio y **reutilizarlos tal cual están**. Solo se detallan acá los errores y casos **específicos** de los endpoints de esta épica.
> 

---

## Decisiones tomadas y notas de integración

1. **Atributo `codigo_tipo_sensor` como contrato de integración IoT:**
    - En el simulador IoT, los tipos corresponden a un Enum cerrado de 5 valores. En Croply, `TipoSensor` es una entidad persistida mediante ABM.
    - Se mantiene `codigo_tipo_sensor` como puente de comunicación. Al crear o editar un tipo de sensor en Croply, el backend debe validar obligatoriamente que `codigo_tipo_sensor` sea uno de los 5 valores soportados por el simulador: `TEMP_HUME_AMBIENTAL`, `HUMEDAD_SUELO`, `RADIACION_SOLAR`, `PRECIPITACION`, `PH`.
2. **Representación en Frontend (UX del Formulario):**
    - El formulario de creación/edición incluirá un selector obligatorio para `codigo_tipo_sensor` con los 5 valores del catálogo. Al seleccionar un código, el frontend precargará por omisión el `nombre_tipo_sensor` y la `unidad_medida_ts` sugeridos para agilizar la carga, permitiendo al usuario ajustarlos si lo desea.
3. **Auditoría de Creación y Edición (`id_usuario` y Modificaciones):**
    - El Diagrama de Clases (DC) de `TipoSensor` no incluye `id_usuario` ni `fecha_ultima_modificacion`. Dicha trazabilidad y el registro de usuario creador son responsabilidad exclusiva del servicio de auditoría **`LogOperaciones` (HU-GU-12)**. No se agregan campos adicionales a la entidad `TipoSensor`.

---

## HU-IoT-01. ABM de tipos de sensor

- **Autenticación:** Requerida (Rol: Administrador Croply)
- **Headers:** `Authorization: Bearer <JWT>`

### Listar tipos de sensor

`GET /api/v1/tipos-sensor`

```json
{
  "tipos_sensor": [
    {
      "id_tipo_sensor": 15,
      "codigo_tipo_sensor": "PH",
      "nombre_tipo_sensor": "Sensor de pH",
      "unidad_medida_ts": "pH"
    },
    {
      "id_tipo_sensor": 16,
      "codigo_tipo_sensor": "HUMEDAD_SUELO",
      "nombre_tipo_sensor": "Sensor de humedad del suelo",
      "unidad_medida_ts": "%"
    }
  ]
}
```

> El endpoint devuelve únicamente los tipos de sensor **activos**. Los registros con `fecha_baja` no deben aparecer en el listado.
> 
> 
> El `id_tipo_sensor` es necesario para las operaciones de edición y baja. `codigo_tipo_sensor` se incluye porque es el código de integración con el simulador IoT.
> 

Si no existen tipos de sensor activos:

```json
{
  "tipos_sensor": []
}
```

> **Comportamiento Frontend:** Renderiza un Empty State con el mensaje *"Aún no hay tipos de sensor cargados. Hacé clic en 'Nuevo Tipo de Sensor' para comenzar."*
> 

---

### Crear tipo de sensor

`POST /api/v1/tipos-sensor`

```json
{
  "codigo_tipo_sensor": "PH",
  "nombre_tipo_sensor": "Sensor de pH",
  "unidad_medida_ts": "pH"
}
```

`201 Created`:

```json
{
  "message": "Tipo de sensor creado correctamente.",
  "id_tipo_sensor": 15,
  "codigo_tipo_sensor": "PH",
  "nombre_tipo_sensor": "Sensor de pH",
  "unidad_medida_ts": "pH",
  "fecha_alta": "2026-08-10",
  "fecha_baja": null
}
```

> `codigo_tipo_sensor` es obligatorio y debe ser uno de los cinco códigos soportados actualmente por el simulador:
> 
> 
> `TEMP_HUME_AMBIENTAL | HUMEDAD_SUELO | RADIACION_SOLAR | PRECIPITACION | PH`
> 
> El backend debe validar esta restricción independientemente de las validaciones realizadas por el frontend.
> 

---

### Editar tipo de sensor

`PUT /api/v1/tipos-sensor/:id_tipo_sensor`

Mismo shape que la creación en el request.

```json
{
  "codigo_tipo_sensor": "PH",
  "nombre_tipo_sensor": "Sensor de pH",
  "unidad_medida_ts": "pH"
}
```

`200 OK`:

```json
{
  "message": "Tipo de sensor actualizado correctamente.",
  "id_tipo_sensor": 15,
  "codigo_tipo_sensor": "PH",
  "nombre_tipo_sensor": "Sensor de pH",
  "unidad_medida_ts": "pH"
}
```

> `codigo_tipo_sensor` continúa sujeto a la validación del catálogo cerrado del simulador.
> 

---

### Dar de baja tipo de sensor

`DELETE /api/v1/tipos-sensor/:id_tipo_sensor`
Se ejecuta una **baja lógica**, asignando la fecha actual a `fecha_baja`

`200 OK`:

```json
{
  "message": "Tipo de sensor dado de baja correctamente.",
  "id_tipo_sensor": 15
}
```

> El registro no se elimina físicamente y deja de aparecer en `GET /api/v1/tipos-sensor`.
> 

---

### **Errores específicos y transversales**

- `REQUIRED_FIELD` / `DUPLICATE_VALUE`: **ERR-01 / ERR-02 transversales**
- `RESOURCE_NOT_FOUND` (`404`): **ERR-05 transversal** al intentar accionar sobre un `id_tipo_sensor` inexistente o dado de baja

`400 Bad Request` **— código de tipo de sensor no soportado por el simulador:**

```json
{
  "statusCode": 400,
  "errorCode": "INVALID_SENSOR_TYPE_CODE",
  "field": "codigo_tipo_sensor",
  "message": "El código de tipo de sensor no es válido."
}
```

`409 Conflict` **—— Recurso en uso (reutiliza ERR-04 transversal):  tipo de sensor asignado a sensores físicos activos:**

```json
{
  "statusCode": 409,
  "errorCode": "RESOURCE_IN_USE",
  "message": "No es posible dar de baja este tipo de sensor porque está asignado a una o más parcelas."
}
```

> **Regla de validación para la baja:** El error `RESOURCE_IN_USE` se dispara únicamente si existe al menos un **sensor físico activo** asociado a este tipo de sensor. Si los sensores físicos vinculados fueron previamente dados de baja, se permite dar de baja el tipo de sensor sin inconvenientes.
>