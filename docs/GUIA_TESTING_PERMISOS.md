# Guía de Testing del Sistema de Permisos

## 🎯 Objetivo

Validar que el nuevo sistema de permisos funciona correctamente con los niveles: `basic` < `advanced` < `admin`

## 📋 Funciones de Testing Disponibles

### 1. **Funciones Principales de Testing**

```
// Archivo: permissions_testing_suite.ts
- runCompletePermissionsTest       // Test completo para un usuario/caso
- getTestingSuiteData              // Datos para testing manual
- createTestAccessRecord           // Crear permisos de prueba
- testPermissionHierarchy          // Test jerarquía de permisos
- getCaseAccessReport              // Reporte detallado de accesos
- cleanupTestData                  // Limpiar datos de prueba
```

### 2. **Escenarios Específicos**

```
// Archivo: permissions_test_scenarios.ts
- testScenario_NoPermissions       // Usuario sin permisos
- testScenario_BasicPermissions    // Usuario con permisos básicos
- testScenario_PermissionHierarchy // Test jerarquía completa
- testScenario_TeamPermissions     // Test permisos de equipo
- testScenario_MixedPermissions    // Test permisos usuario + equipo
- quickTestSetup                   // Setup rápido de datos de prueba
```

### 3. **Funciones Existentes (Simples)**

```
// Archivo: test_permissions_simple.ts
- getTestData                      // Obtener datos disponibles
- createTestAccess                 // Crear acceso simple
- testAllPermissions               // Test básico de permisos
- clearAllAccess                   // Limpiar todos los accesos
```

## Flujo a probar Paso a Paso

### **PASO 1: Preparar Datos**

```javascript
// Ejecutar en Convex Dashboard
await api.functions.permissions_testing_suite.getTestingSuiteData();
```

**Esto te dará:**

- Lista de casos disponibles
- Lista de usuarios disponibles
- Lista de equipos disponibles
- Permisos existentes

### **PASO 2: Setup Rápido (Opcional)**

```javascript
// Crear datos de prueba automáticamente
await api.functions.permissions_test_scenarios.quickTestSetup({
  caseId: "CASE_ID_AQUI",
  createBasicUser: true,
  createAdvancedUser: true,
  createAdminUser: true,
  createTeamAccess: true,
});
```

### **PASO 3: Crear Permisos Manualmente**

```javascript
// Usuario con acceso básico
await api.functions.permissions_testing_suite.createTestAccessRecord({
  caseId: "CASE_ID_AQUI",
  userId: "USER_ID_AQUI",
  accessLevel: "basic",
  notes: "Test usuario básico",
});

// Usuario con acceso avanzado
await api.functions.permissions_testing_suite.createTestAccessRecord({
  caseId: "CASE_ID_AQUI",
  userId: "OTRO_USER_ID_AQUI",
  accessLevel: "advanced",
  notes: "Test usuario avanzado",
});

// Equipo con acceso admin
await api.functions.permissions_testing_suite.createTestAccessRecord({
  caseId: "CASE_ID_AQUI",
  teamId: "TEAM_ID_AQUI",
  accessLevel: "admin",
  notes: "Test equipo admin",
});
```

### **PASO 4: Ejecutar Tests Principales**

#### Test Completo de Usuario

```javascript
await api.functions.permissions_testing_suite.runCompletePermissionsTest({
  caseId: "CASE_ID_AQUI",
  testUserId: "USER_ID_AQUI", // opcional, usa usuario actual si no se especifica
});
```

#### Test de Jerarquía

```javascript
await api.functions.permissions_testing_suite.testPermissionHierarchy({
  caseId: "CASE_ID_AQUI",
});
```

#### Test de Reporte de Caso

```javascript
await api.functions.permissions_testing_suite.getCaseAccessReport({
  caseId: "CASE_ID_AQUI",
});
```

### **PASO 5: Tests de Escenarios Específicos**

#### Usuario sin permisos

```javascript
await api.functions.permissions_test_scenarios.testScenario_NoPermissions({
  caseId: "CASE_ID_AQUI",
  testUserId: "USER_SIN_PERMISOS_ID",
});
```

#### Usuario con permisos básicos

```javascript
await api.functions.permissions_test_scenarios.testScenario_BasicPermissions({
  caseId: "CASE_ID_AQUI",
  testUserId: "USER_CON_BASIC_ID",
});
```

#### Test de permisos de equipo

```javascript
await api.functions.permissions_test_scenarios.testScenario_TeamPermissions({
  caseId: "CASE_ID_AQUI",
});
```

#### Test de permisos mixtos

```javascript
await api.functions.permissions_test_scenarios.testScenario_MixedPermissions({
  caseId: "CASE_ID_AQUI",
  testUserId: "USER_CON_ACCESO_INDIVIDUAL_Y_EQUIPO_ID",
});
```

### **PASO 6: Verificar Jerarquía de Permisos**

```javascript
await api.functions.permissions_test_scenarios.testScenario_PermissionHierarchy(
  {
    caseId: "CASE_ID_AQUI",
  },
);
```

### **PASO 7: Limpiar Datos de Prueba**

```javascript
// Limpiar solo datos antiguos (últimas 2 horas)
await api.functions.permissions_testing_suite.cleanupTestData({
  keepRecentHours: 2,
});

// O limpiar todo
await api.functions.permissions_testing_suite.cleanupTestData({
  keepRecentHours: 0,
});
```

## ✅ Qué Validar

### **1. Jerarquía de Permisos**

- ✅ Usuario con `admin` puede acceder a `basic`, `advanced` y `admin`
- ✅ Usuario con `advanced` puede acceder a `basic` y `advanced` pero NO a `admin`
- ✅ Usuario con `basic` solo puede acceder a `basic`

### **2. Permisos de Usuario vs Equipo**

- ✅ Permisos directos de usuario funcionan
- ✅ Permisos heredados de equipo funcionan
- ✅ Si usuario tiene ambos, se usa el más alto

### **3. Funciones de Verificación**

- ✅ `checkNewCaseAccess()` retorna acceso correcto
- ✅ `requireNewCaseAccess()` falla apropiadamente cuando no hay permisos
- ✅ `getNewAccessLevel()` retorna nivel correcto y fuente

### **4. Casos de Error**

- ✅ Usuarios sin permisos reciben error apropiado
- ✅ Intentos de acceso a niveles superiores fallan
- ✅ Permisos expirados no funcionan (si implementado)

## 🐛 Problemas Comunes a Buscar

1. **Jerarquía Inversa**: Usuario básico accediendo a funciones admin
2. **Permisos Fantasma**: Permisos que no deberían existir
3. **Conflictos Usuario/Equipo**: Resolución incorrecta de permisos mixtos
4. **Errores de Índices**: Queries que no usan índices correctos
5. **Datos Huérfanos**: Referencias a usuarios/equipos/casos inexistentes

## 📝 Ejemplo de Flujo Completo

```javascript
// 1. Obtener datos
const data =
  await api.functions.permissions_testing_suite.getTestingSuiteData();
console.log("Casos disponibles:", data.testData.cases);
console.log("Usuarios disponibles:", data.testData.users);

// 2. Seleccionar caso y usuarios para testing
const caseId = data.testData.cases[0]._id;
const user1 = data.testData.users[0]._id;
const user2 = data.testData.users[1]._id;

// 3. Crear permisos
await api.functions.permissions_testing_suite.createTestAccessRecord({
  caseId,
  userId: user1,
  accessLevel: "basic",
});
await api.functions.permissions_testing_suite.createTestAccessRecord({
  caseId,
  userId: user2,
  accessLevel: "admin",
});

// 4. Testear usuario básico
const basicTest =
  await api.functions.permissions_testing_suite.runCompletePermissionsTest({
    caseId,
    testUserId: user1,
  });
console.log("Tests usuario básico:", basicTest);

// 5. Testear usuario admin
const adminTest =
  await api.functions.permissions_testing_suite.runCompletePermissionsTest({
    caseId,
    testUserId: user2,
  });
console.log("Tests usuario admin:", adminTest);

// 6. Ver reporte completo
const report =
  await api.functions.permissions_testing_suite.getCaseAccessReport({ caseId });
console.log("Reporte del caso:", report);

// 7. Limpiar cuando termines
await api.functions.permissions_testing_suite.cleanupTestData({
  keepRecentHours: 0,
});
```
