# Truco Argentino - Frontend

## Despliegue en Railway

### Variables de Entorno Requeridas

```
REACT_APP_BACKEND_URL=https://tu-backend.railway.app
```

⚠️ **IMPORTANTE**: La variable debe configurarse ANTES del build porque React la embebe en el bundle.

### Comandos

- **Build**: `yarn install && yarn build`
- **Start**: `npx serve -s build -l $PORT`

### Configuración en Railway

1. Conectá tu repo de GitHub
2. Seleccioná el directorio `/frontend` como root
3. Configurá la variable `REACT_APP_BACKEND_URL`
4. Railway detectará automáticamente que es un proyecto Node.js

### Build Output

El build genera la carpeta `build/` con los archivos estáticos optimizados.
