# Dime

App de finanzas conversacionales enfocada en usuarios con baja experiencia digital. La idea es reemplazar interfaces bancarias complejas por un chat donde el usuario escribe cosas como `enviar 500 a Juan` o `cuanto tengo` y el sistema entiende, valida y responde.

## Qué hace el MVP

- Transferencias simuladas con confirmación explícita
- Consulta de saldo
- Cajitas de ahorro: crear, depositar y ver progreso
- Flujo conversacional en español natural
- Persistencia de sesión por `sessionId`
- Backend serverless en AWS

La lógica financiera es mock. No hay integración bancaria real.

## Arquitectura actual

Flujo principal:

```text
App móvil (Expo / React Native)
  -> POST /message
API Gateway
  -> Lambda
    -> Claude / fallback local
    -> DynamoDB
  <- { reply, state }
```

Componentes actuales:

- Frontend móvil: React Native con Expo Go
- Backend: AWS Lambda + TypeScript
- API: API Gateway REST
- IA: Anthropic Claude
- Persistencia: DynamoDB
- Secretos: AWS Secrets Manager
- Infra: AWS CDK

## Estructura del repo

```text
Dime/
├── dimeFrontEnd/
├── dimeBackend/
├── dimeCDK/
├── CONTEXT.md
├── DEPLOYMENT_PLAN.md
└── README.md
```

## API actual

La API expone dos endpoints públicos:

- `GET /health`
  - verifica que el API está vivo
  - responde algo como `{"status":"ok","service":"dime","stage":"dev"}`

- `POST /message`
  - recibe:
    - `sessionId`
    - `message`
  - responde:
    - `reply`
    - `state`

Ejemplo:

```json
{
  "sessionId": "test123",
  "message": "cuanto tengo"
}
```

Respuesta esperada:

```json
{
  "reply": "Tu saldo: $1500.00 MXN",
  "state": {
    "userId": "test123",
    "balance": 1500
  }
}
```

## Frontend móvil y Expo

El frontend no necesita una stack AWS propia para el MVP.

La app en Expo Go solo necesita conocer la URL del API Gateway del ambiente correspondiente:

- `dev` -> API de desarrollo
- `prod` -> API de producción

La comunicación recomendada es HTTP normal con `fetch`. No necesitas WebSocket para el MVP actual porque el flujo es request/response y no hay streaming ni push server-to-client.

Ejemplo conceptual desde React Native:

```ts
const response = await fetch(API_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    sessionId,
    message,
  }),
});

const data = await response.json();
```

## Ambientes AWS

El CDK está preparado para dos ambientes:

- `dev`
- `prod`

Cada uno crea recursos separados con prefijo distinto.

Ejemplos:

- `dime-dev-sessions`
- `dime-prod-sessions`
- `dime-dev-api`
- `dime-prod-api`
- `dime/dev/anthropic-api-key`
- `dime/prod/anthropic-api-key`

Stacks:

- `DimeStack-dev`
- `DimeStack-prod`

## Requisitos

- Node.js 20+
- AWS CLI
- AWS CDK
- credenciales AWS configuradas

Verifica:

```bash
node --version
aws --version
cdk --version
```

## Instalar dependencias

```bash
cd dimeBackend
npm install

cd ../dimeCDK
npm install
```

## Deploy manual

### Bootstrap

Solo la primera vez por cuenta/región:

```bash
cd dimeCDK
cdk bootstrap aws://ACCOUNT_ID/us-east-1
```

### Desarrollo

```bash
cd dimeCDK
npm run deploy:dev
```

### Producción

```bash
cd dimeCDK
npm run deploy:prod
```

### Synth

```bash
cd dimeCDK
npm run synth:dev
npm run synth:prod
```

## Configurar Anthropic

Después del deploy, actualiza el secret en AWS Secrets Manager.

Secrets por ambiente:

- `dime/dev/anthropic-api-key`
- `dime/prod/anthropic-api-key`

Puedes hacerlo desde consola o CLI:

```bash
aws secretsmanager update-secret \
  --secret-id dime/dev/anthropic-api-key \
  --secret-string "sk-ant-api03-TU_KEY_AQUI"
```

## Probar la API

### Health

```bash
curl https://TU_API.execute-api.us-east-1.amazonaws.com/prod/health
```

### Message

En PowerShell:

```powershell
$body = @{
  sessionId = "test123"
  message   = "cuanto tengo"
} | ConvertTo-Json

Invoke-RestMethod -Method POST `
  -Uri "https://TU_API.execute-api.us-east-1.amazonaws.com/prod/message" `
  -ContentType "application/json" `
  -Body $body
```

## CI/CD

Hay workflows de GitHub Actions para:

- CI en PRs
- deploy automático de `develop` a `dev`
- deploy de `main` a `prod`

Archivos:

- `.github/workflows/ci.yml`
- `.github/workflows/deploy-dev.yml`
- `.github/workflows/deploy-prod.yml`

GitHub Environments esperados:

- `dev`
- `prod`

Secrets esperados en cada environment:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `ANTHROPIC_API_KEY`

## Notas importantes

- `GET /health` puede funcionar aunque la key de Anthropic no sea válida
- `POST /message` sí depende del secret correcto para los casos que usan Claude
- hoy no hay autenticación real
- hoy la app usa datos simulados
- hoy no se necesita WebSocket para el flujo definido en los BRs

## Costos

Para un hackathon corto, los principales costos probables son:

- Secrets Manager
- uso de Claude

Lambda, API Gateway y DynamoDB deberían mantenerse muy bajos para tráfico de demo.
