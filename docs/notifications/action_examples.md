---
sidebar_position: 2
---

# Action Examples 

# Ejemplos Prácticos - Action Controller

## 1. Configuración de Base de Datos

Primero, necesitas crear documentos en MongoDB en la colección `WorkFlowConfig`:

```javascript
// Ejemplo 1: Workflow para cuando se crea una persona
db.WorkFlowConfig.insertOne({
  "_id": "peopleCreate_workflow",
  "event": "peopleCreate",
  "actions": [
    {
      "id": "welcome_email",
      "event": "email",
      "actionId": "welcome_001",
      "type": "email",
      "templateId": "welcome_template_id",
      "segmentId": "new_leads",
      "period": "oneShoot",
      "startAt": new Date(),
      "shootBy": "peopleCreate"
    },
    {
      "id": "followup_task",
      "event": "task",
      "actionId": "task_001",
      "type": "task",
      "templateId": "followup_task_template",
      "period": "oneShoot",
      "startAt": new Date(Date.now() + 24*60*60*1000), // 24 horas después
      "shootBy": "peopleCreate"
    }
  ]
});
```

## 2. Crear Templates

```javascript
// Template para email de bienvenida
db.Template.insertOne({
  "_id": "welcome_template_id",
  "name": "Email de Bienvenida",
  "subject": "¡Bienvenido a SIDIS!",
  "content": {
    "text/html": `
      <h1>¡Hola {{name}}!</h1>
      <p>Bienvenido a nuestro sistema SIDIS.</p>
      <p>Tu cuenta ha sido creada exitosamente.</p>
      <p>Saludos,<br>Equipo SIDIS</p>
    `
  },
  "type": "email"
});

// Template para tarea de seguimiento
db.Template.insertOne({
  "_id": "followup_task_template",
  "name": "Tarea de Seguimiento",
  "subject": "Seguimiento de nuevo cliente",
  "content": "Realizar seguimiento telefónico al nuevo cliente para verificar satisfacción y ofrecer servicios adicionales.",
  "type": "task"
});
```

## 3. Uso en tu aplicación

### Opción A: Ejecutar workflow completo automáticamente

```javascript
// En tu código donde se crea una nueva persona
const newPerson = await peopleModel.create({
  name: "Juan Pérez",
  email: "juan@example.com",
  phone: "+1234567890"
});

// Disparar workflow automáticamente
const workflowResponse = await axios.post('/actions/workflow/execute', {
  event: "peopleCreate",
  peopleId: newPerson._id.toString(),
  triggerData: {
    timestamp: new Date(),
    userId: req.user._id,
    source: "web_form"
  }
}, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

console.log('Workflow ejecutado:', workflowResponse.data);
```

### Opción B: Ejecutar acción individual

```javascript
// Enviar solo un email específico
const emailResponse = await axios.post('/actions/execute', {
  actionData: {
    id: "custom_email_001",
    type: "email",
    templateId: "welcome_template_id"
  },
  recipients: [
    {
      name: "Juan Pérez",
      email: "juan@example.com",
      phone: "+1234567890"
    }
  ],
  triggerData: {
    event: "manual",
    timestamp: new Date(),
    userId: "admin_user_id"
  }
}, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

## 4. Integración con SidisChange

Para integrar automáticamente con cambios en los datos (como muestra el diagrama), puedes modificar `sidisChange.ts`:

```typescript
// En legacy/utilities/sidisChange.ts
import axios from 'axios';

export const sidisChangeWorkflow = async (data, moduleName, operation, user, active?) => {
  if (moduleName == "campaign") {
    // Código existente...
  }
  
  // Nueva funcionalidad para People
  if (moduleName == "People" && operation == "create") {
    try {
      // Ejecutar workflow para nueva persona
      await axios.post('http://localhost:3000/actions/workflow/execute', {
        event: "peopleCreate",
        peopleId: data._id.toString(),
        triggerData: {
          timestamp: new Date(),
          userId: user._id,
          source: "system",
          operation: operation
        }
      });
    } catch (error) {
      console.error('Error ejecutando workflow peopleCreate:', error);
    }
  }
  
  // Para updates de People
  if (moduleName == "People" && operation == "update") {
    try {
      await axios.post('http://localhost:3000/actions/workflow/execute', {
        event: "peopleUpdate",
        peopleId: data._id.toString(),
        triggerData: {
          timestamp: new Date(),
          userId: user._id,
          source: "system",
          operation: operation,
          changes: data
        }
      });
    } catch (error) {
      console.error('Error ejecutando workflow peopleUpdate:', error);
    }
  }
};
```

## 5. Ejemplo Completo de Uso

```javascript
// Archivo: test-action-controller.js
const axios = require('axios');

async function testActionController() {
  const baseURL = 'http://localhost:3000';
  const token = 'your_jwt_token_here';
  
  try {
    // 1. Crear una configuración de workflow
    console.log('1. Creando configuración de workflow...');
    // (Esto se hace directamente en MongoDB como se mostró arriba)
    
    // 2. Listar todas las configuraciones
    console.log('2. Listando configuraciones...');
    const configsResponse = await axios.get(`${baseURL}/actions/workflow/configs`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Configuraciones:', configsResponse.data);
    
    // 3. Ejecutar workflow completo
    console.log('3. Ejecutando workflow...');
    const workflowResponse = await axios.post(`${baseURL}/actions/workflow/execute`, {
      event: "peopleCreate",
      peopleId: "670123456789012345678901", // ID de persona existente
      triggerData: {
        timestamp: new Date(),
        userId: "admin",
        source: "test"
      }
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Resultado workflow:', workflowResponse.data);
    
    // 4. Ejecutar acción individual
    console.log('4. Ejecutando acción individual...');
    const actionResponse = await axios.post(`${baseURL}/actions/execute`, {
      actionData: {
        id: "test_sms",
        type: "sms"
      },
      recipients: [
        {
          name: "Test User",
          phone: "+1234567890"
        }
      ],
      triggerData: {
        event: "test",
        timestamp: new Date()
      }
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Resultado acción:', actionResponse.data);
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// testActionController();
```

## 6. Monitoreo y Logs

Para monitorear el funcionamiento:

```javascript
// Verificar logs en la consola del servidor
// Los errores se logearán automáticamente con console.error

// Para ver resultados de acciones ejecutadas:
console.log('Checking action results...');

// También puedes crear un endpoint para ver el historial:
// GET /actions/history (implementar si es necesario)
```

## 7. Ejemplos de Creación Genérica de Registros

### 7.1. Configuración de Workflow con Creación de Registros

```javascript
// Workflow avanzado que crea registros en múltiples módulos
db.WorkFlowConfig.insertOne({
  "_id": "advanced_people_workflow",
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
        "title": "Seguimiento inicial para {{name}}",
        "description": "Contactar a {{name}} ({{email}}) para confirmación de registro",
        "priority": "high",
        "status": "pending",
        "dueDate": "{{timestamp}}",
        "assignedTo": "{{userId}}"
      }
    },
    {
      "id": "backup_person",
      "type": "task",
      "actionId": "backup_001",
      "targetModule": "People",
      "recordData": {
        "name": "{{name}} - Backup",
        "email": "backup-{{email}}",
        "phone": "{{phone}}",
        "source": "workflow-backup",
        "tags": ["backup", "automated"],
        "originalId": "{{originalData._id}}"
      }
    },
    {
      "id": "create_company",
      "type": "task",
      "actionId": "company_001",
      "targetModule": "Company",
      "recordData": {
        "name": "{{name}}'s Company",
        "contactEmail": "{{email}}",
        "contactPhone": "{{phone}}",
        "createdBy": "{{userId}}",
        "source": "people-workflow",
        "status": "prospect"
      }
    }
  ]
});
```

### 7.2. Templates con Datos de Registro

```javascript
// Template para definir estructura de datos del registro
db.Template.insertOne({
  "_id": "task_creation_template",
  "name": "Estructura de Tarea Automática",
  "type": "record",
  "recordData": {
    "title": "Nueva tarea para {{name}}",
    "description": "Tarea creada automáticamente\n\nDetalles:\n- Usuario: {{name}}\n- Email: {{email}}\n- Operación: {{operation}}\n- Módulo: {{moduleName}}",
    "priority": "medium",
    "status": "pending",
    "category": "workflow-automation",
    "metadata": {
      "source": "{{source}}",
      "triggerEvent": "{{operation}}",
      "originalModule": "{{moduleName}}"
    }
  }
});
```

### 7.3. Ejecución con Variables Dinámicas

```javascript
// Las siguientes variables están disponibles automáticamente:
// {{name}}       - Nombre del destinatario
// {{email}}      - Email del destinatario  
// {{phone}}      - Teléfono del destinatario
// {{userId}}     - ID del usuario que disparó el evento
// {{userName}}   - Nombre del usuario que disparó el evento
// {{moduleName}} - Nombre del módulo donde ocurrió el evento
// {{operation}}  - Operación realizada (Create, Update, Delete)
// {{timestamp}}  - Timestamp del evento

// Ejemplo de uso en recordData:
{
  "recordData": {
    "title": "{{operation}} en {{moduleName}} por {{userName}}",
    "description": "Se realizó una operación {{operation}} en el módulo {{moduleName}} para el usuario {{name}} ({{email}}) el {{timestamp}}",
    "relatedUser": "{{userId}}",
    "targetEmail": "{{email}}",
    "createdAt": "{{timestamp}}"
  }
}
```

### 7.4. Casos de Uso Específicos

```javascript
// Caso 1: Crear lead en CRM cuando se registra una persona
{
  "id": "create_lead",
  "type": "task",
  "targetModule": "Lead",
  "actionId": "lead_001",
  "recordData": {
    "name": "{{name}}",
    "email": "{{email}}",
    "phone": "{{phone}}",
    "source": "website-registration",
    "status": "new",
    "score": 50,
    "assignedTo": "{{userId}}",
    "notes": "Lead creado automáticamente desde registro web"
  }
}

// Caso 2: Crear ticket de soporte
{
  "id": "create_support_ticket",
  "type": "task", 
  "targetModule": "Ticket",
  "actionId": "ticket_001",
  "recordData": {
    "title": "Bienvenida y configuración inicial para {{name}}",
    "description": "Ayudar al nuevo usuario {{name}} con la configuración inicial de su cuenta",
    "priority": "normal",
    "status": "open",
    "customerId": "{{originalData._id}}",
    "customerEmail": "{{email}}",
    "category": "onboarding"
  }
}

// Caso 3: Crear entrada en auditoría
{
  "id": "audit_log",
  "type": "task",
  "targetModule": "AuditLog", 
  "actionId": "audit_001",
  "recordData": {
    "action": "{{operation}}",
    "module": "{{moduleName}}",
    "userId": "{{userId}}",
    "targetId": "{{originalData._id}}",
    "timestamp": "{{timestamp}}",
    "details": "Usuario {{userName}} ejecutó {{operation}} en {{moduleName}}",
    "ipAddress": "{{originalData.ipAddress}}",
    "userAgent": "{{originalData.userAgent}}"
  }
}
```

### 7.5. Validación de Módulos

```javascript
// El sistema valida automáticamente que el módulo existe
// Si el módulo no existe, la acción fallará con error descriptivo

// Módulos comúnmente disponibles:
// - Task (tareas)
// - People (personas)
// - Company (empresas)
// - Lead (leads/prospectos)  
// - Ticket (tickets de soporte)
// - AuditLog (logs de auditoría)
// - Campaign (campañas)
// - Template (templates)

// Para usar un módulo personalizado, asegúrate de que:
// 1. Existe en la colección Module
// 2. Tiene un schema definido
// 3. Es accesible via getModel()
```

## 8. Troubleshooting

### Problemas Comunes:

1. **Error: "No se encontró configuración de workflow"**
   - Verificar que existe el documento en `WorkFlowConfig`
   - Verificar que el campo `event` coincida exactamente

2. **Error: "No hay destinatarios con email válido"**
   - Verificar que el documento de `People` tiene un email
   - Verificar que el `peopleId` es válido

3. **Error de autenticación**
   - Verificar que el token JWT sea válido
   - Verificar que el middleware `validateJWT` esté funcionando

4. **Error en envío de email/SMS**
   - Verificar configuración de Mailgun
   - Verificar configuración de Twilio
   - Revisar logs detallados de cada servicio

### Logs útiles:

```bash
# En el servidor, verás logs como:
# "Error ejecutando acción abc973943: [error details]"
# "Workflow ejecutado para evento: peopleCreate"
# "Email enviado exitosamente a 1 destinatarios"
```
