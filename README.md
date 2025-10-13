# iAlex - Sistema Integral de Gestión Legal

iAlex es una plataforma completa de gestión legal que combina organización tradicional de casos jurídicos con inteligencia artificial avanzada, diseñada específicamente para abogados y estudios jurídicos en Argentina.

## 📚 Documentación

- **[Manual de Usuario](./MANUAL_DE_USUARIO.md)** - Guía completa para usuarios finales
- **[PRD](./PRD_IALEX.md)** - Product Requirements Document (técnico)
- **[Documentación Técnica](./DOCUMENTACION_IALEX.md)** - Overview técnico del sistema
- **[Guías de Despliegue](./CI-CD-DEPLOYMENT-GUIDE.md)** - CI/CD y deployment

## 🚀 Stack Tecnológico

- **Backend**: [Convex](https://convex.dev/) - Database, server logic, real-time sync
- **Frontend**: [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- **UI**: [Tailwind CSS](https://tailwindcss.com/) + shadcn/ui
- **Auth**: Firebase Auth con Clerk
- **AI**: OpenAI GPT-4o-mini
- **Storage**: Google Cloud Storage
- **Vector DB**: Qdrant
- **Queue**: Redis + Bull

## 🛠️ Instalación y Configuración

### Requisitos Previos

- Node.js 18+ 
- pnpm (package manager)
- Cuenta en Convex
- Cuenta en Firebase/Clerk
- Google Cloud Storage configurado
- Qdrant instance (local o cloud)
- Redis instance (local o cloud)

### Instalación

1. **Clonar el repositorio**
```bash
git clone <repo-url>
cd ialex-convex
```

2. **Instalar dependencias**
```bash
pnpm install
```

3. **Configurar variables de entorno**
```bash
# En apps/application/
cp .env.example .env.local

# Configurar:
# - VITE_CONVEX_URL
# - Firebase/Clerk credentials
# - GCS credentials
# - etc.
```

4. **Configurar Convex**
```bash
cd apps/application
npx convex dev
```

### Ejecutar en Desarrollo

**Terminal 1 - Frontend:**
```bash
cd apps/application
pnpm dev
```

**Terminal 2 - Document Processor:**
```bash
cd apps/document-processor
pnpm dev
```

### Configuración de Auth

1. Configurar Firebase Auth o Clerk siguiendo la [guía de autenticación](./docs/authentication-quick-reference.md)
2. Configurar las variables de entorno correspondientes
3. Seguir los pasos en [authentication-troubleshooting.md](./docs/authentication-troubleshooting.md) si hay problemas

## 📦 Microservicios

### Document Processor

Microservicio para procesamiento de documentos (OCR, chunking, embeddings).

**Ejecutar en desarrollo:**
```bash
cd apps/document-processor
pnpm dev
```

**Variables de entorno requeridas:**
```bash
cp apps/document-processor/env.example apps/document-processor/.env
```

Configurar en `.env`:
- `OPENAI_API_KEY`: Para generación de embeddings
- `QDRANT_URL`: URL de Qdrant (default: http://localhost:6333)
- `QDRANT_API_KEY`: API key de Qdrant (si aplica)
- `MISTRAL_API_KEY`: Para OCR
- `REDIS_URL`: URL de Redis (default: redis://localhost:6379)
- `HMAC_SECRET`: Para verificación de webhooks

**Servicios requeridos:**
- Redis en ejecución
- Qdrant en ejecución

## 🏗️ Estructura del Proyecto

```
ialex-convex/
├── apps/
│   ├── application/          # Frontend React + Convex backend
│   │   ├── convex/          # Convex functions, schema, agents
│   │   ├── src/             # React components y páginas
│   │   └── types/           # TypeScript types
│   └── document-processor/  # Microservicio de procesamiento
├── packages/
│   ├── database/            # Qdrant client compartido
│   └── shared/              # Utilidades compartidas
├── docs/                    # Documentación técnica
└── rules/                   # Reglas de Convex y guías

## 🎯 Funcionalidades Principales

- ✅ **Gestión de Casos**: Organización completa de casos legales
- ✅ **Gestión de Clientes**: Directorio de clientes con relaciones a casos
- ✅ **Documentos**: Almacenamiento, procesamiento y búsqueda semántica
- ✅ **Escritos Legales**: Editor colaborativo en tiempo real
- ✅ **Asistente de IA**: Chat con IA especializada en derecho argentino
- ✅ **Equipos**: Colaboración con permisos granulares
- ✅ **Base de Datos Legal**: Búsqueda en legislación argentina
- ✅ **Biblioteca**: Repositorio personal de documentos de referencia
- ✅ **Plantillas**: Modelos reutilizables de escritos

## 📝 Testing

```bash
# Frontend tests
cd apps/application
pnpm test

# Document processor tests
cd apps/document-processor
pnpm test
```

## 🚢 Deployment

Ver [CI-CD-DEPLOYMENT-GUIDE.md](./CI-CD-DEPLOYMENT-GUIDE.md) para instrucciones completas de deployment.

**Build para producción:**
```bash
pnpm build
```

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Ver archivo [LICENSE.txt](./LICENSE.txt)

## 📞 Soporte

- **Documentación**: Ver [MANUAL_DE_USUARIO.md](./MANUAL_DE_USUARIO.md)
- **Issues**: Usar GitHub Issues para reportar bugs
- **Email**: soporte@ialex.com.ar

## 🔗 Links Útiles

- [Convex Documentation](https://docs.convex.dev/)
- [React Documentation](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)
