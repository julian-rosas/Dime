# Dime Backend Endpoints

Este documento propone el set completo de endpoints para el backend de Dime usando login y signup tradicionales, sin OTP.

## Convenciones

- Todas las rutas autenticadas asumen un token de sesion o JWT
- Todas las respuestas deben estar en JSON
- El prefijo sugerido es `/api`
- `me` representa al usuario autenticado

## 1. Auth

### `POST /api/auth/signup`

Crea una cuenta nueva.

#### Body sugerido

```json
{
  "email": "julian@example.com",
  "phone": "+525512345678",
  "password": "super-secret",
  "displayName": "Julian"
}
```

#### Uso

- registrar usuario
- crear registro en `users`
- crear sesion inicial en `auth-sessions`

### `POST /api/auth/login`

Inicia sesion con email o telefono y password.

#### Body sugerido

```json
{
  "identifier": "julian@example.com",
  "password": "super-secret"
}
```

#### Uso

- validar credenciales
- crear sesion en `auth-sessions`

### `POST /api/auth/logout`

Cierra la sesion actual.

#### Uso

- invalidar o borrar sesion en `auth-sessions`

### `POST /api/auth/refresh`

Renueva el token de acceso.

#### Uso

- refrescar sesion autenticada

### `GET /api/auth/me`

Devuelve el usuario autenticado.

#### Uso

- obtener perfil minimo del usuario autenticado

## 2. Profile

### `GET /api/me`

Obtiene el perfil completo del usuario autenticado.

#### Uso

- leer `users`

### `PATCH /api/me`

Actualiza datos editables del perfil.

#### Body sugerido

```json
{
  "displayName": "Julian",
  "preferredLanguage": "es-MX",
  "preferredChannel": "chat"
}
```

#### Uso

- actualizar `users`

### `GET /api/me/dashboard`

Devuelve los datos de la landing page del usuario.

#### Respuesta sugerida

```json
{
  "balance": 1500,
  "totalSpent": 800,
  "totalSaved": 2000,
  "activeSavingsGoals": 2,
  "recentTransactions": []
}
```

#### Uso

- leer `users`
- leer `transactions`
- leer `savings-goals`

## 3. KYC

### `GET /api/me/kyc`

Obtiene el estado actual de verificacion.

### `POST /api/me/kyc/basic`

Guarda datos basicos de identidad.

#### Body sugerido

```json
{
  "legalName": "Julian Rosas",
  "birthDate": "2000-01-01",
  "curp": "XXXX000000HDFXXX00",
  "nationality": "MX"
}
```

### `POST /api/me/kyc/documents`

Sube o registra documentos de verificacion.

#### Uso

- actualizar `users`
- opcionalmente soportar una futura tabla `kyc-records`

## 4. User Search

### `GET /api/users/search`

Busca usuarios existentes en Dime para agregarlos como contacto.

#### Query params sugeridos

- `email`
- `phone`
- `displayName`

#### Uso

- leer `users`

## 5. Contacts

### `GET /api/me/contacts`

Lista los contactos del usuario autenticado.

#### Uso

- leer `user-contacts`
- enriquecer con `users`

### `POST /api/me/contacts`

Agrega un usuario de Dime como contacto.

#### Body sugerido

```json
{
  "contactUserId": "usr_maria",
  "nickname": "Mama",
  "aliasForMe": ["mama", "mamá", "mary"],
  "isFavorite": true
}
```

#### Uso

- escribir `user-contacts`

### `GET /api/me/contacts/:contactUserId`

Obtiene el detalle de un contacto.

### `PATCH /api/me/contacts/:contactUserId`

Actualiza nickname, alias o favorito de un contacto.

#### Body sugerido

```json
{
  "nickname": "Mamá",
  "aliasForMe": ["mama", "mamá"],
  "isFavorite": true
}
```

### `DELETE /api/me/contacts/:contactUserId`

Elimina un contacto.

## 6. Conversations

### `GET /api/me/conversations`

Lista el menu de conversaciones del usuario.

#### Uso

- leer `conversations`

### `POST /api/me/conversations`

Crea una nueva conversacion.

#### Body sugerido

```json
{
  "title": "Nuevo chat",
  "agentMode": "default"
}
```

#### Uso

- escribir `conversations`

### `GET /api/me/conversations/:conversationId`

Obtiene metadata de una conversacion.

### `PATCH /api/me/conversations/:conversationId`

Actualiza metadata de la conversacion.

#### Body sugerido

```json
{
  "title": "Ahorrar para renta",
  "status": "active"
}
```

### `DELETE /api/me/conversations/:conversationId`

Elimina o archiva una conversacion.

## 7. Conversation Messages

### `GET /api/me/conversations/:conversationId/messages`

Lista los mensajes de una conversacion.

#### Uso

- leer `conversation-messages`

### `POST /api/me/conversations/:conversationId/messages`

Envía un mensaje del usuario al agente dentro de una conversacion.

#### Body sugerido

```json
{
  "message": "enviar 500 a mama"
}
```

#### Uso

- escribir mensaje en `conversation-messages`
- procesar logica del agente
- escribir respuesta del asistente en `conversation-messages`
- opcionalmente actualizar `transactions`, `savings-goals` o `conversations`

### `GET /api/me/conversations/:conversationId/messages/:messageId`

Obtiene un mensaje puntual si se necesita trazabilidad.

## 8. Wallet

### `GET /api/me/wallet`

Devuelve el saldo actual del usuario.

#### Respuesta sugerida

```json
{
  "currency": "MXN",
  "availableBalance": 1500
}
```

#### Uso

- leer `users`

## 9. Transactions

### `GET /api/me/transactions`

Lista los movimientos del usuario.

#### Query params sugeridos

- `type`
- `status`
- `from`
- `to`
- `limit`

#### Uso

- leer `transactions`

### `GET /api/me/transactions/:txId`

Obtiene el detalle de una transaccion.

### `POST /api/me/transfers`

Crea una transferencia.

#### Body sugerido

```json
{
  "contactUserId": "usr_maria",
  "amount": 500,
  "currency": "MXN"
}
```

#### Uso

- validar saldo
- crear item en `transactions`
- opcionalmente dejarla como `pending_confirmation`

### `POST /api/me/transfers/:txId/confirm`

Confirma una transferencia pendiente.

#### Uso

- actualizar `transactions`
- actualizar saldo del usuario

### `POST /api/me/transfers/:txId/cancel`

Cancela una transferencia pendiente.

#### Uso

- actualizar `transactions`

## 10. Savings Goals

### `GET /api/me/savings-goals`

Lista las cajitas del usuario.

#### Uso

- leer `savings-goals`

### `POST /api/me/savings-goals`

Crea una nueva cajita.

#### Body sugerido

```json
{
  "name": "Renta",
  "targetAmount": 3000,
  "frequency": "weekly",
  "category": "necessity"
}
```

#### Uso

- escribir `savings-goals`

### `GET /api/me/savings-goals/:goalId`

Obtiene el detalle de una cajita.

### `PATCH /api/me/savings-goals/:goalId`

Actualiza nombre, meta o estado de una cajita.

#### Body sugerido

```json
{
  "name": "Renta abril",
  "targetAmount": 3500,
  "status": "active"
}
```

### `DELETE /api/me/savings-goals/:goalId`

Elimina o cierra una cajita.

### `POST /api/me/savings-goals/:goalId/deposits`

Deposita dinero en una cajita.

#### Body sugerido

```json
{
  "amount": 200,
  "currency": "MXN"
}
```

#### Uso

- actualizar `savings-goals`
- crear registro en `transactions`

## 11. System

### `GET /api/health`

Healthcheck del servicio.

### `GET /api/version`

Devuelve version del backend o hash de release.

## 12. MVP Recomendado

Si quieren implementar primero lo minimo con buen valor, priorizaria:

1. `POST /api/auth/signup`
2. `POST /api/auth/login`
3. `GET /api/auth/me`
4. `GET /api/me/dashboard`
5. `GET /api/me/contacts`
6. `POST /api/me/contacts`
7. `GET /api/me/conversations`
8. `POST /api/me/conversations`
9. `GET /api/me/conversations/:conversationId/messages`
10. `POST /api/me/conversations/:conversationId/messages`
11. `GET /api/me/transactions`
12. `GET /api/me/savings-goals`
13. `POST /api/me/savings-goals`
14. `POST /api/me/savings-goals/:goalId/deposits`

## 13. Mapeo Endpoint -> DynamoDB

- `signup` -> `users`, `auth-sessions`
- `login` -> `users`, `auth-sessions`
- `logout` -> `auth-sessions`
- `auth/me` -> `users`
- `dashboard` -> `users`, `transactions`, `savings-goals`
- `contacts` -> `user-contacts`, `users`
- `users/search` -> `users`
- `conversations` -> `conversations`
- `conversation messages` -> `conversation-messages`, `conversations`
- `wallet` -> `users`
- `transactions` -> `transactions`
- `transfers` -> `transactions`, `users`
- `savings goals` -> `savings-goals`
- `deposits` -> `savings-goals`, `transactions`
