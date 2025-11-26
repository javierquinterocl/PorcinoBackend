# 🐷 Sistema de Gestión Porcina - Backend

Backend de la aplicación de gestión porcina con Node.js, Express y PostgreSQL.

---

## 📋 Cambios Recientes - Eventos del Calendario

### ✅ Funcionalidades Implementadas

#### 1. **Tracking de Usuarios**
- Los eventos registran automáticamente quién los creó
- Información del usuario (email y nombre) disponible en todas las consultas
- Campo `created_by` y `updated_by` con foreign keys a la tabla users

#### 2. **Asociación con Cerdas**
- Eventos pueden asociarse con cerdas específicas
- Endpoint `/api/sows/simplified` para obtener lista de cerdas
- Información de la cerda incluida automáticamente en las respuestas
- Frontend con select para elegir cerda

#### 3. **Correos Mejorados**
- Notificaciones por email incluyen toda la información del evento
- Muestra: título, descripción, fecha, hora (Colombia), usuario creador, cerda asociada
- Diseño profesional y responsive
- Hora en zona horaria colombiana (America/Bogota, UTC-5)

---

## 🚀 Instalación y Configuración

### 1. Clonar el repositorio
```bash
git clone <url-del-repo>
cd PorcinoBackend
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
Crear archivo `.env` con:
```env
# Base de datos
DATABASE_URL=postgresql://usuario:contraseña@host:5432/nombre_bd
PGHOST=host
PGPORT=5432
PGDATABASE=nombre_bd
PGUSER=usuario
PGPASSWORD=contraseña

# JWT
JWT_SECRET=tu_secreto_jwt_aqui

# Email (opcional, para notificaciones)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=tu_email@gmail.com
EMAIL_PASS=tu_contraseña_de_aplicacion
EMAIL_FROM=tu_email@gmail.com

# Frontend
FRONTEND_URL=http://localhost:5173

# Servidor
PORT=3000
NODE_ENV=development
```

### 4. Aplicar migraciones
```sql
-- Ejecutar en PostgreSQL:
-- 1. migrations/create_calendar_events_table.sql
-- 2. migrations/alter_calendar_events_user_tracking.sql
```

### 5. Ejecutar el servidor
```bash
# Desarrollo
npm run dev

# Producción
npm start
```

---

## 📁 Estructura del Proyecto

```
PorcinoBackend/
├── src/
│   ├── app.js              # Aplicación principal
│   ├── config/
│   │   └── db.js           # Configuración de PostgreSQL
│   ├── controllers/        # Controladores de rutas
│   ├── models/             # Modelos de datos
│   ├── routes/             # Definición de rutas
│   ├── middleware/         # Middleware (auth, upload)
│   ├── jobs/               # Cron jobs (notificaciones)
│   └── utils/              # Utilidades (email, validaciones)
├── migrations/             # Scripts SQL de migración
├── package.json
└── README.md
```

---

## 🔧 Migraciones Importantes

### Tracking de Usuarios en Eventos
**Archivo:** `migrations/alter_calendar_events_user_tracking.sql`

Convierte `created_by` y `updated_by` a foreign keys:
```sql
-- Cambiar tipo a INTEGER
ALTER TABLE calendar_events 
  ALTER COLUMN created_by TYPE INTEGER USING created_by::INTEGER,
  ALTER COLUMN updated_by TYPE INTEGER USING updated_by::INTEGER;

-- Agregar foreign keys
ALTER TABLE calendar_events
  ADD CONSTRAINT fk_calendar_events_created_by 
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE calendar_events
  ADD CONSTRAINT fk_calendar_events_updated_by 
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
```

**⚠️ IMPORTANTE:** Si ya tienes datos, asegúrate que `created_by` y `updated_by` sean IDs numéricos o NULL.

---

## 📊 Endpoints Nuevos

### Cerdas Simplificadas
```http
GET /api/sows/simplified
Authorization: Bearer <token>

# Con filtros opcionales
GET /api/sows/simplified?status=activa&reproductive_status=gestante
```

**Respuesta:**
```json
{
  "success": true,
  "count": 45,
  "data": [
    {
      "id": 1,
      "ear_tag": "A001",
      "alias": "La Rubia",
      "breed": "Yorkshire",
      "reproductive_status": "gestante",
      "status": "activa"
    }
  ]
}
```

### Eventos del Calendario (mejorado)
```http
POST /api/calendar-events
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Vacunación cerda A001",
  "event_date": "2025-12-01T14:30:00",
  "event_type": "vaccination",
  "description": "Vacunación contra parvovirosis",
  "sow_id": 5
}
```

**Respuesta (incluye info del usuario y cerda):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "Vacunación cerda A001",
    "event_date": "2025-12-01T14:30:00",
    "created_by": 3,
    "created_by_email": "usuario@example.com",
    "created_by_name": "Juan Pérez",
    "sow_id": 5,
    "sow_ear_tag": "A001",
    "sow_alias": "La Rubia",
    "sow_breed": "Yorkshire",
    "sow_reproductive_status": "gestante"
  }
}
```

---

## 📧 Sistema de Notificaciones

### Cron Jobs Activos
- **Notificaciones de eventos:** Cada hora (0 * * * *)
- **Actualización estado de celos:** Diario a las 2 AM
- **Actualización estado de destetes:** Diario a las 3 AM

### Correos Automáticos
Los correos incluyen:
- 📅 Fecha del evento
- 🕐 Hora del evento (zona horaria Colombia)
- 📝 Descripción
- 👤 Usuario que creó el evento
- 🐷 Cerda asociada (si aplica)

**Zona horaria:** America/Bogota (UTC-5)

---

## 🔐 Autenticación

Todas las rutas (excepto login y registro) requieren token JWT:
```http
Authorization: Bearer <tu_token_jwt>
```

---

## 🐛 Troubleshooting

### Base de datos no conecta
```bash
# Verificar variables de entorno
echo $DATABASE_URL

# Probar conexión
node verify-setup.js
```

### Correos no se envían
1. Verifica que `EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASS` estén configurados
2. Para Gmail, necesitas "Contraseña de aplicación" (no tu contraseña normal)
3. Activa "Verificación en 2 pasos" en Gmail

### Migración falla
Si la migración de `created_by` falla:
```sql
-- Limpiar datos no numéricos antes de migrar
UPDATE calendar_events 
SET created_by = NULL 
WHERE created_by IS NOT NULL AND created_by !~ '^[0-9]+$';
```

---

## 📚 Documentación Completa

Ver `API_DOCUMENTATION.md` para documentación detallada de todos los endpoints.

---

## 🚀 Deploy en Railway

1. Conecta tu repositorio a Railway
2. Configura las variables de entorno
3. Railway detectará automáticamente el `Procfile`
4. Ejecuta las migraciones en la consola PostgreSQL de Railway

---

## 📞 Soporte

Para problemas o dudas, revisa:
- Logs del servidor: `npm run dev`
- Logs de Railway: Dashboard > Deployments > Logs
- Consola del navegador para errores de frontend

---

## ✨ Estado del Proyecto

- ✅ CRUD de cerdas, verracos, lechones
- ✅ Sistema de celos, servicios, gestaciones, partos
- ✅ Calendario de eventos con tracking de usuarios
- ✅ Asociación de eventos con animales
- ✅ Notificaciones automáticas por email
- ✅ Sistema de reportes y estadísticas
- ✅ Autenticación JWT
- ✅ Recuperación de contraseña

---

## 📝 Licencia

Proyecto privado - Todos los derechos reservados
