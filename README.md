# Dime 💸 — Finanzas conversacionales

App financiera donde el usuario maneja su dinero escribiendo mensajes en lenguaje natural.

---

## Estructura del proyecto

```
dime/
├── infrastructure/   ← CDK (infra en AWS)
├── backend/          ← Lambda Handler + servicios
└── frontend/         ← Chat UI (HTML/JS)
```

---

## Setup inicial (una sola vez)

### 1. Instala prerequisitos

```bash
# Node.js 20 LTS desde https://nodejs.org

# AWS CLI
brew install awscli        # Mac
# Windows: https://aws.amazon.com/cli/

# CDK
npm install -g aws-cdk

# Verifica todo
node --version   # debe ser v20+
aws --version
cdk --version
```

### 2. Configura credenciales AWS

En la consola de AWS:
- IAM → Users → Create user → AdministratorAccess
- Security credentials → Create access key

```bash
aws configure
# AWS Access Key ID: [tu key]
# AWS Secret Access Key: [tu secret]
# Default region: us-east-1
# Output format: json
```

### 3. Instala dependencias

```bash
# Backend
cd dime/backend
npm install

# CDK
cd dime/infrastructure
npm install
```

---

## Deploy en AWS

```bash
cd dime/infrastructure

# Bootstrap CDK (solo la primera vez)
cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/us-east-1

# Ver qué va a crear
cdk diff

# Despliega todo
npm run deploy
```

Al terminar verás algo así en la terminal:

```
✅ DimeStack

Outputs:
DimeStack.ApiUrl = https://abc123.execute-api.us-east-1.amazonaws.com/prod/
DimeStack.MessageEndpoint = https://abc123.execute-api.us-east-1.amazonaws.com/prod/message
DimeStack.AnthropicSecretName = dime/anthropic-api-key
```

---

## Configura tu API Key de Anthropic

Después del deploy, ve a AWS Console:
1. **Secrets Manager** → busca `dime/anthropic-api-key`
2. **Edit** → reemplaza `REEMPLAZA_CON_TU_API_KEY` con tu key real
3. Obtén tu key en: https://console.anthropic.com/

O por CLI:
```bash
aws secretsmanager update-secret \
  --secret-id dime/anthropic-api-key \
  --secret-string "sk-ant-api03-TU_KEY_AQUI"
```

---

## Conecta el frontend

Edita `frontend/index.html` línea ~180:

```javascript
// Reemplaza con tu URL real del output del deploy
const API_URL = "https://abc123.execute-api.us-east-1.amazonaws.com/prod/message";
```

Abre `frontend/index.html` directamente en el navegador. ¡Listo!

---

## Prueba rápida del API

```bash
curl -X POST https://TU_URL/prod/message \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test123","message":"hola, cuánto tengo?"}'
```

Respuesta esperada:
```json
{
  "reply": "💳 Tu saldo: $1,500.00 MXN",
  "state": { "balance": 1500, ... }
}
```

---

## Flujo de una transferencia

```
Usuario: "enviar 300 a juan"
  → Claude detecta: { type: "transfer", amount: 300, recipient: "juan" }
  → Sistema resuelve contacto → Juan García
  → Responde: "💸 Vas a enviar $300.00 MXN a Juan García. ¿Confirmas?"

Usuario: "sí"
  → Claude detecta: { type: "confirm" }
  → Se ejecuta la transferencia
  → Responde: "✅ Transferiste $300.00 MXN a Juan García. Tu nuevo saldo es $1,200.00 MXN."
```

---

## Destruir la infra (para no generar costos)

```bash
cd infrastructure
cdk destroy
```

---

## Costo estimado (free tier de AWS)

| Recurso | Free tier | Costo hackathon |
|---------|-----------|-----------------|
| Lambda | 1M req/mes gratis | $0 |
| API Gateway | 1M req/mes gratis | $0 |
| DynamoDB | 25GB + 200M req gratis | $0 |
| CloudWatch | 5GB logs gratis | $0 |
| **Claude Haiku** | **NO es free** | ~$0.002/conversación |

Con 500 conversaciones de prueba: ~$1 USD total.
