# Truco Argentino 🃏

Plataforma online del juego de cartas Truco argentino con partidas multijugador en tiempo real.

## Estructura del Proyecto

```
/
├── backend/          # FastAPI + Python
│   ├── server.py     # API principal
│   ├── requirements.txt
│   ├── railway.json  # Config Railway
│   └── .env.example
│
├── frontend/         # React + Tailwind
│   ├── src/
│   ├── package.json
│   ├── railway.json  # Config Railway
│   └── .env.example
│
└── README.md
```

## Características

- ✅ Registro/Login con JWT
- ✅ Sistema de Cashbank (depósitos/retiros)
- ✅ Mesas públicas y privadas (1v1, 2v2, 3v3)
- ✅ Sistema de Torneos
- ✅ Juego en tiempo real (WebSockets)
- ✅ Chat global y privado
- ✅ Panel de Administración

## Despliegue en Railway

### 1. Base de Datos (MongoDB)

Ya tenés MongoDB en Railway. Usá la URL pública para conectar.

### 2. Backend

1. Crear nuevo servicio desde GitHub
2. Root directory: `/backend`
3. Variables de entorno:
   ```
   MONGO_URL=tu_mongo_url
   DB_NAME=truco_argentino
   JWT_SECRET=genera_una_clave_segura
   CORS_ORIGINS=https://tu-frontend.railway.app
   ```

### 3. Frontend

1. Crear nuevo servicio desde GitHub
2. Root directory: `/frontend`
3. Variables de entorno:
   ```
   REACT_APP_BACKEND_URL=https://tu-backend.railway.app
   ```

## Admin por Defecto

- **Email**: admin@trucoargentino.com
- **Password**: admin123

## Tech Stack

- **Backend**: FastAPI, Python-SocketIO, Motor (MongoDB async)
- **Frontend**: React 19, Tailwind CSS, shadcn/ui, Framer Motion
- **Database**: MongoDB
- **Real-time**: Socket.IO

## Licencia

MIT
