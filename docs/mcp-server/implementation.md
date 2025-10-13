# SIDIS API Gateway - Guía de Implementación

**Target:** Desarrolladores que van a integrar o extender el sistema

##  Quick Start para Desarrolladores

### Estructura del Proyecto

```
sidis-api-gateway/
├── src/
│   ├── app.ts                    #  Entry point principal
│   ├── app-simple.ts             #  Versión simplificada para pruebas
│   │
│   ├── controllers/              #  Lógica de endpoints
│   │   ├── chat.controller.ts    #  Manejo de conversaciones
│   │   ├── auth.controller.ts    #  Autenticación (futuro)
│   │   └── models.controller.ts  #  Gestión de modelos SIDIS
│   │
│   ├── services/                 #  Servicios de negocio
│   │   ├── mcp.service.ts        #  Conexión con MCP Server
│   │   ├── llm.service.ts        #  Integración LLMs
│   │   └── sidis.service.ts      #  Cliente SIDIS directo
│   │
│   ├── routes/                   #  Definición de rutas
│   │   ├── api.routes.ts         #  Rutas principales
│   │   └── auth.routes.ts        #  Rutas de auth (futuro)
│   │
│   ├── middleware/               #  Middlewares
│   │   ├── auth.middleware.ts    #  Autenticación
│   │   ├── rate-limit.middleware.ts #  Rate limiting
│   │   └── validation.middleware.ts #  Validación
│   │
│   ├── types/                    #  Tipos TypeScript
│   │   ├── api.types.ts          #  Tipos de API
│   │   ├── mcp.types.ts          #  Tipos MCP
│   │   └── billing.types.ts      #  Tipos de billing
│   │
│   └── utils/                    #  Utilidades
│       ├── config.ts             #  Configuración
│       ├── logger.ts             #  Sistema de logs
│       └── validators.ts         #  Validadores
│
├── docs/                         #  Documentación
├── dist/                         #  Código compilado
├── start.js                      #  Script de inicio con validaciones
├── test-start.js                 #  Script de prueba
└── package.json                  #  Configuración NPM
```

---

## 🔧 Implementación Detallada

### 1. Sistema de Conversación Inteligente

#### **Flujo de una Consulta**

```typescript
// 1. Request llega a ChatController.chat()
const { message, conversationId } = req.body;

// 2. Obtener herramientas MCP disponibles
const tools = await this.mcpService.getAvailableTools();

// 3. Preparar contexto de conversación
let conversation = this.conversations.get(conversationId) || [];
conversation.push({ role: 'user', content: message });

// 4. Primera llamada al LLM con herramientas
const llmResponse = await this.llmService.generateResponse(
    conversation, 
    this.llmService.formatToolsForLLM(tools)
);

// 5. Si hay tool_calls, ejecutarlos
if (llmResponse.tool_calls?.length > 0) {
    const toolResults = await Promise.all(
        llmResponse.tool_calls.map(async (toolCall) => {
            const result = await this.mcpService.callTool(
                toolCall.function.name,
                JSON.parse(toolCall.function.arguments)
            );
            return { role: 'tool', content: JSON.stringify(result) };
        })
    );
    
    // 6. Segunda llamada al LLM con resultados
    conversation.push(llmResponse, ...toolResults);
    finalResponse = await this.llmService.generateResponse(conversation);
}
```

#### **System Prompt Especializado**

```typescript
const SIDIS_SYSTEM_PROMPT = `Eres un asistente experto en el sistema SIDIS. 

INSTRUCCIONES:
- Siempre usa las herramientas disponibles para obtener datos reales
- Para listar: usa "leads_list", "contacts_list", etc.
- Para detalles: usa "leads_get" con ID específico
- Para filtros complejos: usa herramientas de agregación
- Responde de forma clara y estructurada
- Si no encuentras datos, sugiere alternativas

HERRAMIENTAS DISPONIBLES:
${tools.map(t => `- ${t.name}: ${t.description}`).join('\n')}`;
```

### 2. Integración MCP (Model Context Protocol)

#### **Comunicación JSON-RPC 2.0**

```typescript
// Estructura de mensaje MCP
interface McpMessage {
    jsonrpc: '2.0';
    id: number;
    method: string;  // 'tools/call' | 'tools/list'
    params?: {
        name?: string;       // Nombre de la herramienta
        arguments?: any;     // Argumentos para la herramienta
    };
}

// Ejemplo: Listar herramientas
const listToolsRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list'
};

// Ejemplo: Llamar herramienta
const callToolRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
        name: 'leads_list',
        arguments: { limit: 10, status: 'active' }
    }
};
```

#### **Spawn del Proceso MCP**

```typescript
this.mcpProcess = spawn('tsx', [mcpServerPath], {
    stdio: ['pipe', 'pipe', 'pipe'],  // stdin, stdout, stderr
    env: {
        ...process.env,
        API_BASE: CONFIG.SIDIS_API_BASE,
        MODELS_PATH: CONFIG.SIDIS_MODELS_PATH,
        BEARER_TOKEN: CONFIG.SIDIS_API_KEY
    }
});

// Comunicación bidireccional
this.mcpProcess.stdin.write(JSON.stringify(request) + '\n');
this.mcpProcess.stdout.on('data', handleResponse);
```

### 3. Integración LLM Multi-Provider

#### **Arquitectura Extensible**

```typescript
interface LLMProvider {
    generateResponse(messages: ChatMessage[], tools?: any[]): Promise<ChatMessage>;
    formatTools(tools: McpTool[]): any[];
}

class OpenAIProvider implements LLMProvider {
    async generateResponse(messages: ChatMessage[], tools?: any[]) {
        const response = await this.openai.chat.completions.create({
            model: this.config.model,
            messages: messages,
            tools: tools,
            tool_choice: 'auto'
        });
        return this.formatResponse(response);
    }
}

class AnthropicProvider implements LLMProvider {
    // Implementación para Claude
}

class GeminiProvider implements LLMProvider {
    // Implementación para Gemini
}
```

#### **Function Calling Automático**

```typescript
// El LLM decide automáticamente qué herramientas usar
const tools = [
    {
        type: 'function',
        function: {
            name: 'leads_list',
            description: 'Lista leads del CRM con filtros opcionales',
            parameters: {
                type: 'object',
                properties: {
                    limit: { type: 'number', description: 'Número máximo de results' },
                    status: { type: 'string', description: 'Filtrar por status' }
                }
            }
        }
    }
];

// LLM responde con tool_calls si necesita usar herramientas
const response = {
    role: 'assistant',
    content: null,
    tool_calls: [
        {
            id: 'call_123',
            type: 'function',
            function: {
                name: 'leads_list',
                arguments: '{"limit": 5, "status": "active"}'
            }
        }
    ]
};
```

---

##  Extensiones y Customizaciones

### 1. Agregar Nuevo Proveedor LLM

```typescript
// 1. src/types/api.types.ts
export type LLMProviders = 'openai' | 'anthropic' | 'gemini' | 'ollama';

// 2. src/services/llm.service.ts
class LLMService {
    private initializeProvider(): void {
        switch (this.config.provider) {
            case 'openai':
                this.openai = new OpenAI({ apiKey: this.config.apiKey });
                break;
            case 'ollama':  // Nuevo proveedor
                this.ollama = new OllamaClient({ baseUrl: this.config.baseUrl });
                break;
        }
    }
    
    private async callOllama(messages: ChatMessage[], tools?: any[]) {
        // Implementación específica de Ollama
    }
}

// 3. src/utils/config.ts
OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
```

### 2. Agregar Middleware de Autenticación

```typescript
// src/middleware/auth.middleware.ts
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({ 
            success: false, 
            error: 'Token requerido' 
        });
    }
    
    try {
        const decoded = jwt.verify(token, CONFIG.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ 
            success: false, 
            error: 'Token inválido' 
        });
    }
};

// Uso en rutas
router.post('/chat', authMiddleware, chatController.chat);
```

### 3. Sistema de Billing

```typescript
// src/services/billing.service.ts
export class BillingService {
    async trackUsage(userId: string, operation: string, tokens: number) {
        // Registrar uso para billing
        await this.db.usage.create({
            userId,
            operation,
            tokens,
            timestamp: new Date(),
            cost: this.calculateCost(operation, tokens)
        });
    }
    
    async checkQuota(userId: string): Promise<boolean> {
        const usage = await this.getMonthlyUsage(userId);
        const plan = await this.getUserPlan(userId);
        return usage.tokens < plan.tokenLimit;
    }
}

// Uso en chat controller
if (!await this.billingService.checkQuota(req.user.id)) {
    return res.status(429).json({ 
        success: false, 
        error: 'Quota exceeded' 
    });
}
```

---

##  Testing y Desarrollo

### Tests Unitarios

```typescript
// tests/services/mcp.service.test.ts
describe('McpService', () => {
    let mcpService: McpService;
    
    beforeEach(() => {
        mcpService = new McpService();
    });
    
    test('should connect to MCP server', async () => {
        await mcpService.initialize();
        expect(mcpService.isReady()).toBe(true);
    });
    
    test('should list available tools', async () => {
        await mcpService.initialize();
        const tools = await mcpService.getAvailableTools();
        expect(tools).toHaveLength(greaterThan(0));
        expect(tools[0]).toHaveProperty('name');
    });
});
```

### Tests de Integración

```typescript
// tests/integration/chat.test.ts
describe('Chat Integration', () => {
    test('should handle complete chat flow', async () => {
        const response = await request(app)
            .post('/api/chat')
            .send({
                message: 'Lista 3 leads',
                conversationId: 'test-123'
            })
            .expect(200);
            
        expect(response.body.success).toBe(true);
        expect(response.body.data.toolsUsed).toBeGreaterThan(0);
        expect(response.body.data.message).toContain('leads');
    });
});
```

### Mocking para Desarrollo

```typescript
// src/mocks/mcp.mock.ts
export class MockMcpService implements McpService {
    async initialize() { return Promise.resolve(); }
    
    async callTool(toolName: string, args: any) {
        return {
            content: [{
                text: `Mock result for ${toolName} with args ${JSON.stringify(args)}`
            }]
        };
    }
    
    async getAvailableTools() {
        return [
            { name: 'leads_list', title: 'List Leads', description: 'Mock tool' }
        ];
    }
}

// Uso en desarrollo
const mcpService = process.env.NODE_ENV === 'test' 
    ? new MockMcpService() 
    : new McpService();
```

---

##  Patrones de Diseño Implementados

### 1. **Dependency Injection**
```typescript
// Los servicios se inyectan en los controladores
export class ChatController {
    constructor(
        private mcpService: McpService,
        private llmService: LLMService
    ) {}
}
```

### 2. **Strategy Pattern (LLM Providers)**
```typescript
interface LLMStrategy {
    generate(messages: ChatMessage[]): Promise<ChatMessage>;
}

class LLMService {
    private strategy: LLMStrategy;
    
    setProvider(provider: 'openai' | 'anthropic') {
        this.strategy = this.createStrategy(provider);
    }
}
```

### 3. **Observer Pattern (Logging)**
```typescript
class Logger {
    private static observers: LogObserver[] = [];
    
    static addObserver(observer: LogObserver) {
        this.observers.push(observer);
    }
    
    static info(message: string) {
        this.observers.forEach(obs => obs.onLog('info', message));
    }
}
```

---

##  Métricas y Monitoring

### Health Checks Customizados

```typescript
// src/utils/health.ts
export class HealthChecker {
    async checkMcp(): Promise<HealthStatus> {
        try {
            const tools = await this.mcpService.getAvailableTools();
            return { status: 'healthy', toolsCount: tools.length };
        } catch (error) {
            return { status: 'unhealthy', error: error.message };
        }
    }
    
    async checkLLM(): Promise<HealthStatus> {
        try {
            await this.llmService.generateResponse([
                { role: 'user', content: 'test' }
            ]);
            return { status: 'healthy' };
        } catch (error) {
            return { status: 'unhealthy', error: error.message };
        }
    }
}
```

### Métricas Personalizadas

```typescript
// src/utils/metrics.ts
class Metrics {
    private static counters = new Map<string, number>();
    
    static increment(metric: string, value = 1) {
        const current = this.counters.get(metric) || 0;
        this.counters.set(metric, current + value);
    }
    
    static getMetrics() {
        return Object.fromEntries(this.counters);
    }
}

// Uso en servicios
Metrics.increment('chat.requests');
Metrics.increment('mcp.tool_calls');
Metrics.increment('llm.tokens', response.usage.total_tokens);
```

---

##  Deployment Avanzado

### Docker Multi-stage

```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY src/ ./src/
COPY tsconfig.json ./
RUN npm run build

# Production stage  
FROM node:18-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY start.js ./

USER node
EXPOSE 3000
CMD ["node", "start.js"]
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sidis-api-gateway
spec:
  replicas: 3
  selector:
    matchLabels:
      app: sidis-api-gateway
  template:
    metadata:
      labels:
        app: sidis-api-gateway
    spec:
      containers:
      - name: api-gateway
        image: sidis/api-gateway:latest
        ports:
        - containerPort: 3000
        env:
        - name: SIDIS_API_KEY
          valueFrom:
            secretKeyRef:
              name: sidis-secrets
              key: api-key
        - name: LLM_API_KEY
          valueFrom:
            secretKeyRef:
              name: llm-secrets
              key: openai-key
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy API Gateway

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    - uses: actions/setup-node@v2
      with:
        node-version: '18'
    - run: npm ci
    - run: npm run test
    - run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
    - name: Deploy to production
      run: |
        docker build -t sidis/api-gateway:${{ github.sha }} .
        docker push sidis/api-gateway:${{ github.sha }}
        kubectl set image deployment/sidis-api-gateway \
          api-gateway=sidis/api-gateway:${{ github.sha }}
```

---

##  Checklist para Desarrolladores

### Antes de Commit
- [ ] Tests unitarios pasan
- [ ] Tests de integración pasan
- [ ] TypeScript compila sin errores
- [ ] Logs estructurados implementados
- [ ] Documentación actualizada

### Antes de Deploy
- [ ] Variables de entorno configuradas
- [ ] Health checks implementados
- [ ] Métricas de monitoring
- [ ] Rate limiting configurado
- [ ] Logs en producción

### Para Nuevas Features
- [ ] Tipos TypeScript definidos
- [ ] Tests unitarios escritos
- [ ] Documentación de API actualizada
- [ ] Backward compatibility verificada

---

**¿Necesitas ayuda implementando alguna de estas funcionalidades o tienes preguntas específicas sobre el código?**
