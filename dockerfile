# ETAPA 1: Construcción del Frontend (React + Vite)
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ETAPA 2: Configuración del Backend (Node + Express)
FROM node:18-alpine
WORKDIR /app
COPY backend/package*.json ./backend/
RUN cd backend && npm install

# Copiamos el código del backend
COPY backend/ ./backend/

# Traemos el frontend construido de la etapa anterior
# Esto lo pone en una carpeta que Express pueda servir
COPY --from=frontend-builder /app/frontend/dist ./backend/public

# Exponemos el puerto de tu servidor Node
EXPOSE 3000

WORKDIR /app/backend
CMD ["npm", "start"]