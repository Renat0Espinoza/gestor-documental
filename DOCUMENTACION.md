# Documentación del Proyecto: Gestor Documental

Este documento describe la arquitectura técnica, las tecnologías implementadas, la integración de base de datos y la infraestructura (DevOps/CI-CD) del Sistema de Gestión Documental.

---

## 1. Arquitectura General
El proyecto sigue una estructura desacoplada que se distribuye de la siguiente manera:
- **Frontend**: Una SPA (Single Page Application) reactiva que gestiona la lógica de la interfaz de usuario, autenticación directa con Firebase y llamadas a la API del servidor.
- **Backend (API + Servidor de Estáticos)**: Un servidor web monolítico ligero que se encarga del almacenamiento físico de los archivos subidos, la integración con la API de GitHub, la gestión del flujo de requerimientos y de servir la aplicación del frontend en producción.

---

## 2. Frontend (Cliente)
El frontend se construyó enfocado en ofrecer una experiencia de usuario fuida, interactiva y con una estética premium oscura y de estilo glassmorphism.

### Tecnologías Clave:
- **Framework**: **React 18** + **Vite** como empaquetador ultrarrápido.
- **Lenguaje**: **TypeScript** para asegurar tipado estático robusto y prevenir errores en tiempo de desarrollo.
- **Iconografía**: **Lucide React** para un set de iconos vectoriales uniforme y moderno.
- **Estilos**: **CSS Vanilla** estructurado meticulosamente mediante variables CSS globales (tokens de diseño para colores, desenfoques, bordes, radios y sombras).

### Características Destacadas de la UI:
- **Diseño Glassmorphism**: Uso extendido de fondos semitransparentes con desenfoque (`backdrop-filter`) y sombras con gradientes.
- **Barra Lateral Contextual (Sidebar)**: Sistema de navegación dinámico que se oculta en la pantalla de inicio (Dashboard) y se muestra en todas las subpáginas. Incluye diseño colapsable responsive para móviles (menú hamburguesa ☰) con entrada animada.
- **Previsualizador de PDF**: Modal integrado que renderiza los documentos PDF directamente en pantalla mediante un iframe con flujo inline desde el backend.
- **Gestión Lote (Multi-selección)**: Soporte para seleccionar múltiples archivos de forma masiva para:
  - Descargar en cola (con retraso temporal preventivo para evitar bloqueos del navegador).
  - Enviar en lote a la papelera.
  - Restaurar en lote.
  - Eliminar permanentemente (lote completo de una vez).

---

## 3. Backend (Servidor API)
El backend actúa como un servicio API que maneja las acciones físicas de archivos e integraciones externas.

### Tecnologías Clave:
- **Entorno**: **Node.js** con soporte para módulos ES6 nativos.
- **Framework**: **Express.js** para el enrutamiento de peticiones HTTP.
- **Carga de Archivos**: **Multer** configurado en `/backend/config/multer.js` para procesar la subida física de documentos en disco.
- **Seguridad**: Prevención de ataques de *path traversal* (acceso no autorizado a directorios padre) en la descarga y eliminación de archivos.

### Módulos y Rutas:
- **`fileRoutes`**: 
  - Listar archivos físicos con metadatos de tamaño y modificación (`/api/files`).
  - Subida de archivos (`/api/upload`).
  - Descarga y previsualización inline (`/api/files/:filename?preview=true`).
  - Búsqueda física (`/api/search`).
  - Eliminación en disco (`/api/files/:filename`).
- **`requirementsRoutes`**: Gestión de requerimientos y comentarios de proyectos.
- **`githubRoutes`**: Enlace al estado del pipeline de integración continua.

---

## 4. Base de Datos e Integraciones (Firebase)
El sistema utiliza **Google Firebase** para delegar la autenticación de usuarios y gestionar la base de datos no relacional de metadatos en tiempo real.

### Servicios Utilizados:
- **Firebase Authentication**: Inicio de sesión seguro, validación de contraseñas, reautenticación para cambios de perfil de seguridad y actualizaciones de datos en el cliente.
- **Cloud Firestore**:
  - **`users`**: Almacena información de los usuarios (nombre, teléfono, correo, estado activo/inactivo, rol y registro de perfil completo).
  - **`documentos`**: Asocia los archivos físicos guardados en el disco del backend con metadatos clave (nombre original, proyecto asociado, autor, fecha y estado de papelera).
  - **`categorias` / `subcategorias`**: Clasificación taxonómica de proyectos.
  - **`proyectos` / `areas`**: Estructuras organizacionales de equipos de trabajo que definen qué áreas (y por ende qué usuarios) tienen acceso a qué documentos.
  - **`auditoria`**: Colección para el registro de eventos y logs del sistema (quién subió, descargó, eliminó o restauró cada archivo, para cumplimiento de normas de auditoría).

---

## 5. DevOps, Docker y CI/CD
El proyecto está completamente preparado para la contenedorización y despliegue automatizado.

### Containerización (Docker):
Se utiliza una **construcción multietapa (Multi-stage build)** optimizada en el `dockerfile`:
1. **Etapa de Construcción**: Compila la aplicación frontend de React a archivos estáticos de distribución en `/app/frontend/dist` usando Node 18.
2. **Etapa de Ejecución**: Inicializa un contenedor basado en Node 18 alpine que copia los estáticos del frontend en la carpeta pública del servidor Express (`/backend/public`), instala las dependencias de producción de Node y arranca el backend.
3. **Persistencia**: Se declara un **volumen** en `/app/backend/uploads` para evitar que los archivos PDF subidos por los usuarios se pierdan al reiniciar o actualizar el contenedor Docker.

### Pipeline de Integración Continua (Jenkins):
El archivo `Jenkinsfile` automatiza la compilación del contenedor Docker y su despliegue directo en el host:
- Construye la imagen Docker (`docker build -t mi-gestor-app:latest .`).
- Limpia los contenedores existentes.
- Inicia el contenedor exponiendo el puerto `3000` y configurando las variables de entorno de producción de Firebase/GitHub a través de un archivo `.env` (`--env-file .env`).
