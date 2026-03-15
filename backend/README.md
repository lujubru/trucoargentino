# Truco Argentino - Backend API

## Despliegue en Railway

### Variables de Entorno Requeridas

```
MONGO_URL=mongodb://usuario:password@host:puerto
DB_NAME=truco_argentino
JWT_SECRET=tu_clave_secreta_aqui
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
CORS_ORIGINS=https://tu-frontend.railway.app
```

### Comandos

- **Build**: `pip install -r requirements.txt`
- **Start**: `uvicorn server:app --host 0.0.0.0 --port $PORT`

### Health Check

- **Endpoint**: `/api/health`

### Admin por defecto

Al iniciar por primera vez se crea:
- **Email**: admin@trucoargentino.com
- **Password**: admin123

⚠️ **IMPORTANTE**: Cambiá la contraseña del admin en producción.
