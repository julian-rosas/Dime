# Dime — Contexto del Proyecto

> Documento de referencia para el equipo. Cubre business requirements, decisiones técnicas, estado actual del código y pendientes.

---

## 1. Problema que resuelve

En México, la inclusión financiera digital es baja por barreras de usabilidad:

- Solo el **49%** de la población tiene acceso a servicios financieros (CNBV)
- El **80%** de las transacciones se siguen haciendo en efectivo (ABM)
- Las apps bancarias tienen interfaces complicadas, menús profundos y poca consideración por usuarios con baja experiencia digital

**Dime** elimina la interfaz compleja y la reemplaza por una conversación. El usuario escribe en lenguaje natural y el sistema entiende, valida y ejecuta.

---

## 2. Usuario objetivo

- Personas de bajos ingresos en zonas rurales o semiurbanas
- Sin acceso a banco o con cuenta pero sin uso activo de app
- Poca experiencia digital — saben usar WhatsApp pero no apps bancarias
- Prefieren comunicarse en texto informal (español mexicano coloquial)

**Escenario típico de uso:**
1. Usuario abre la app (chat)
2. Escribe: `"Enviar 500 a Juan"`
3. El sistema entiende la intención
4. Verifica saldo y datos del contacto
5. Pide confirmación explícita
6. Ejecuta y confirma con mensaje claro

---

## 3. Business Requirements (BR)

### BR-01 — Transferencia de dinero
El usuario debe poder enviar dinero a un contacto registrado escribiendo un mensaje en lenguaje natural.
- El sistema debe reconocer el monto y el destinatario del mensaje
- El destinatario debe resolverse por nombre completo o alias coloquial (ej. "mamá", "juancho")
- Antes de ejecutar, el sistema **siempre** debe pedir confirmación explícita
- Si el contacto no existe, el sistema debe notificarlo con un mensaje claro
- Si el saldo es insuficiente, el sistema debe bloquearlo e informar el saldo disponible

### BR-02 — Consulta de saldo
El usuario debe poder preguntar su saldo actual en cualquier momento con lenguaje natural.
- El sistema debe mostrar el saldo en pesos mexicanos (MXN)
- Si existen cajitas activas, deben mostrarse junto al saldo

### BR-03 — Cajitas de ahorro (crear)
El usuario debe poder crear una meta de ahorro nombrándola y definiendo una cantidad objetivo.
- El sistema debe confirmar la creación antes de ejecutarla
- El nombre de la cajita es libre (ej. "vacaciones", "celular nuevo")

### BR-04 — Cajitas de ahorro (depositar)
El usuario debe poder depositar dinero hacia una cajita existente desde su saldo.
- Si solo tiene una cajita, el sistema debe usarla automáticamente
- Si tiene varias, debe preguntarle a cuál depositar
- Debe mostrar el progreso visual (barra) tras cada depósito

### BR-05 — Confirmación de operaciones
Toda operación financiera (transferencia o depósito a cajita) debe pasar por un flujo de confirmación antes de ejecutarse.
- El sistema debe recordar la operación pendiente entre mensajes
- Si el usuario no confirma ni cancela, debe recordársele la operación
- El timeout de operación pendiente no está implementado aún (pendiente)

### BR-06 — Manejo de intenciones no reconocidas
Si el sistema no entiende el mensaje, debe responder con un fallback amigable que oriente al usuario sin romper el flujo.

### BR-07 — Accesibilidad lingüística
El sistema debe entender español mexicano coloquial, incluyendo variaciones de ortografía y alias informales.

---

## 4. Stack tecnológico

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| Frontend | HTML + CSS + JS vanilla | Máxima compatibilidad, sin build step, fácil de desplegar |
| Backend | Node.js 20 + TypeScript en AWS Lambda | Serverless = sin servidor que administrar, escala solo |
| API | AWS API Gateway (REST) | Expone la Lambda como HTTP, maneja CORS |
| IA / NLP | Claude Haiku (Anthropic API directa) | Mismo modelo que Bedrock, setup más rápido para hackathon |
| Base de datos | AWS DynamoDB | Serverless, free tier generoso, sin esquema rígido |
| Secretos | AWS Secrets Manager | API key de Anthropic guardada de forma segura |
| Infra como código | AWS CDK (TypeScript) | Todo el stack se despliega con un solo comando |
| Monitoreo | AWS CloudWatch (automático vía Lambda) | Logs sin configuración extra |

---

## 5. Arquitectura del sistema

```
Usuario
  │
  ▼
Frontend (index.html)
  │  POST /message { sessionId, message }
  ▼
API Gateway (REST)
  │
  ▼
Lambda: message.handler
  ├── getSession(sessionId)          → DynamoDB
  ├── parseIntent(message, state)    → Claude API (Anthropic)
  ├── handleIntent / handleConfirm   → finance.ts (lógica mock)
  ├── saveSession(sessionId, state)  → DynamoDB
  └── return { reply, state }
```

**Flujo de datos completo:**
```
mensaje → API Gateway → Lambda → Claude (intent) → motor financiero → DynamoDB → respuesta
```

---

## 6. Estructura de archivos

```
dime/
├── README.md                          — instrucciones de setup y deploy
├── infrastructure/
│   ├── bin/app.ts                     — entry point del CDK app
│   ├── lib/dime-stack.ts              — stack principal (todos los recursos AWS)
│   ├── cdk.json                       — config de CDK
│   ├── package.json
│   └── tsconfig.json
├── backend/
│   ├── handlers/
│   │   └── message.ts                 — Lambda handler principal
│   ├── services/
│   │   ├── ai.ts                      — integración con Claude + parse de intents
│   │   ├── finance.ts                 — motor financiero mock (transferencias, cajitas)
│   │   └── session.ts                 — persistencia de estado en DynamoDB
│   ├── package.json
│   └── tsconfig.json
└── frontend/
    └── index.html                     — chat UI completa (HTML/CSS/JS)
```

---

## 7. Módulos del backend en detalle

### `handlers/message.ts` — Orquestador principal

Recibe `POST /message { sessionId: string, message: string }` y devuelve `{ reply: string, state: UserState }`.

**Flujo interno:**
1. Parsea y valida el body del request
2. Carga el estado de sesión del usuario desde DynamoDB
3. Si hay `pendingOperation` → llama a `handlePendingConfirmation()`
4. Si no → llama a `parseIntent()` con Claude → llama a `handleIntent()`
5. Guarda el estado actualizado en DynamoDB
6. Devuelve la respuesta al frontend

### `services/ai.ts` — Motor de IA

**`parseIntent(message, state)`**
- Construye un system prompt con el contexto completo del usuario (saldo, contactos, cajitas)
- Llama a Claude Haiku con instrucción de responder **solo JSON**
- Devuelve un objeto `ParsedIntent` con `type`, `amount`, `recipient`, etc.
- Si Claude falla, cae a `fallbackParse()` con regex simples

**Intenciones soportadas:**

| Intent | Trigger | Campos extraídos |
|--------|---------|-----------------|
| `transfer` | "enviar/mandar/transferir X a Y" | `amount`, `recipient` |
| `check_balance` | "cuánto tengo / mi saldo" | — |
| `savings_create` | "quiero ahorrar para X, meta Y" | `savingsGoalName`, `savingsTarget` |
| `savings_deposit` | "depositar/guardar X en Y" | `amount`, `savingsGoalId` |
| `savings_view` | "mis ahorros / cajitas" | — |
| `confirm` | "sí / dale / ok / claro" | — |
| `cancel` | "no / cancela / mejor no" | — |
| `help` | "ayuda / qué puedes hacer" | — |
| `unknown` | cualquier otra cosa | — |

**`generateConversationalResponse(prompt, state)`**
- Usado solo para el fallback de `unknown`
- Genera una respuesta en lenguaje natural cuando no se entiende la intención

### `services/finance.ts` — Motor financiero mock

Estado en memoria/DynamoDB por sesión. Sin base de datos financiera real.

**Modelos de datos:**

```typescript
UserState {
  userId: string
  balance: number              // saldo en MXN
  contacts: Contact[]          // lista de contactos con alias
  savings: SavingsGoal[]       // cajitas de ahorro
  pendingOperation?: PendingOperation | null
}

Contact {
  name: string                 // nombre completo
  alias: string[]              // variaciones coloquiales
  phone?: string               // no usado en MVP
}

SavingsGoal {
  id: string                   // goal_<timestamp>
  name: string
  target: number               // meta en MXN
  current: number              // acumulado actual
  createdAt: string
}

PendingOperation {
  type: "transfer" | "savings_deposit" | "savings_create"
  amount?: number
  recipient?: string
  savingsGoalId?: string
  savingsGoalName?: string
  description: string          // texto de confirmación mostrado al usuario
}
```

**Contactos mock de prueba (estado inicial):**
- Juan García — alias: `juan`, `juancho`
- María López — alias: `maria`, `mary`, `mamá`, `mama`
- Carlos Pérez — alias: `carlos`, `carlitos`

**Saldo inicial de prueba:** $1,500.00 MXN

### `services/session.ts` — Persistencia

- Lee/escribe estado en DynamoDB tabla `dime-sessions`
- Si `SESSIONS_TABLE` no está en env vars, usa `Map` en memoria (útil para pruebas locales)
- Si DynamoDB falla, también cae a memoria (resiliencia para hackathon)
- TTL de 7 días en DynamoDB (las sesiones viejas se limpian solas)

### `infrastructure/lib/dime-stack.ts` — Recursos AWS

Recursos creados con CDK:

| Recurso | Nombre | Propósito |
|---------|--------|-----------|
| DynamoDB Table | `dime-sessions` | Estado de sesiones de usuario |
| DynamoDB Table | `dime-transactions` | Historial de transacciones (pendiente de usar) |
| Secrets Manager | `dime/anthropic-api-key` | API key de Anthropic |
| Lambda Function | `dime-message-handler` | Handler principal |
| API Gateway | `dime-api` | Expone `POST /message` y `GET /health` |

**Outputs del deploy:**
- `DimeStack.ApiUrl` — URL base del API
- `DimeStack.MessageEndpoint` — URL completa del endpoint
- `DimeStack.AnthropicSecretName` — nombre del secret para poner la API key

---

## 8. Frontend — `frontend/index.html`

Archivo único sin dependencias externas (excepto Google Fonts).

**Componentes:**
- Header con logo, estado "en línea" y pill de saldo (se actualiza en tiempo real con cada respuesta)
- Lista de mensajes con burbujas usuario/bot, timestamps, scroll automático
- Typing indicator animado mientras espera respuesta
- Quick actions (botones de acceso rápido: saldo, transferir, cajitas, ayuda)
- Input con textarea auto-resize, envío con Enter o botón

**Formato de mensajes del bot:**
- `*texto*` → se renderiza como `<em>` (highlight en verde)
- `**texto**` → se renderiza como `<b>` (bold en verde)

**Configuración necesaria:** cambiar `API_URL` en el JS con la URL del API Gateway después del deploy.

---

## 9. Estado actual del MVP

### ✅ Implementado

- Transferencia con confirmación y validación de saldo
- Consulta de saldo con cajitas integradas
- Crear cajita de ahorro con confirmación
- Depositar a cajita con barra de progreso
- Ver cajitas
- Flujo de confirmación sí/no con memoria de operación pendiente
- Fallback para intenciones no reconocidas (Claude genera respuesta)
- Fallback con regex si Claude falla
- Persistencia en DynamoDB con fallback a memoria
- Frontend chat completo con quick actions y saldo en tiempo real
- CORS habilitado
- Health check en `GET /health`
- Stack CDK completo desplegable con un comando

### ⚠️ Pendiente / por hacer

- [ ] **Timeout de operación pendiente** — si el usuario no confirma en 60s, cancelar automáticamente
- [ ] **Tabla de transacciones** — `dime-transactions` está creada en CDK pero no se usa todavía en el código
- [ ] **Autenticación** — actualmente cualquier `sessionId` accede a cualquier estado; para demo está bien, para producción necesita Cognito
- [ ] **Agregar contactos** — el usuario no puede agregar contactos nuevos desde el chat (solo los 3 mock)
- [ ] **WhatsApp** — el documento menciona Twilio/Meta como canal opcional; no implementado
- [ ] **Canal opcional de Telegram** — alternativa más fácil a WhatsApp si hay tiempo
- [ ] **OTP / login** — autenticación mock mencionada en el documento original
- [ ] **Variable `API_URL`** en frontend — hay que reemplazarla manualmente con la URL de CDK

---

## 10. Comandos de desarrollo

```bash
# Instalar dependencias
cd backend && npm install
cd infrastructure && npm install

# Bootstrap CDK (solo la primera vez por cuenta/región)
cdk bootstrap aws://ACCOUNT_ID/us-east-1

# Ver cambios antes de desplegar
cdk diff

# Desplegar
cd infrastructure && npm run deploy

# Destruir toda la infra (para no generar costos)
cdk destroy

# Probar el endpoint localmente con curl
curl -X POST https://TU_URL/prod/message \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test01","message":"cuánto tengo?"}'
```

---

## 11. Configuración post-deploy

Después de `cdk deploy`, hacer esto en orden:

1. Copiar `DimeStack.MessageEndpoint` del output
2. Abrir `frontend/index.html` y reemplazar `API_URL` con esa URL
3. En AWS Console → Secrets Manager → `dime/anthropic-api-key` → Edit → pegar tu API key de Anthropic
4. Abrir `frontend/index.html` en el navegador y probar

---

## 12. Estimación de costo para el hackathon

| Componente | Costo estimado |
|-----------|----------------|
| Lambda + API Gateway | $0 (free tier) |
| DynamoDB | $0 (free tier) |
| CloudWatch | $0 (free tier) |
| Secrets Manager | ~$0.40 USD/mes por secret |
| **Claude Haiku (Anthropic)** | ~$0.002 USD por conversación |
| 500 conversaciones de prueba | ~$1 USD total |

---

## 13. Equipo

| Integrante | Rol | Área en el código |
|-----------|-----|------------------|
| Arriaga Santana Estela Monserrat | Programador Backend | `backend/`, `services/`, documentación back |
| Arriaga Santana Francesca Carolina | Líder | Git, coordinación, presentación final |
| Milla Romero Monica Yolanda | Programador Frontend | `frontend/`, UI/UX |
| Rodríguez Belmonte Lazaro Eduardo | Programador IA | `services/ai.ts`, integración back |
| Rosas Scull Julian | Programador BD/Cloud | `infrastructure/`, DynamoDB, AWS |

---

## 14. KPIs definidos en el documento original

| KPI | Definición | Meta |
|-----|-----------|------|
| Tasa de intención resuelta | % mensajes donde Claude identifica correctamente la intención | >85% en primeros 500 mensajes |
| Tasa de confirmación completada | % operaciones que llegan a confirmación y se resuelven (sí/no) | >90% con botones, <70% solo texto |
| Retención a 7 días | Usuarios con segunda sesión en 7 días | >40% si se muestra cajita en onboarding |
| Ahorro acumulado por usuario | Total guardado en cajitas / usuarios activos | $350 MXN/mes con 30% de usuarios activos |
| Costo por conversación | Tokens LLM + cómputo por sesión | <$0.002 USD con Haiku |