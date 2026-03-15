# Truco Argentino - Product Requirements Document

## Problem Statement
Plataforma online del juego de cartas Truco argentino con partidas multijugador en tiempo real, sistema de billetera interna (cashbank), mesas públicas y privadas, y sistema de chat completo.

## User Personas
1. **Jugador Casual**: Quiere jugar Truco con amigos de forma remota
2. **Jugador Competitivo**: Busca apostar y ganar dinero real
3. **Administrador**: Gestiona la plataforma, aprueba depósitos y modera

## Core Requirements (Static)
- Registro/Login con JWT
- Sistema de Cashbank (depósitos con comprobante)
- Mesas públicas (creadas por admin) y privadas (creadas por usuarios)
- Modalidades: 1v1, 2v2, 3v3
- Juego en tiempo real con WebSockets
- Chat global, privado y en partidas
- Panel de administración completo

## What's Been Implemented (MVP - March 2026)
- ✅ Landing page con estilo Neo-Noir Casino
- ✅ Sistema de autenticación JWT (registro/login)
- ✅ Dashboard de usuario con saldo y mesas
- ✅ Sistema de Cashbank completo:
  - Solicitar depósitos
  - Subir comprobante
  - Admin aprueba/rechaza
  - Datos de transferencia configurables
- ✅ Mesas públicas y privadas
  - Crear mesa privada con código
  - Compartir por WhatsApp
  - Unirse con código
- ✅ Mesa de juego Truco:
  - Cartas españolas visuales
  - Sistema de turnos
  - Cantos: Envido, Truco, Retruco, Vale 4
  - Puntaje en tiempo real
- ✅ Panel de administración:
  - Gestión de depósitos
  - Gestión de usuarios
  - Configuración de economía
  - Ver mesas y partidas
- ✅ WebSockets para tiempo real
- ✅ Base de datos MongoDB en Railway

## Prioritized Backlog

### P0 - Critical
- [ ] Sistema de retiros de dinero
- [ ] Validación completa de reglas de Truco
- [ ] Flor functionality

### P1 - High Priority
- [ ] Chat privado entre usuarios
- [ ] Chat con administrador
- [ ] Historial detallado de partidas
- [ ] Notificaciones de depósito aprobado

### P2 - Medium Priority
- [ ] Estadísticas de jugador
- [ ] Rankings/Leaderboard
- [ ] Animaciones de cartas mejoradas
- [ ] Sonidos del juego

## Tech Stack
- **Frontend**: React 19, Tailwind CSS, shadcn/ui, Framer Motion, Socket.IO Client
- **Backend**: FastAPI, Python-SocketIO, Motor (async MongoDB), PyJWT
- **Database**: MongoDB (Railway)
- **Real-time**: WebSockets via Socket.IO

## Next Tasks
1. Implementar sistema de retiros
2. Mejorar validación de reglas del Truco
3. Chat completo (privado + admin)
4. Animaciones y feedback visual mejorado
