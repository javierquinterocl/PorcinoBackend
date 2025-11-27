# 🐷 Porcime - Backend API

Backend para gestión integral de porcicultura desarrollado con Express.js, Node.js y PostgreSQL.

## 📋 Características

- ✅ Autenticación JWT con roles (admin, técnico, usuario)
- ✅ Recuperación de contraseña por email
- ✅ CRUD completo de cerdas con validaciones
- ✅ Gestión de usuarios con encriptación de contraseñas
- ✅ Filtros avanzados para consultas
- ✅ Estadísticas y reportes
- ✅ Protección de rutas con middleware
- ✅ Manejo de errores robusto

## 🛠️ Tecnologías

- **Node.js** - Runtime de JavaScript
- **Express** - Framework web
- **PostgreSQL** - Base de datos relacional
- **JWT** - Autenticación basada en tokens
- **Bcrypt** - Encriptación de contraseñas
- **Nodemailer** - Envío de emails (recuperación de contraseña)
- **dotenv** - Variables de entorno
- **CORS** - Manejo de políticas de origen cruzado

## � Estructura del Proyecto

```
backend/
├── src/
│   ├── config/
│   │   └── db.js                 # Conexión a PostgreSQL
│   ├── middleware/
│   │   └── authMiddleware.js     # Autenticación JWT y roles
│   ├── models/
│   │   ├── userModel.js          # Modelo de usuarios
│   │   └── sowModel.js           # Modelo de cerdas
│   ├── controllers/
│   │   ├── userController.js     # Lógica de usuarios
│   │   └── sowController.js      # Lógica de cerdas
│   ├── routes/
│   │   ├── userRoutes.js         # Rutas de usuarios
│   │   └── sowRoutes.js          # Rutas de cerdas
│   └── app.js                    # Aplicación Express
├── .env                          # Variables de entorno
├── .gitignore
├── database.sql                  # Script para crear BD
├── API_DOCUMENTATION.md          # Documentación completa de API
├── package.json
└── README.md
```

## 🚀 Instalación y Configuración

### 1. Clonar o descargar el proyecto

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar PostgreSQL

Crear la base de datos ejecutando el script:
```bash
psql -U postgres
```

Luego ejecutar:
```bash
\i database.sql
```

O copiar el contenido de `database.sql` y ejecutarlo en tu cliente de PostgreSQL.

### 4. Configurar variables de entorno

Editar el archivo `.env` con tus credenciales:

```env
# Base de datos
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=tu_password
DB_NAME=porcime

# Servidor
PORT=3000
NODE_ENV=development

# JWT
JWT_SECRET=tu_clave_secreta_muy_segura_cambiar_en_produccion
JWT_EXPIRES_IN=7d

# Email (Recuperación de contraseña)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=tu_correo@gmail.com
EMAIL_PASS=tu_password_de_aplicacion
EMAIL_FROM="Sistema Granme <tu_correo@gmail.com>"
FRONTEND_URL=http://localhost:5173
```

⚠️ **IMPORTANTE**: 
- Cambiar `JWT_SECRET` en producción por una clave segura
- Para Gmail, crear un "App Password" en: https://myaccount.google.com/apppasswords
- Si no configuras EMAIL, la funcionalidad estará disponible pero mostrará el token en consola (modo desarrollo)

Ver `.env.example` para más detalles de configuración.

### 5. Iniciar el servidor

**Modo desarrollo** (con auto-reinicio):
```bash
npm run dev
```

**Modo producción**:
```bash
npm start
```

El servidor estará corriendo en: `http://localhost:3000`

## 📡 API Endpoints

### Autenticación
- `POST /api/auth/register` - Registrar usuario
- `POST /api/auth/login` - Iniciar sesión
- `GET /api/auth/me` - Obtener usuario actual (requiere token)
- `POST /api/auth/forgot-password` - Solicitar recuperación de contraseña
- `POST /api/auth/validate-reset-token` - Validar token de recuperación
- `POST /api/auth/reset-password` - Resetear contraseña con token

### Usuarios (Admin)
- `GET /api/users` - Listar todos los usuarios
- `GET /api/users/:id` - Obtener usuario por ID
- `PUT /api/users/:id` - Actualizar usuario
- `PUT /api/users/:id/password` - Cambiar contraseña
- `DELETE /api/users/:id` - Desactivar usuario
- `DELETE /api/users/:id/permanent` - Eliminar permanentemente

### Cerdas
- `GET /api/sows` - Listar todas las cerdas (con filtros)
- `GET /api/sows/stats` - Obtener estadísticas
- `GET /api/sows/:id` - Obtener cerda por ID
- `GET /api/sows/ear-tag/:ear_tag` - Buscar por arete
- `POST /api/sows` - Crear nueva cerda (admin/técnico)
- `PUT /api/sows/:id` - Actualizar cerda completa (admin/técnico)
- `PATCH /api/sows/:id` - Actualizar campos específicos (admin/técnico)
- `DELETE /api/sows/:id` - Descartar cerda (admin/técnico)
- `DELETE /api/sows/:id/permanent` - Eliminar permanentemente (admin)

Ver documentación completa en: **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)**

## 🔐 Autenticación

Todas las rutas (excepto registro y login) requieren autenticación JWT.

**Header requerido:**
```
Authorization: Bearer <tu_token_jwt>
```

### Ejemplo de Login
```javascript
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@porcime.com",
  "password": "admin123"
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Inicio de sesión exitoso",
  "data": {
    "user": { ... },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

## � Roles y Permisos

### Admin
- Acceso completo a todas las funcionalidades
- Gestión de usuarios
- Eliminación permanente de registros

### Técnico
- CRUD completo de cerdas
- Consulta de estadísticas
- No puede gestionar usuarios

### Usuario
- Solo lectura de cerdas
- Consulta de estadísticas
- No puede modificar datos

## 📊 Modelo de Datos

### Usuario
```javascript
{
  id: UUID,
  first_name: String,
  last_name: String,
  phone: String,
  email: String (único),
  password_hash: String,
  role: 'admin' | 'tecnico' | 'usuario',
  is_active: Boolean,
  created_at: Timestamp,
  updated_at: Timestamp
}
```

### Cerda (Sow)
```javascript
{
  id: UUID,
  ear_tag: String (único),
  id_type: 'arete' | 'tatuaje' | 'rfid' | 'crotal',
  alias: String,
  breed: String,
  genetic_line: String,
  birth_date: Date,
  entry_date: Date,
  origin: String,
  status: 'activa' | 'descartada' | 'muerta' | 'vendida',
  location: String,
  farm_name: String,
  current_weight: Number,
  body_condition: Number (1-5),
  parity_count: Number,
  total_piglets_born: Number,
  total_piglets_alive: Number,
  reproductive_status: String,
  // ... más campos
}
```

## 🧪 Testing con Frontend (React)

### Configuración de Axios
```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
});

// Interceptor para añadir token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
```

### Ejemplo de uso
```javascript
// Login
const login = async () => {
  const { data } = await api.post('/auth/login', {
    email: 'admin@porcime.com',
    password: 'admin123'
  });
  localStorage.setItem('token', data.data.token);
};

// Obtener cerdas
const getSows = async () => {
  const { data } = await api.get('/sows?status=activa');
  console.log(data.data);
};

// Crear cerda
const createSow = async () => {
  const { data } = await api.post('/sows', {
    ear_tag: 'A001',
    id_type: 'arete',
    breed: 'Yorkshire',
    birth_date: '2023-01-15',
    entry_date: '2023-03-01',
    farm_name: 'Granja Principal',
    current_weight: 180.5,
    body_condition: 3.5
  });
  return data.data;
};
```

## 🗄️ Base de Datos

### Crear tablas
```bash
psql -U postgres -d porcime -f database.sql
```

### Ejecutar migraciones
```bash
# Crear tabla de tokens de recuperación de contraseña
psql -U postgres -d porcime -f migrations/create_password_reset_tokens.sql
```

### Usuario por defecto
- **Email**: admin@porcime.com
- **Contraseña**: admin123
- **Rol**: admin

⚠️ **Cambiar contraseña después del primer login en producción**

## 📝 Scripts NPM

```bash
npm start       # Iniciar en modo producción
npm run dev     # Iniciar en modo desarrollo con nodemon
```

## 🐛 Solución de Problemas

### Error de conexión a PostgreSQL
- Verificar que PostgreSQL esté corriendo
- Revisar credenciales en `.env`
- Verificar que la base de datos `porcime` exista

### Error "Token inválido"
- Verificar que el token no haya expirado
- Asegurarse de incluir "Bearer " antes del token
- Verificar que `JWT_SECRET` sea el correcto

### Error "Cerda con arete duplicado"
- El `ear_tag` debe ser único
- Verificar que no exista en la base de datos

## 🔒 Seguridad

- Contraseñas encriptadas con bcrypt (10 rounds)
- Tokens JWT con expiración configurable
- Tokens de recuperación de contraseña con expiración de 1 hora
- Validación de roles en rutas protegidas
- Validación de datos en base de datos con constraints
- Variables de entorno para datos sensibles
- Emails de notificación para cambios de contraseña

## 📄 Licencia

ISC

## 👨‍💻 Autor

Desarrollado para la gestión de porcicultura - Porcime

---

**Última actualización**: Noviembre 2025
