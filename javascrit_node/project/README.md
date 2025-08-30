# Sistema de Importaciones - Microservicios

Sistema completo de gestión de importaciones desarrollado con arquitectura de microservicios, equivalent a Spring Boot pero implementado en Node.js.

## 🏗️ Arquitectura

El sistema está compuesto por:

- **Gateway (Puerto 3000)**: Punto de entrada único, maneja el routing hacia los microservicios
- **Users Service (Puerto 3003)**: Gestión de usuarios y autenticación
- **Products Service (Puerto 3001)**: Gestión de productos y proveedores
- **Imports Service (Puerto 3002)**: Gestión de importaciones y estadísticas

## 🚀 Instalación y Configuración

### 1. Instalar dependencias
```bash
npm install
```

### 2. Inicializar base de datos
```bash
npm run init-db
```

### 3. Configurar variables de entorno
Copia el archivo `.env` y personaliza los valores según tu configuración.

### 4. Ejecutar el sistema
```bash
# Ejecutar todos los servicios
npm run dev

# O ejecutar servicios individuales
npm run start:users     # Servicio de usuarios
npm run start:products  # Servicio de productos  
npm run start:imports   # Servicio de importaciones
npm start               # Gateway
```

## 📊 Base de Datos

El sistema utiliza SQLite con las siguientes tablas:

- **users**: Usuarios del sistema con roles
- **suppliers**: Proveedores internacionales
- **products**: Catálogo de productos con códigos HS
- **imports**: Órdenes de importación
- **import_items**: Detalle de productos por importación

### Usuarios por defecto:
- **Admin**: `admin@imports.com` / `admin123`
- **Usuario**: `importer1@company.com` / `user123`

## 🔧 Testing con Postman

### 1. Importar la colección
- Abre Postman
- Importa el archivo `postman/Importaciones_Microservices.postman_collection.json`

### 2. Flujo de testing recomendado:

1. **Health Check**: Verificar que todos los servicios estén funcionando
   ```
   GET /health
   ```

2. **Autenticación**: Hacer login para obtener el token
   ```
   POST /api/users/login
   {
     "email": "admin@imports.com", 
     "password": "admin123"
   }
   ```

3. **Gestión de Productos**: Listar y crear productos
   ```
   GET /api/products
   POST /api/products
   ```

4. **Crear Importación**: Procesar una orden de importación
   ```
   POST /api/imports
   {
     "supplier_id": 1,
     "import_date": "2025-01-15",
     "items": [...]
   }
   ```

5. **Seguimiento**: Actualizar estados y obtener estadísticas
   ```
   PUT /api/imports/1/status
   GET /api/imports/stats/dashboard
   ```

## 🌐 Endpoints Principales

### Autenticación
- `POST /api/users/register` - Registrar usuario
- `POST /api/users/login` - Iniciar sesión
- `GET /api/users/profile/:id` - Obtener perfil

### Productos y Proveedores
- `GET /api/products` - Listar productos (con filtros)
- `POST /api/products` - Crear producto
- `PUT /api/products/:id` - Actualizar producto
- `GET /api/suppliers` - Listar proveedores
- `POST /api/suppliers` - Crear proveedor

### Importaciones
- `GET /api/imports` - Listar importaciones
- `POST /api/imports` - Crear nueva importación
- `GET /api/imports/:id` - Detalle de importación
- `PUT /api/imports/:id/status` - Actualizar estado (solo admin)
- `GET /api/imports/stats/dashboard` - Estadísticas del dashboard

## 🔐 Autenticación

El sistema utiliza JWT (JSON Web Tokens) para la autenticación. Después del login exitoso:

1. Guardar el token recibido
2. Incluir en las requests como: `Authorization: Bearer <token>`
3. El token expira en 24 horas

## 🏷️ Estados de Importación

- `pending` - Pendiente de procesamiento
- `processing` - En procesamiento
- `shipped` - Enviado
- `in_transit` - En tránsito
- `customs` - En aduana
- `delivered` - Entregado
- `cancelled` - Cancelado

## 📈 Equivalencias con Spring Boot

Esta implementación replica conceptos clave de Spring Boot:

- **Controllers** → Express routers
- **Services** → Módulos de lógica de negocio
- **Repositories** → Funciones de acceso a datos
- **Security** → Middleware de autenticación JWT
- **Configuration** → Variables de entorno
- **Microservices** → Servicios independientes con comunicación HTTP

## 🛠️ Desarrollo

Para añadir nuevas funcionalidades:

1. Crear nuevos endpoints en el servicio correspondiente
2. Añadir validación con Joi
3. Implementar la lógica en la capa de servicio
4. Actualizar las rutas del gateway si es necesario
5. Añadir tests en Postman

## 📝 Logs

El sistema incluye logging con Morgan que registra:
- Requests HTTP entrantes
- Respuestas y códigos de estado
- Errores y excepciones
- Performance de endpoints