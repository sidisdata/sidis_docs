---
sidebar_position: 1
---

# Action Controller 

## Descripción

El Action Controller permite ejecutar diferentes tipos de acciones (email, SMS, WhatsApp, creación de registros) basadas en configuraciones de workflow o de forma individual. Está diseñado para trabajar con el diagrama de flujo mostrado en la imagen, donde las acciones pueden ser disparadas por eventos específicos.

### Tipos de Acciones Disponibles:
- **email**: Envío de correos electrónicos
- **sms**: Envío de mensajes SMS  
- **whatsapp**: Envío de mensajes WhatsApp
- **task**: Creación de registros en cualquier módulo (Task, People, Company, etc.)

## Endpoints Disponibles

### 1. Ejecutar Acción Individual
`POST /actions/execute`

Ejecuta una acción específica directamente.

**Ejemplo de Request:**
```json
{
  "actionData": {
    "id": "action123",
    "type": "email",
    "templateId": "template456",
    "actionId": "abc973943"
  },
  "recipients": [
    {
      "name": "Juan Pérez",
      "email": "juan@example.com",
      "phone": "+1234567890"
    }
  ],
  "triggerData": {
    "event": "peopleCreate",
    "timestamp": "2025-10-06T12:00:00.000Z",
    "userId": "user123"
  }
}
```

### 2. Ejecutar Workflow Completo
`POST /actions/workflow/execute`

Ejecuta todas las acciones configuradas para un evento específico basado en WorkFlowConfig.

**Ejemplo de Request:**
```json
{
  "event": "peopleCreate",
  "peopleId": "670123456789012345678901",
  "triggerData": {
    "timestamp": "2025-10-06T12:00:00.000Z",
    "userId": "user123",
    "source": "manual"
  }
}
```

### 3. Obtener Configuración de Workflow
`GET /actions/workflow/config/:event`

Obtiene la configuración de workflow para un evento específico.

**Ejemplo:** `GET /actions/workflow/config/peopleCreate`

### 4. Listar Todas las Configuraciones
`GET /actions/workflow/configs`

Obtiene todas las configuraciones de workflow disponibles.

## Estructura de WorkFlowConfig

Para que el sistema funcione correctamente, necesitas crear documentos en la colección `WorkFlowConfig` con la siguiente estructura:

```json
{
  "_id": "989374673",
  "event": "peopleCreate",
  "actions": [
    {
      "id": "action1",
      "event": "email/sms/whatsapp/task",
      "actionId": "abc973943",
      "type": "email",
      "templateId": "1abc936283",
      "segmentId": "1abc936283",
      "period": "oneShoot_recurrent",
      "startAt": "2025/10/02 12:00:00",
      "shootBy": "peopleCreate_peopleUpdate_etc"
    },
    {
      "id": "action2",
      "event": "email/sms/whatsapp/task",
      "actionId": "def456789",
      "type": "sms",
      "templateId": "2abc936284",
      "segmentId": "1abc936283",
      "period": "oneShoot_recurrent",
      "startAt": "2025/10/02 12:05:00",
      "shootBy": "peopleCreate_peopleUpdate_etc"
    }
  ]
}
```

## Tipos de Acciones Soportadas

### 1. Email (`type: "email"`)
- Utiliza el controlador `mailgun.controller.ts`
- Función: `sendEmailCorporate`
- Requiere: destinatarios con email válido
- Opcional: templateId para contenido personalizado

### 2. SMS (`type: "sms"`)
- Utiliza el controlador `twilio.controller.ts`
- Función: `sendTwilio`
- Requiere: destinatarios con teléfono válido
- Opcional: templateId para contenido personalizado

### 3. WhatsApp (`type: "whatsapp"`)
- Utiliza el controlador `twilio.controller.ts`
- Función: `sendTwilio` (con path `/whatsapp`)
- Requiere: destinatarios con teléfono válido
- Opcional: templateId para contenido personalizado

### 4. Creación de Registros (`type: "task"`)
- **NUEVO**: Crea registros en cualquier módulo del sistema
- **Módulo por defecto**: Task (si no se especifica `targetModule`)
- **Módulos soportados**: Task, People, Company, o cualquier módulo disponible
- **Configuración flexible**: Permite definir estructura de datos personalizada
- **Variables dinámicas**: Reemplaza variables como `{{name}}`, `{{email}}`, `{{phone}}`

#### Configuración de la Acción:
```json
{
  "type": "task",
  "targetModule": "People",  // Módulo donde crear el registro
  "templateId": "template123", // Opcional: template con estructura de datos
  "recordData": {            // Datos específicos del registro
    "name": "{{name}}",
    "email": "{{email}}",
    "source": "workflow-automation",
    "tags": ["automated", "workflow"]
  }
}
```

#### Ejemplos de Uso:
- **Crear Tarea**: `targetModule: "Task"`
- **Crear Persona**: `targetModule: "People"`  
- **Crear Empresa**: `targetModule: "Company"`
- **Cualquier módulo**: `targetModule: "NombreDelModulo"`

## Respuestas del API

### Respuesta Exitosa Individual
```json
{
  "success": true,
  "message": "Acción ejecutada exitosamente",
  "data": {
    "success": true,
    "message": "Email enviado exitosamente",
    "recipientsCount": 1
  }
}
```

### Respuesta Exitosa Workflow
```json
{
  "success": true,
  "message": "Workflow ejecutado",
  "event": "peopleCreate",
  "totalActions": 2,
  "results": [
    {
      "actionId": "abc973943",
      "type": "email",
      "result": {
        "success": true,
        "message": "Email enviado exitosamente",
        "recipientsCount": 1
      }
    },
    {
      "actionId": "def456789",
      "type": "sms",
      "result": {
        "success": true,
        "message": "SMS enviado exitosamente",
        "recipientsCount": 1
      }
    }
  ]
}
```

### Respuesta de Error
```json
{
  "success": false,
  "message": "Error ejecutando acción",
  "error": "Descripción del error específico"
}
```

## Integración con el Flujo de Trabajo

Basado en el diagrama de la imagen, el flujo funciona así:

1. **SidisChange (intern)** - Detecta cambios en los datos
2. **WorkFlowConfig** - Define qué acciones ejecutar
3. **Action Controller** - Ejecuta las acciones correspondientes:
   - Send Email
   - Send SMS
   - Send WhatsApp
   - Create Task

## Ejemplo de Uso Completo

1. **Crear configuración de workflow:**
```javascript
// Crear en MongoDB colección WorkFlowConfig
{
  "event": "peopleCreate",
  "actions": [
    {
      "id": "welcome-email",
      "type": "email",
      "templateId": "welcome-template-id",
      "actionId": "welcome001"
    },
    {
      "id": "welcome-task",
      "type": "task", 
      "targetModule": "Task",
      "templateId": "task-template-id",
      "actionId": "task001",
      "recordData": {
        "title": "Bienvenida para {{name}}",
        "priority": "high",
        "status": "pending"
      }
    },
    {
      "id": "create-backup-person",
      "type": "task",
      "targetModule": "People",
      "actionId": "backup001", 
      "recordData": {
        "name": "{{name}} - Backup",
        "email": "{{email}}",
        "source": "workflow-backup",
        "tags": ["backup", "automated"]
      }
    }
  ]
}
```

2. **Disparar el workflow:**
```javascript
// POST /actions/workflow/execute
{
  "event": "peopleCreate",
  "peopleId": "670123456789012345678901",
  "triggerData": {
    "timestamp": "2025-10-06T12:00:00.000Z",
    "userId": "user123"
  }
}
```

3. **El sistema automáticamente:**
   - Busca la configuración para el evento "peopleCreate"
   - Obtiene los datos de la persona por ID
   - Ejecuta el email de bienvenida
   - Crea una tarea de seguimiento en el módulo Task
   - Crea un registro de respaldo en el módulo People
   - Retorna el resultado de todas las acciones

## Autenticación

Todos los endpoints requieren autenticación JWT válida mediante el middleware `validateJWT`.

## Dependencias

- `mailgun.controller.ts` - Para envío de emails
- `twilio.controller.ts` - Para SMS y WhatsApp  
- Modelos: `WorkFlowConfig`, `Template`, `People`, `Task`
- Middlewares: `validateJWT`
