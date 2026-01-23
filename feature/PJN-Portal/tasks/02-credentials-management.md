# Gestión Segura de Credenciales PJN y Salud de Sesión

## Objetivo

Implementar una **UI y backend robustos para gestionar credenciales PJN y el estado de la sesión**, según la sección **9. Gestión Segura de Credenciales y Monitoreo de Salud de Sesión** de `docs/pjn-integration-features.md`.

## Alcance

- Alta y actualización de credenciales PJN (usuario/contraseña).
- Encriptación en reposo y uso en Cloud Run para login/re‑login.
- Dashboard de estado de conexión (última sync, errores, expiración).
- Integración con el cron de notificaciones y otros flujos PJN.

## Backend – Convex

- [x] **Almacenamiento de credenciales**
  - [x] Definir tabla/colección para credenciales PJN por usuario (tabla `pjnAccounts` en schema).
  - [x] Encriptar contraseña usando AES‑256‑GCM (implementado en `pjn/accounts.ts` con Web Crypto API).
  - [x] Guardar `username`, `encryptedPassword`, `iv`, `lastAuthAt`, `sessionValid`, `syncErrors` (todos los campos implementados en schema).
- [x] **Mutaciones / actions**
  - [x] `pjn.saveCredentials`:
    - [x] Recibe `{ username, password }`.
    - [x] Encripta y persiste (usando AES-256-GCM con IV aleatorio).
    - [x] Dispara un "probar conexión" contra Cloud Run (implementado en `connectAccount` action que valida con `/reauth` antes de guardar).
  - [ ] `pjn.removeCredentials`:
    - [ ] Revoca credenciales, limpia flags de sync (pendiente de implementar).
  - [x] `pjn.getAccountStatus`:
    - [x] Retorna estado actual para la UI de configuración (implementado como query).
- [x] **Integración con re‑auth automática**
  - [x] Endpoint interno para Cloud Run:
    - [x] Permite que Convex desencripte password y envíe `{ username, password }` cuando se detecta sesión expirada (implementado `getDecryptedPassword` como internal query).

## Backend – Cloud Run

- [x] **Prueba de conexión inicial**
  - [x] Endpoint `/reauth` (implementado como `/reauth` en lugar de `/pjn/test-login`):
    - [x] Recibe `{ username, password }` (vía `userId`, `username`, `password`).
    - [x] Intenta login contra PJN SSO usando Playwright (refactorizado desde Crawlee para garantizar aislamiento entre llamadas).
    - [x] En caso de éxito, genera y guarda `session_state.json` en bucket `pjn-sessions` (GCS).
    - [x] Devuelve `{ status: "OK" }` o `{ status: "AUTH_FAILED", reason }` o `{ status: "ERROR", error }`.
- [x] **Re‑autenticación**
  - [x] Endpoint `/reauth`:
    - [x] Similar a test-login pero pensado para flujos automáticos de re‑login.
    - [x] Implementado con navegador Playwright fresco por cada llamada (sin estado compartido).
    - [x] Manejo robusto de errores: distingue entre errores de autenticación (`AUTH_FAILED`) y errores de infraestructura (`ERROR`).

## DB / Modelo de Datos

- [ ] Confirmar/definir campos:
  - [ ] `pjnAccount.sessionValid: boolean`.
  - [ ] `pjnAccount.lastSync: timestamp`.
  - [ ] `pjnAccount.lastAuthAt: timestamp`.
  - [ ] `pjnAccount.syncErrors: { lastErrorAt, lastErrorReason, errorCount }`.

## Frontend – UI de Configuración

- [ ] Crear sección **“Integración PJN”** en la configuración (o extender si ya existe):
  - [ ] Vista de **Estado de conexión**:
    - [ ] Texto tipo: “✅ Conectado – Sesión válida hasta …” o “❌ Reautenticación requerida”.
    - [ ] Fechas: última sincronización, próxima sincronización estimada.
  - [ ] **Formulario de credenciales**:
    - [ ] Campos `usuario PJN`, `contraseña PJN`.
    - [ ] Botón “Guardar y probar conexión”.
  - [ ] **Acciones de cuenta**:
    - [ ] Botón “Actualizar contraseña”.
    - [ ] Botón “Desconectar cuenta” (revocar credenciales).
    - [ ] Botón “Probar conexión” manual.
- [ ] Mensajes de privacidad y seguridad:
  - [ ] Mostrar textos tipo:
    - [ ] “🔒 Contraseña encriptada en reposo”.
    - [ ] “🔐 Sesión almacenada en GCS aislado”.

## Integración con Otros Flujos

- [ ] El cron de notificaciones debe:
  - [ ] Ignorar cuentas marcadas como `needs_reauth`.
  - [ ] Registrar errores de autenticación y actualizar `syncErrors`.
- [x] Flujos de scraping (notificaciones, expediente, etc.) deben:
  - [x] Usar el mismo bucket `pjn-sessions` para `session_state.json` (implementado en `SessionStore` con configuración `gcsSessionsBucket`).
  - [ ] Notificar a Convex en caso de `AUTH_FAILED` (pendiente de integración con Convex).

## Seguridad y Cumplimiento

- [x] Revisar que:
  - [x] No se logueen contraseñas en texto plano (verificado: solo se loguea `username`, nunca `password`).
  - [x] Los tokens/sesiones PJN solo se almacenan en GCS en un bucket aislado (implementado en `SessionStore` con `gcsSessionsBucket`).
  - [x] Las llamadas de Convex a Cloud Run usen canales autenticados (implementado `serviceAuthMiddleware` con header `x-service-auth` y secret compartido; podría mejorarse a service accounts en el futuro).

## Criterios de Aceptación

- [ ] Un usuario puede conectar su cuenta PJN, ver estado “Conectado” y fecha de última sync.
- [ ] Los errores de autenticación se reflejan claramente en la UI y en logs.
- [ ] El sistema reusa las credenciales encriptadas para re‑autenticar sesiones expiradas sin exponer datos sensibles.


