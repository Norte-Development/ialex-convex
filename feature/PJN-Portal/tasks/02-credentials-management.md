# Gestión Segura de Credenciales PJN y Salud de Sesión

## Objetivo

Implementar una **UI y backend robustos para gestionar credenciales PJN y el estado de la sesión**, según la sección **9. Gestión Segura de Credenciales y Monitoreo de Salud de Sesión** de `docs/pjn-integration-features.md`.

## Alcance

- Alta y actualización de credenciales PJN (usuario/contraseña).
- Encriptación en reposo y uso en Cloud Run para login/re‑login.
- Dashboard de estado de conexión (última sync, errores, expiración).
- Integración con el cron de notificaciones y otros flujos PJN.

## Backend – Convex

- [ ] **Almacenamiento de credenciales**
  - [ ] Definir tabla/colección para credenciales PJN por usuario.
  - [ ] Encriptar contraseña usando AES‑256‑GCM (o esquema estándar existente).
  - [ ] Guardar `username`, `encryptedPassword`, `iv`, `lastAuthAt`, `sessionValid`, `syncErrors`.
- [ ] **Mutaciones / actions**
  - [ ] `pjn.saveCredentials`:
    - [ ] Recibe `{ username, password }`.
    - [ ] Encripta y persiste.
    - [ ] Dispara un “probar conexión” contra Cloud Run.
  - [ ] `pjn.removeCredentials`:
    - [ ] Revoca credenciales, limpia flags de sync.
  - [ ] `pjn.getAccountStatus`:
    - [ ] Retorna estado actual para la UI de configuración.
- [ ] **Integración con re‑auth automática**
  - [ ] Endpoint interno para Cloud Run:
    - [ ] Permite que Convex desencripte password y envíe `{ username, password }` cuando se detecta sesión expirada.

## Backend – Cloud Run

- [ ] **Prueba de conexión inicial**
  - [ ] Endpoint `/pjn/test-login`:
    - [ ] Recibe `{ username, password }`.
    - [ ] Intenta login contra PJN SSO.
    - [ ] En caso de éxito, genera y guarda `session_state.json` en bucket `pjn-sessions`.
    - [ ] Devuelve `{ status: "OK" }` o `{ status: "AUTH_FAILED", reason }`.
- [ ] **Re‑autenticación**
  - [ ] Endpoint `/pjn/reauth`:
    - [ ] Similar a test-login pero pensado para flujos automáticos de re‑login.

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
- [ ] Flujos de scraping (notificaciones, expediente, etc.) deben:
  - [ ] Usar el mismo bucket `pjn-sessions` para `session_state.json`.
  - [ ] Notificar a Convex en caso de `AUTH_FAILED`.

## Seguridad y Cumplimiento

- [ ] Revisar que:
  - [ ] No se logueen contraseñas en texto plano.
  - [ ] Los tokens/sesiones PJN solo se almacenen en GCS en un bucket aislado.
  - [ ] Las llamadas de Convex a Cloud Run usen canales autenticados (por ejemplo, service accounts).

## Criterios de Aceptación

- [ ] Un usuario puede conectar su cuenta PJN, ver estado “Conectado” y fecha de última sync.
- [ ] Los errores de autenticación se reflejan claramente en la UI y en logs.
- [ ] El sistema reusa las credenciales encriptadas para re‑autenticar sesiones expiradas sin exponer datos sensibles.


