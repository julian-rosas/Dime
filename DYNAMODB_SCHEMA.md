# Dime DynamoDB Schema

Este documento describe el modelo final propuesto para DynamoDB en Dime.

## Resumen

El modelo separa:

- identidad del usuario
- autenticacion y sesiones de acceso
- conversaciones y mensajes
- relaciones entre usuarios como contactos
- metas de ahorro
- movimientos financieros

Tambien mantiene una tabla de compatibilidad para el backend actual.

## 1. `dime-{stage}-users`

Fuente principal de identidad del usuario dentro de la app.

### Key schema

- `PK`: `userId`

### Campos sugeridos

- `userId`
- `phone`
- `phoneVerified`
- `displayName`
- `legalName`
- `birthDate`
- `curp`
- `rfc`
- `nationality`
- `kycLevel`
- `kycStatus`
- `pinHash`
- `preferredLanguage`
- `preferredChannel`
- `createdAt`
- `updatedAt`

### GSIs

- `phone-index`
  - `PK`: `phone`

### Access patterns

- Obtener perfil del usuario por `userId`
- Buscar usuario por telefono
- Resolver un contacto como usuario real dentro de Dime

## 2. `dime-{stage}-auth-sessions`

Sesiones de autenticacion. No guarda el historial del chat.

### Key schema

- `PK`: `sessionId`

### Campos sugeridos

- `sessionId`
- `userId`
- `deviceId`
- `authMethod`
- `createdAt`
- `expiresAt`
- `ttl`

### GSIs

- `userId-createdAt-index`
  - `PK`: `userId`
  - `SK`: `createdAt`

### Access patterns

- Validar una sesion por `sessionId`
- Listar sesiones activas de un usuario
- Expirar sesiones por TTL

## 3. `dime-{stage}-conversations`

Menu de conversaciones del usuario, similar al listado lateral de ChatGPT.

### Key schema

- `PK`: `userId`
- `SK`: `conversationId`

### Campos sugeridos

- `userId`
- `conversationId`
- `title`
- `status`
- `agentMode`
- `lastMessagePreview`
- `linkedPendingOperation`
- `createdAt`
- `updatedAt`

### GSIs

- `userId-updatedAt-index`
  - `PK`: `userId`
  - `SK`: `updatedAt`

### Access patterns

- Listar conversaciones de un usuario
- Abrir una conversacion especifica
- Ordenar conversaciones por ultima actividad

## 4. `dime-{stage}-conversation-messages`

Historial de mensajes de una conversacion.

### Key schema

- `PK`: `conversationId`
- `SK`: `createdAtMessageId`

### Campos sugeridos

- `conversationId`
- `messageId`
- `sender`
- `text`
- `intent`
- `metadata`
- `createdAt`

### Access patterns

- Listar mensajes de una conversacion
- Reconstruir el contexto de un chat
- Almacenar mensajes de usuario y asistente

## 5. `dime-{stage}-user-contacts`

Relacion entre un usuario y otro usuario real de Dime.

### Key schema

- `PK`: `userId`
- `SK`: `contactUserId`

### Campos sugeridos

- `userId`
- `contactUserId`
- `nickname`
- `aliasForMe`
- `isFavorite`
- `status`
- `createdAt`
- `updatedAt`

### GSIs

- `contactUserId-index`
  - `PK`: `contactUserId`

### Access patterns

- Listar los contactos de un usuario
- Resolver si un usuario ya tiene agregado a otro
- Consultar relaciones inversas cuando sea necesario

## 6. `dime-{stage}-savings-goals`

Cajitas o metas de ahorro del usuario.

### Key schema

- `PK`: `userId`
- `SK`: `goalId`

### Campos sugeridos

- `userId`
- `goalId`
- `name`
- `targetAmount`
- `currentAmount`
- `status`
- `frequency`
- `category`
- `reminderMode`
- `createdAt`
- `updatedAt`

### GSIs

- `userId-status-index`
  - `PK`: `userId`
  - `SK`: `status`

### Access patterns

- Listar cajitas de un usuario
- Calcular el total ahorrado sumando `currentAmount`
- Filtrar cajitas activas o completadas

## 7. `dime-{stage}-transactions`

Historial auditable de movimientos financieros.

### Key schema

- `PK`: `userId`
- `SK`: `createdAtTxId`

### Campos sugeridos

- `userId`
- `txId`
- `type`
- `status`
- `amount`
- `currency`
- `contactUserId`
- `goalId`
- `description`
- `balanceBefore`
- `balanceAfter`
- `createdAt`

### GSIs

- `userId-status-index`
  - `PK`: `userId`
  - `SK`: `status`
- `contactUserId-createdAt-index`
  - `PK`: `contactUserId`
  - `SK`: `createdAt`
- `goalId-createdAt-index`
  - `PK`: `goalId`
  - `SK`: `createdAt`

### Access patterns

- Listar movimientos de un usuario
- Calcular cuanto ha gastado un usuario
- Obtener historial por contacto
- Obtener historial asociado a una cajita

## 8. `dime-{stage}-sessions` (compatibilidad temporal)

Tabla legacy que usa el backend actual del MVP para guardar el estado conversacional por `sessionId`.

### Key schema

- `PK`: `sessionId`

### Campos actuales

- `sessionId`
- `ttl`
- `userId`
- `balance`
- `contacts`
- `savings`
- `pendingOperation`

### Notas

- Esta tabla se mantiene para no romper el handler actual.
- Cuando el backend migre al nuevo modelo, se puede eliminar.

## Mapeo funcional rapido

### Como se relaciona un usuario con su gasto

- `users.userId` -> query en `transactions`
- sumar transacciones de egreso como `transfer_out` o `payment`

### Como se relaciona un usuario con su ahorro

- `users.userId` -> query en `savings-goals`
- sumar `currentAmount`

### Como se relaciona un usuario con sus conversaciones

- `users.userId` -> query en `conversations`

### Como se relaciona un usuario con los mensajes de una conversacion

- `users.userId` -> `conversations.conversationId`
- `conversationId` -> query en `conversation-messages`

### Como se relaciona un usuario con sus contactos

- `users.userId` -> query en `user-contacts`
- `user-contacts.contactUserId` apunta a otro registro de `users`
