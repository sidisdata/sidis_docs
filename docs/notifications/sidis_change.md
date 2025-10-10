---
sidebar_position: 3
---

# Sidis Change Integration

# Integración SidisChange con Action Controller

## Funcionalidad Implementada

La función `sidisChanges` en `libs.ts` ahora tiene **doble funcionalidad**:

1. **Mantiene la funcionalidad original**: Envía peticiones a N8N
2. **Nueva funcionalidad**: Ejecuta workflows internos del Action Controller

## Cómo Funciona

### Flujo de Datos

```
Cambio en DB → sidisChanges() → N8N (original) + Workflow Interno (nuevo)
```

### Detección de Eventos

Los eventos se generan automáticamente basados en:
- **Módulo**: `People`, `Case`, `Company`, etc.
- **Operación HTTP**: `POST`, `PUT`, `DELETE`, `PATCH`

**Mapeo de Operaciones:**
- `POST` → `Create` → Evento: `peopleCreate`
- `PUT` → `Update` → Evento: `peopleUpdate` 
- `DELETE` → `Delete` → Evento: `peopleDelete`
- `PATCH` → `Update` → Evento: `peopleUpdate`

**Formato del evento**: `{moduleName}{MappedOperation}` (ej: `peopleCreate`, `peopleUpdate`)

## Configuración de WorkFlowConfig

### Estructura Actualizada

```javascript
{
  "_id": "workflow_id",
  "event": "peopleCreate", // moduleName + Operation
  "actions": [
    {
      "id": "welcome_email",
      "event": "email", // Mantener por compatibilidad
      "actionId": "email_001", 
      "type": "email", // email|sms|whatsapp|task
      // NUEVO: Para type "task", configuración de creación de registros
      "targetModule": "Task", // Módulo donde crear el registro
      "recordData": {         // Datos específicos del registro
        "field1": "value1",
        "field2": "{{variable}}"
      }
      "templateId": "template_id_opcional",
      "segmentId": "segment_opcional",
      "period": "oneShoot",
      "startAt": "2025-10-06T12:00:00.000Z",
      "shootBy": "peopleCreate"
    }
  ]
}
```

## Eventos Disponibles

### Para People
- `peopleCreate` - Cuando se hace `POST /people` (crear persona)
- `peopleUpdate` - Cuando se hace `PUT /people/:id` o `PATCH /people/:id` (actualizar persona)  
- `peopleDelete` - Cuando se hace `DELETE /people/:id` (eliminar persona)

### Para otros módulos (ejemplos)
- `caseCreate` (POST /cases), `caseUpdate` (PUT/PATCH /cases/:id), `caseDelete` (DELETE /cases/:id)
- `companyCreate` (POST /companies), `companyUpdate` (PUT/PATCH /companies/:id), `companyDelete` (DELETE /companies/:id)
- `productCreate` (POST /products), `productUpdate` (PUT/PATCH /products/:id), `productDelete` (DELETE /products/:id)

### Operaciones Soportadas
| HTTP Method | Mapeo Interno | Evento Generado |
|-------------|---------------|-----------------|
| `POST` | `Create` | `{module}Create` |
| `PUT` | `Update` | `{module}Update` |
| `PATCH` | `Update` | `{module}Update` |
| `DELETE` | `Delete` | `{module}Delete` |

## Extracción de Destinatarios

### Para People
```javascript
// El sistema extrae automáticamente:
{
  name: data.name,
  email: data.email, 
  phone: data.phone
}
```

### Para otros módulos
```javascript
// Busca campos estándar:
{
  name: data.name || data.title,
  email: data.email,
  phone: data.phone
}
```

## Ejemplos de Configuración

### 1. Email de Bienvenida para Nuevas Personas (POST)

```javascript
// Configurar workflow para cuando se hace POST /people (crear persona)
db.WorkFlowConfig.insertOne({
  "event": "peopleCreate", // POST se mapea a Create
  "actions": [
    {
      "id": "welcome_email",
      "actionId": "welcome_001",
      "type": "email",
      "templateId": "673abc123def456789012345", // Template con variables {{name}}, {{email}}
      "period": "oneShoot"
    }
  ]
});
```

### 2. SMS de Confirmación para Updates (PUT/PATCH)

```javascript
// Configurar workflow para cuando se hace PUT /people/:id (actualizar persona)
db.WorkFlowConfig.insertOne({
  "event": "peopleUpdate", // PUT/PATCH se mapea a Update
  "actions": [
    {
      "id": "update_sms",
      "actionId": "sms_001",
      "type": "sms",
      "templateId": "673abc123def456789012346" // Template: "Hola {{name}}, tu información ha sido actualizada"
    }
  ]
});
```

### 3. Tarea Automática para Casos Nuevos (POST)

```javascript
// Configurar workflow para cuando se hace POST /cases (crear caso)
db.WorkFlowConfig.insertOne({
  "event": "caseCreate", // POST se mapea a Create
  "actions": [
    {
      "id": "followup_task", 
      "actionId": "task_001",
      "type": "task",
      "templateId": "673abc123def456789012347", // Template con título y descripción
      "startAt": new Date(Date.now() + 2*60*60*1000) // 2 horas después
    }
  ]
});
```

### 4. Email de Confirmación para Eliminaciones (DELETE)

```javascript
// Configurar workflow para cuando se hace DELETE /people/:id (eliminar persona)
db.WorkFlowConfig.insertOne({
  "event": "peopleDelete", // DELETE se mapea a Delete
  "actions": [
    {
      "id": "deletion_email",
      "actionId": "delete_001", 
      "type": "email",
      "templateId": "673abc123def456789012348" // Template: "Tu cuenta ha sido eliminada"
    }
  ]
});
```

## Templates con Variables

### Email Template
```javascript
db.Template.insertOne({
  "_id": ObjectId("673abc123def456789012345"),
  "name": "Bienvenida Email",
  "subject": "¡Bienvenido {{name}}!",
  "content": {
    "text/html": `
      <h1>¡Hola {{name}}!</h1>
      <p>Tu email {{email}} ha sido registrado exitosamente.</p>
      <p>Saludos,<br>Equipo SIDIS</p>
    `
  },
  "type": "email"
});
```

### SMS Template  
```javascript
db.Template.insertOne({
  "_id": ObjectId("673abc123def456789012346"),
  "name": "SMS Actualización",
  "content": "Hola {{name}}, tu información ha sido actualizada en SIDIS. Si tienes dudas, contáctanos.",
  "type": "sms"
});
```

## Ejemplos de Creación de Registros (type: "task")

### 5. Crear Tarea de Seguimiento

```javascript
// Crear tarea cuando se registra una nueva persona
db.WorkFlowConfig.insertOne({
  "event": "peopleCreate",
  "actions": [
    {
      "id": "followup_task",
      "actionId": "task_001",
      "type": "task",
      "targetModule": "Task", // Crear en módulo Task
      "recordData": {
        "title": "Seguimiento para {{name}}",
        "description": "Contactar a {{name}} ({{email}}) para completar onboarding",
        "priority": "high",
        "status": "pending",
        "assignedTo": "{{userId}}",
        "dueDate": new Date(Date.now() + 24*60*60*1000), // 24 horas
        "category": "onboarding"
      }
    }
  ]
});
```

### 6. Crear Registro de Backup en People

```javascript
// Crear registro de backup cuando se actualiza una persona
db.WorkFlowConfig.insertOne({
  "event": "peopleUpdate",
  "actions": [
    {
      "id": "backup_person",
      "actionId": "backup_001", 
      "type": "task",
      "targetModule": "People", // Crear en módulo People
      "recordData": {
        "name": "{{name}} - Backup",
        "email": "backup-{{email}}",
        "phone": "{{phone}}",
        "source": "workflow-backup",
        "originalId": "{{originalData._id}}",
        "backupDate": "{{timestamp}}",
        "tags": ["backup", "automated"]
      }
    }
  ]
});
```

### 7. Crear Lead en CRM

```javascript
// Crear lead cuando se registra persona con email corporativo
db.WorkFlowConfig.insertOne({
  "event": "peopleCreate",
  "actions": [
    {
      "id": "create_lead",
      "actionId": "lead_001",
      "type": "task", 
      "targetModule": "Lead", // Crear en módulo Lead
      "recordData": {
        "name": "{{name}}",
        "email": "{{email}}",
        "phone": "{{phone}}",
        "source": "website-registration",
        "status": "new",
        "score": 75,
        "assignedTo": "{{userId}}",
        "notes": "Lead creado automáticamente desde People",
        "companySize": "unknown",
        "budget": "unknown"
      }
    }
  ]
});
```

### 8. Crear Entrada de Auditoría

```javascript
// Crear log de auditoría para todas las eliminaciones  
db.WorkFlowConfig.insertOne({
  "event": "peopleDelete",
  "actions": [
    {
      "id": "audit_deletion",
      "actionId": "audit_001",
      "type": "task",
      "targetModule": "AuditLog", // Crear en módulo AuditLog
      "recordData": {
        "action": "DELETE",
        "module": "People",
        "targetId": "{{originalData._id}}",
        "userId": "{{userId}}",
        "userName": "{{userName}}",
        "timestamp": "{{timestamp}}",
        "details": "Usuario {{userName}} eliminó a {{name}} ({{email}})",
        "severity": "high",
        "category": "data-deletion"
      }
    }
  ]
});
```

### 9. Crear Múltiples Registros

```javascript
// Workflow completo que crea registros en varios módulos
db.WorkFlowConfig.insertOne({
  "event": "peopleCreate",
  "actions": [
    {
      "id": "welcome_email",
      "type": "email",
      "actionId": "email_001",
      "templateId": "welcome_template_id"
    },
    {
      "id": "create_task",
      "type": "task",
      "actionId": "task_001",
      "targetModule": "Task",
      "recordData": {
        "title": "Onboarding: {{name}}",
        "priority": "high",
        "status": "pending"
      }
    },
    {
      "id": "create_company",
      "type": "task", 
      "actionId": "company_001",
      "targetModule": "Company",
      "recordData": {
        "name": "{{name}}'s Organization",
        "contactEmail": "{{email}}",
        "status": "prospect"
      }
    },
    {
      "id": "create_opportunity",
      "type": "task",
      "actionId": "opp_001", 
      "targetModule": "Opportunity",
      "recordData": {
        "title": "Oportunidad inicial - {{name}}",
        "contactName": "{{name}}",
        "contactEmail": "{{email}}",
        "stage": "prospecting",
        "value": 1000,
        "probability": 25
      }
    }
  ]
});
```

### Variables Disponibles para Registros

Las siguientes variables se reemplazan automáticamente en `recordData`:

```javascript
// Variables de destinatario
"{{name}}"       // Nombre del destinatario
"{{email}}"      // Email del destinatario
"{{phone}}"      // Teléfono del destinatario

// Variables de trigger
"{{userId}}"     // ID del usuario que disparó el evento
"{{userName}}"   // Nombre del usuario que disparó el evento
"{{moduleName}}" // Módulo donde ocurrió el evento (People, Company, etc.)
"{{operation}}"  // Operación realizada (Create, Update, Delete)
"{{timestamp}}"  // Timestamp del evento (ISO string)

// Variables de datos originales
"{{originalData._id}}"    // ID del registro original
"{{originalData.field}}"  // Cualquier campo del registro original

// Ejemplo de uso:
{
  "recordData": {
    "title": "{{operation}} realizado en {{moduleName}}",
    "description": "El usuario {{userName}} realizó {{operation}} en {{name}}",
    "relatedRecordId": "{{originalData._id}}",
    "createdAt": "{{timestamp}}"
  }
}
```

## Integración Automática

### Flujo de Operaciones HTTP

```javascript
// 1. POST /people (Crear persona)
// sidisChanges() recibe:
// - data: {name: "Juan Pérez", email: "juan@example.com", phone: "+1234567890"}
// - moduleName: "People"  
// - operation: "POST"
// - user: {_id: "user123", name: "Admin"}

// Procesamiento interno:
// - POST se mapea a "Create"
// - Evento generado: "peopleCreate"
// - Busca WorkFlowConfig para "peopleCreate"
// - Ejecuta acciones configuradas (email de bienvenida)

// 2. PUT /people/670123456789012345678901 (Actualizar persona)
// sidisChanges() recibe:
// - data: {_id: "670123456789012345678901", name: "Juan Pérez Updated", email: "juan@example.com"}
// - moduleName: "People"
// - operation: "PUT" 
// - user: {_id: "user123", name: "Admin"}

// Procesamiento interno:
// - PUT se mapea a "Update"
// - Evento generado: "peopleUpdate"
// - Busca WorkFlowConfig para "peopleUpdate"
// - Ejecuta acciones configuradas (SMS de confirmación)

// 3. DELETE /people/670123456789012345678901 (Eliminar persona)
// sidisChanges() recibe:
// - data: {_id: "670123456789012345678901", name: "Juan Pérez", email: "juan@example.com"}
// - moduleName: "People"
// - operation: "DELETE"
// - user: {_id: "user123", name: "Admin"}

// Procesamiento interno:
// - DELETE se mapea a "Delete"
// - Evento generado: "peopleDelete"
// - Busca WorkFlowConfig para "peopleDelete"
// - Ejecuta acciones configuradas (email de confirmación de eliminación)
```

## Logs del Sistema

En la consola del servidor verás logs detallados:

```
Procesando evento: peopleCreate (operación original: POST)
Ejecutando workflow interno para evento: peopleCreate
Acción email (welcome_001) ejecutada: ÉXITO
Workflow interno completado para peopleCreate. Resultados: 1
```

### Ejemplos de Logs por Operación

**Para POST /people:**
```
Procesando evento: peopleCreate (operación original: POST)
Ejecutando workflow interno para evento: peopleCreate
Acción email (welcome_001) ejecutada: ÉXITO
Workflow interno completado para peopleCreate. Resultados: 1
```

**Para PUT /people/123:**
```
Procesando evento: peopleUpdate (operación original: PUT)
Ejecutando workflow interno para evento: peopleUpdate
Acción sms (update_001) ejecutada: ÉXITO
Workflow interno completado para peopleUpdate. Resultados: 1
```

**Para DELETE /people/123:**
```
Procesando evento: peopleDelete (operación original: DELETE)
Ejecutando workflow interno para evento: peopleDelete
Acción email (delete_001) ejecutada: ÉXITO
Workflow interno completado para peopleDelete. Resultados: 1
```

**Si no hay configuración:**
```
Procesando evento: peopleCreate (operación original: POST)
(No aparecen más logs - no hay configuración para este evento)
```

## Testing

### 1. Crear configuración
```javascript
db.WorkFlowConfig.insertOne({
  "event": "peopleCreate",
  "actions": [{
    "id": "test_email",
    "actionId": "test_001", 
    "type": "email"
  }]
});
```

### 2. Crear una persona
```javascript
// Esto automáticamente disparará el workflow
const person = await peopleModel.create({
  name: "Test User",
  email: "test@example.com"
});
```

### 3. Verificar logs
Revisar la consola para ver los mensajes de ejecución del workflow.

## Variables Disponibles en Templates

- `{{name}}` - Nombre de la persona
- `{{email}}` - Email de la persona  
- `{{phone}}` - Teléfono de la persona

## Compatibilidad

- ✅ **N8N**: Funcionalidad original mantenida
- ✅ **Action Controller**: Nueva funcionalidad agregada
- ✅ **Templates existentes**: Compatibles
- ✅ **Configuraciones existentes**: No afectadas

La implementación es **retrocompatible** y **no interfiere** con workflows existentes de N8N.
