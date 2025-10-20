# Comparación: Implementación de Facturación para iAlex

## Resumen Ejecutivo

Este documento compara las **tres estrategias** de implementación para el sistema de suscripciones de iAlex.

---

## Planes a Implementar

### Plan Gratuito - $0/mes
- 2 casos activos
- 10 documentos por caso
- 50 mensajes IA por mes
- Opción de comprar packs adicionales (50 mensajes por $3 USD)
- IA básica (GPT-4o-mini)
- Solo uso personal
- 500 MB almacenamiento

### Premium Individual - $30.000/mes
- Casos ilimitados
- Documentos ilimitados
- IA avanzada (GPT-5 para dueño, GPT-4o-mini para invitados)
- Mensajes IA ilimitados
- Escritos ilimitados
- Plantillas privadas
- Base de datos legal ilimitada
- Búsqueda inteligente
- Exportar a PDF
- 50 GB almacenamiento
- Crear 1 equipo pequeño (hasta 3 personas)
- Invitar usuario externo a caso

### Premium Equipo - $200.000/mes
- Todo lo de Premium Individual
- GPT-5 para todos los miembros
- Hasta 6 miembros del equipo
- Biblioteca compartida del equipo
- Plantillas del equipo
- Casos compartidos entre miembros
- Permisos y roles personalizables
- 200 GB almacenamiento compartido
- Invitaciones por email
- Panel de administración del equipo

### Enterprise - A medida
- Todo lo de Premium Equipo
- Miembros ilimitados
- Almacenamiento ilimitado
- Soporte prioritario
- Integraciones personalizadas
- Capacitación del equipo

---

## Opción 1: Clerk Billing (Híbrido)

### Stack
- Clerk Billing para usuarios individuales
- Stripe directo para equipos
- Convex para datos
- Clerk Auth (ya implementado)

### Tiempo de Implementación
**2-3 semanas** con equipo de 1-2 developers

### Fases
1. Configuración Clerk Dashboard (3 días)
2. Schema mínimo Convex (2 días)
3. Backend simplificado (1 semana)
4. Frontend con componentes Clerk (3 días)
5. Feature protection (3 días)
6. Testing (3-4 días)
7. Deployment (2 días)

### Ventajas
- Implementación rápida (2-3 semanas)
- UI de pricing incluido
- Billing dashboard incluido
- Menos código custom
- Feature checks simples (`has()`)
- Menor mantenimiento
- Integración perfecta con Clerk Auth

### Desventajas
- Solo B2C (usuarios individuales)
- Requiere Stripe custom para equipos
- Menos control de UX
- Vendor lock-in con Clerk
- Costo adicional: Stripe fees + 0.7% Clerk
- No soporta compra de créditos one-time (requiere Stripe)

### Costos
- Stripe: 2.9% + $0.30 USD por transacción
- Clerk Billing: +0.7% adicional
- Total: ~3.6% + $0.30 USD por transacción
- Desarrollo: 2-3 semanas de salarios

---

## Opción 2: @raideno/convex-stripe (Librería)

### Stack
- @raideno/convex-stripe (librería open-source)
- Stripe para pagos
- Convex para datos
- Clerk solo para auth

### Tiempo de Implementación
**3-4 semanas** con equipo de 1-2 developers

### Fases
1. Instalación y setup (3-4 días)
2. Funciones de facturación (1 semana)
3. Protección de features (1 semana)
4. Frontend UI (3-4 días)
5. Testing (1 semana)
6. Deployment (2-3 días)

### Ventajas
- Implementación rápida (3-4 semanas)
- Sync Stripe ↔ Convex automático
- Webhooks pre-configurados
- Schema de tablas incluido
- Helper functions (`subscribe()`, `portal()`, `pay()`)
- Soporta usuarios Y equipos nativamente
- No vendor lock-in
- Solo fees de Stripe (2.9%)
- Type-safe (TypeScript)
- Código reducido (~1,200 líneas vs ~3,500)

### Desventajas
- UI custom (más trabajo que Clerk)
- Dependencia de librería open-source
- 1 semana más que Clerk Billing
- Requiere conocimiento de la librería

### Costos
- Stripe: 2.9% + $0.30 USD por transacción
- Sin costos adicionales de plataforma
- Desarrollo: 3-4 semanas de salarios

**Recursos:**
- Docs: https://raideno.github.io/convex-stripe/
- Demo: https://convex-stripe-demo.vercel.app/

---

## Opción 3: Stripe Custom (Sin Librerías)

### Stack
- Stripe SDK directamente
- Convex para datos
- Clerk solo para auth
- Webhooks custom completos

### Tiempo de Implementación
**6-8 semanas** con equipo de 2-3 developers

### Fases
1. Schema de Convex (1 semana)
2. Configuración Stripe (1 semana)
3. Backend functions (2 semanas)
4. Frontend UI (1 semana)
5. Feature protection (1 semana)
6. AI Credits (1 semana)
7. Testing (2 semanas)
8. Deployment (1 semana)

### Ventajas
- Control total del sistema
- Flexibilidad completa
- Sin dependencias de librerías
- Personalización ilimitada
- Solo pagas fees de Stripe (2.9%)

### Desventajas
- 6-8 semanas de desarrollo
- Mayor complejidad técnica
- Más superficie para bugs
- Requiere mantener sincronización manual
- Mayor costo de mantenimiento
- Más código (~3,500 líneas)

### Costos
- Stripe: 2.9% + $0.30 USD por transacción
- Sin costos adicionales de plataforma
- Desarrollo: 6-8 semanas de salarios

---

## Comparación Lado a Lado

| Característica | Clerk Billing | @raideno/convex-stripe | Stripe Custom |
|----------------|---------------|------------------------|---------------|
| **Tiempo de desarrollo** | 2-3 semanas | **3-4 semanas** | 6-8 semanas |
| **Complejidad** | Media | **Media** | Alta |
| **Equipo necesario** | 1-2 devs | **1-2 devs** | 2-3 devs |
| **Líneas de código** | ~1,000 | **~1,200** | ~3,500 |
| **UI Pricing** | Built-in | Custom | Custom |
| **UI Billing Dashboard** | Built-in | Custom | Custom |
| **Usuarios individuales** | Nativo | **Nativo** | Custom |
| **Equipos** | Híbrido (Stripe) | **Nativo** | Custom |
| **Compra de créditos IA** | Híbrido (Stripe) | **Nativo** | Custom |
| **Feature checks** | `has()` | Custom utils | Custom utils |
| **Webhooks a manejar** | Solo equipos | **Auto** | Todos manual |
| **Sync Stripe ↔ Convex** | Manual | **Automático** | Manual |
| **Tablas en Convex** | 2-3 nuevas | **Auto-incluidas** | 4-5 nuevas |
| **Flexibilidad** | Limitada | **Alta** | Total |
| **Mantenimiento** | Bajo | **Bajo** | Alto |
| **Vendor lock-in** | Sí (Clerk) | **No** | No |
| **Costos plataforma** | 3.6% | **2.9%** | 2.9% |
| **Type-safe** | Parcial | **Sí** | Sí |

---

## Análisis de Costos por Escenario

### Escenario: 100 suscriptores pagos/mes

**Ingresos mensuales:**
- 80 Premium Individual: $2.400.000
- 4 Premium Equipo: $800.000
- Total: $3.200.000

**Costos de procesamiento:**

**Opción 1: Clerk Billing:**
- Usuarios individuales: $2.400.000 × 3.6% = $86.400
- Equipos (solo Stripe): $800.000 × 2.9% = $23.200
- Total fees: $109.600
- **Neto: $3.090.400 (96.6%)**

**Opción 2: @raideno/convex-stripe:**
- Todo vía Stripe: $3.200.000 × 2.9% = $92.800
- Total fees: $92.800
- **Neto: $3.107.200 (97.1%)**

**Opción 3: Stripe Custom:**
- Todo vía Stripe: $3.200.000 × 2.9% = $92.800
- Total fees: $92.800
- **Neto: $3.107.200 (97.1%)**

**Comparación de ahorro anual:**
- **@raideno/convex-stripe vs Clerk:** +$16.800/mes = +$201.600/año
- **Stripe Custom vs Clerk:** +$16.800/mes = +$201.600/año
- **@raideno/convex-stripe vs Stripe Custom:** Mismos fees, pero 50% menos tiempo de desarrollo

**Break-even de desarrollo:**
- Clerk ahorra 1 semana vs convex-stripe
- convex-stripe ahorra 3-4 semanas vs Stripe custom
- Si 1 developer cuesta $400.000/mes:
  - Ahorro convex-stripe vs custom: ~1 mes × $400.000 = $400.000
  - Costo extra vs Clerk: 1 semana × $100.000 = $100.000
  
convex-stripe se recupera en **6 meses** vs Clerk con 100 suscriptores.

---

## Análisis de Riesgo

### Riesgos - Sin Clerk Billing
- Bugs en sincronización Stripe ↔ Convex
- Manejo de edge cases complejos
- Mayor tiempo para lanzar (pérdida de mercado)
- Requiere expertise en Stripe
- Más puntos de falla

### Riesgos - Con Clerk Billing
- Dependencia de Clerk (qué pasa si Clerk desaparece)
- Limitaciones en personalización
- Billing Beta (puede cambiar APIs)
- Complejidad del sistema híbrido (Clerk + Stripe)
- Costos crecientes con volumen

---

## Recomendación

### Para iAlex: **@raideno/convex-stripe** ⭐

**Justificación:**

1. **Balance Perfecto**
   - Solo 1 semana más que Clerk Billing
   - 50% menos tiempo que Stripe Custom
   - Best of both worlds

2. **Costos Operacionales**
   - 0.7% menos fees que Clerk = $201.600/año de ahorro
   - Mismos fees que Stripe Custom
   - ROI positivo en 6 meses

3. **Flexibilidad**
   - Soporta usuarios Y equipos nativamente
   - No vendor lock-in
   - Control completo del flujo

4. **Mantenimiento**
   - Sync automático (no como Stripe Custom)
   - Webhooks pre-configurados
   - Librería activamente mantenida

5. **Desarrollo**
   - Código reducido (1,200 vs 3,500 líneas)
   - Type-safe con TypeScript
   - Comunidad activa y demos

**Segunda opción: Clerk Billing**
- Si necesitas lanzar en exactamente 2 semanas
- Si priorizas UI pulido sobre costos
- Si no quieres mantener UI custom

**Tercera opción: Stripe Custom**
- Solo si necesitas personalización extrema
- Si tienes equipo sólido de 2-3 devs
- Si puedes esperar 6-8 semanas

### Plan de Acción Recomendado

**Semana 1:**
- Instalar @raideno/convex-stripe
- Configurar Stripe y productos
- Extender schema de Convex

**Semana 2-3:**
- Implementar funciones de suscripción
- Proteger features con verificaciones
- Crear UI de pricing

**Semana 4:**
- Testing completo
- Deploy a producción
- Ejecutar sync inicial

**Mes 2-3:**
- Monitorear métricas
- Optimizar conversión
- Recopilar feedback

**Evaluación futura:**
- Si hay limitaciones con la librería → Migrar a custom
- Si necesitas más features → Fork la librería
- Base de datos compatible con ambas opciones

---

## Criterios de Decisión

### Elige @raideno/convex-stripe si: (RECOMENDADO)
- Quieres balance entre velocidad y costos
- Necesitas soportar usuarios Y equipos
- Valoras flexibilidad sin vendor lock-in
- Puedes dedicar 3-4 semanas
- Quieres ahorrar 0.7% en fees

### Elige Clerk Billing si:
- DEBES lanzar en exactamente 2 semanas
- Solo B2C (usuarios individuales)
- Priorizas UI pulido sobre todo
- No quieres mantener UI custom
- 0.7% extra no es problema

### Elige Stripe Custom si:
- Necesitas personalización extrema
- Tienes equipo de 2-3 devs disponibles
- Puedes esperar 6-8 semanas
- Quieres control absoluto
- Planeas features muy específicas

---

## Próximos Pasos

### Si decides **@raideno/convex-stripe** (Recomendado):
1. Leer: `docs/billing-implementation-with-convex-stripe.md`
2. Instalar librería: `pnpm add @raideno/convex-stripe stripe`
3. Configurar Stripe y crear productos
4. Seguir guía de implementación paso a paso

### Si decides **Clerk Billing**:
1. Leer: `docs/billing-implementation-with-clerk.md`
2. Habilitar Clerk Billing en Dashboard
3. Crear features y plans
4. Implementar según guía

### Si decides **Stripe Custom**:
1. Leer: `docs/billing-implementation-without-clerk.md`
2. Crear cuenta Stripe
3. Planificar sprints de desarrollo
4. Asignar equipo de 2-3 developers

**Documentos de referencia:**
- [Implementación con @raideno/convex-stripe](./billing-implementation-with-convex-stripe.md) ⭐ RECOMENDADO
- [Implementación con Clerk Billing](./billing-implementation-with-clerk.md)
- [Implementación sin Clerk (Custom)](./billing-implementation-without-clerk.md)

