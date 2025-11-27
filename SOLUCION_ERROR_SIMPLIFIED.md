# 🔧 Solución al Error "invalid input syntax for type integer: simplified"

## 📋 Descripción del Problema

**Error completo:**
```
Error al obtener cerda: error: invalid input syntax for type integer: "simplified"
at /app/src/models/sowModel.js:43:20
at async Object.getById
code: '22P02'
```

### ¿Qué significa?

El frontend está intentando acceder a `/api/sows/simplified` donde "simplified" NO es un ID válido (se esperaba un número entero).

---

## ✅ Soluciones Implementadas

### 1. Middleware de Validación de IDs

He creado un middleware que valida los IDs antes de que lleguen a la base de datos.

**Archivo:** `src/middleware/validateId.js`

Este middleware:
- ✅ Valida que el ID sea un número
- ✅ Valida que sea un entero positivo
- ✅ Da un error claro ANTES de consultar la base de datos
- ✅ Previene errores de PostgreSQL

**Aplicado en:** `src/routes/sowRoutes.js`
- Todas las rutas que usan `:id` como parámetro
- `GET /api/sows/:id`
- `PUT /api/sows/:id`
- `PATCH /api/sows/:id`
- `DELETE /api/sows/:id`
- etc.

### 2. Validación en el Controlador

Agregada validación adicional en `sowController.getById()`:

```javascript
if (isNaN(parseInt(id))) {
  console.error(`❌ ID inválido recibido: "${id}"`);
  return res.status(400).json({
    success: false,
    message: `ID inválido: "${id}". El ID debe ser un número.`
  });
}
```

---

## 🔍 ¿De Dónde Viene "simplified"?

El valor "simplified" probablemente viene de una de estas fuentes:

### Posibilidad 1: Query Parameter mal formado
```javascript
// ❌ MALO - puede pasar "simplified" como ID
`/api/sows/${params.view}`  // si params.view = "simplified"

// ✅ BUENO - usar query params
`/api/sows?view=simplified`
```

### Posibilidad 2: Configuración de vista/modo
Algún componente del frontend puede estar tratando de usar "simplified" como un modo de vista:

```javascript
// Buscar en el frontend:
- view="simplified"
- mode="simplified"  
- type="simplified"
```

### Posibilidad 3: Ruta mal configurada
Verificar que las rutas del frontend no estén pasando parámetros incorrectos.

---

## 🧪 Cómo Probar

### 1. Probar el endpoint con ID inválido:
```bash
curl -H "Authorization: Bearer TU_TOKEN" \
  https://tu-app.railway.app/api/sows/simplified
```

**Respuesta esperada (ANTES):**
```json
{
  "success": false,
  "message": "Error al obtener cerda",
  "error": "invalid input syntax for type integer: \"simplified\""
}
```

**Respuesta esperada (AHORA):**
```json
{
  "success": false,
  "message": "ID inválido: \"simplified\". El ID debe ser un número entero positivo."
}
```

### 2. Probar con ID válido:
```bash
curl -H "Authorization: Bearer TU_TOKEN" \
  https://tu-app.railway.app/api/sows/1
```

**Respuesta esperada:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "ear_tag": "...",
    ...
  }
}
```

---

## 🔄 Próximos Pasos

### Para el Usuario:

1. **Haz commit y push:**
```bash
git add .
git commit -m "fix: validación de IDs y mejora de manejo de errores"
git push
```

2. **Espera el redespliegue en Railway**

3. **Prueba el calendario:** 
   - Ahora debe mostrar un error más claro
   - En los logs de Railway verás: `❌ [validateId] ID inválido: "simplified"`

4. **Busca en el frontend** dónde se está generando la llamada:
   - Abre las Developer Tools del navegador (F12)
   - Ve a la pestaña "Network"
   - Filtra por "sows"
   - Busca la petición a `/api/sows/simplified`
   - Ve qué componente la está generando

### Para Debugging:

En el navegador, busca en el código fuente del frontend:
```javascript
// Patrón a buscar:
/api/sows/${algo_que_no_sea_numero}
```

Revisar especialmente:
- `CalendarPage.jsx` - componente del calendario
- `Dashboard.jsx` - página principal
- Cualquier componente que liste cerdas

---

## 📝 Archivos Modificados

1. **NUEVO:** `src/middleware/validateId.js` - Middleware de validación
2. **MODIFICADO:** `src/routes/sowRoutes.js` - Aplicado middleware
3. **MODIFICADO:** `src/controllers/sowController.js` - Validación adicional

---

## 💡 Recomendaciones

1. **Aplicar el mismo middleware a otras rutas:**
   - boarRoutes.js
   - pigletRoutes.js
   - pregnancyRoutes.js
   - etc.

2. **En el frontend**, usar siempre:
   ```javascript
   // ✅ BUENO
   if (id && !isNaN(parseInt(id))) {
     await sowService.getSowById(id);
   }
   
   // ❌ MALO
   await sowService.getSowById(someVariable); // sin validar
   ```

3. **TypeScript** ayudaría a prevenir estos errores en tiempo de desarrollo.

---

## 🎯 Resultado Esperado

Después de estos cambios:

✅ Errores de ID inválidos se capturan ANTES de llegar a la base de datos
✅ Mensajes de error claros y específicos
✅ Logs detallados para debugging
✅ Prevención de errores de PostgreSQL
✅ El calendario seguirá funcionando con IDs válidos

❌ Todavía necesitas identificar QUÉ está llamando a `/api/sows/simplified` en el frontend y corregirlo

