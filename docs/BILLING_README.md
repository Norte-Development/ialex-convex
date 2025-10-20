# Sistema de Facturación iAlex - Documentación

## Índice de Documentos

### 1. [Resumen Comparativo](./billing-comparison-summary.md)
**Comienza aquí** - Comparación lado a lado de las **3 opciones** de implementación.

**Contenido:**
- Resumen ejecutivo de 3 opciones
- Comparación de tiempos y costos
- Análisis de riesgo
- Recomendación final: **@raideno/convex-stripe**

**Tiempo de lectura:** 12 minutos

---

### 2. [Implementación con @raideno/convex-stripe](./billing-implementation-with-convex-stripe.md) ⭐ **RECOMENDADO**
Plan detallado usando la librería **@raideno/convex-stripe** para integración automática.

**Contenido:**
- Instalación y configuración de la librería
- Schema auto-incluido de Stripe
- Funciones helper pre-construidas
- Sync automático Stripe ↔ Convex
- Protección de features
- UI de pricing y billing

**Características:**
- Tiempo: 3-4 semanas
- Complejidad: Media
- Código: ~1,200 líneas
- Soporta usuarios Y equipos nativamente
- No vendor lock-in
- Solo fees de Stripe (2.9%)

**Recursos:**
- Docs: https://raideno.github.io/convex-stripe/
- Demo: https://convex-stripe-demo.vercel.app/

---

### 3. [Implementación con Clerk Billing](./billing-implementation-with-clerk.md)
Plan detallado para implementación **híbrida** usando Clerk Billing + Stripe.

**Contenido:**
- Configuración de Clerk Dashboard
- Schema simplificado de Convex
- Backend con feature checks
- UI con componentes de Clerk
- Manejo híbrido de equipos

**Características:**
- Tiempo: 2-3 semanas
- Complejidad: Media
- Código: ~1,000 líneas
- UI incluido
- Fees: Stripe + 0.7% Clerk

---

### 4. [Implementación sin Clerk (Custom)](./billing-implementation-without-clerk.md)
Plan detallado para implementación **full custom** con Stripe directo.

**Contenido:**
- Schema extenso de Convex
- Integración completa con Stripe
- Sistema de webhooks
- UI custom de billing
- Gestión de suscripciones

**Características:**
- Tiempo: 6-8 semanas
- Complejidad: Alta
- Código: ~3,500 líneas
- Control total

---

## Planes de Suscripción

### Gratuito - $0/mes
- 2 casos activos
- 10 documentos por caso
- 50 mensajes IA/mes
- GPT-4o-mini
- 500 MB storage

### Premium Individual - $30.000/mes
- Todo ilimitado
- GPT-5
- Crear equipo (3 personas)
- 50 GB storage

### Premium Equipo - $200.000/mes
- Todo ilimitado
- GPT-5 para todos
- 6 miembros
- 200 GB compartidos

### Enterprise - A medida
- Personalizado
- Miembros ilimitados
- Soporte prioritario

---

## Decisión Rápida

### ¿Cuál implementar?

**Elige @raideno/convex-stripe si:** ⭐ **RECOMENDADO**
- ⚡ Balance perfecto: 3-4 semanas
- 👥 Necesitas usuarios Y equipos
- 💰 Quieres ahorrar 0.7% en fees
- 🔓 Valoras no vendor lock-in
- 🛠️ Sync automático + webhooks incluidos

**Elige Clerk Billing si:**
- ⏱️ DEBES lanzar en exactamente 2 semanas
- 👤 Solo usuarios individuales (B2C)
- 🎨 Priorizas UI pulido sobre costos
- 📦 No quieres mantener UI custom

**Elige Stripe Custom si:**
- 🔧 Necesitas personalización extrema
- 👨‍💻 Tienes equipo de 2-3 devs
- ⏳ Puedes esperar 6-8 semanas
- 🎯 Features muy específicas

**Recomendación para iAlex:** 
→ **@raideno/convex-stripe** (mejor balance)

---

## Estructura de Archivos Generados

```
docs/
├── BILLING_README.md                                # Este archivo
├── billing-comparison-summary.md                    # Comparación de 3 opciones
├── billing-implementation-with-convex-stripe.md     # Plan con librería ⭐ RECOMENDADO
├── billing-implementation-with-clerk.md             # Plan con Clerk Billing
└── billing-implementation-without-clerk.md          # Plan custom completo
```

---

## Próximos Pasos

1. **Leer** el [Resumen Comparativo](./billing-comparison-summary.md)
2. **Decidir** qué opción usar (recomendado: @raideno/convex-stripe)
3. **Seguir** el plan detallado correspondiente:
   - ⭐ [@raideno/convex-stripe](./billing-implementation-with-convex-stripe.md)
   - [Clerk Billing](./billing-implementation-with-clerk.md)
   - [Stripe Custom](./billing-implementation-without-clerk.md)
4. **Implementar** según las fases definidas

---

## Comparación Rápida

| Opción | Tiempo | Costos | Equipos | Lock-in |
|--------|--------|--------|---------|---------|
| **@raideno/convex-stripe** ⭐ | 3-4 sem | 2.9% | ✅ | ❌ |
| Clerk Billing | 2-3 sem | 3.6% | Híbrido | ✅ |
| Stripe Custom | 6-8 sem | 2.9% | ✅ | ❌ |

---

## Recursos

**Documentación:**
- @raideno/convex-stripe: https://raideno.github.io/convex-stripe/
- Clerk Billing: https://clerk.com/docs/billing
- Stripe: https://stripe.com/docs
- Convex: https://docs.convex.dev

**Demos:**
- convex-stripe demo: https://convex-stripe-demo.vercel.app/

---

**Última actualización:** Octubre 2025

