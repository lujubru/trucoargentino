# Truco Argentino - Product Requirements Document

## Problem Statement
Plataforma online del juego de cartas Truco argentino con partidas multijugador en tiempo real, sistema de billetera interna (cashbank), mesas públicas y privadas, y sistema de chat completo.

## User Personas
1. **Jugador Casual**: Quiere jugar Truco con amigos de forma remota
2. **Jugador Competitivo**: Busca apostar y ganar dinero real
3. **Administrador**: Gestiona la plataforma, aprueba depósitos/retiros y modera

## Core Requirements (Static)
- Registro/Login con JWT
- Sistema de Cashbank (depósitos con comprobante)
- Sistema de Retiros (solicitud, aprobación, descuento automático)
- Mesas públicas (creadas por admin) y privadas (creadas por usuarios)
- Sistema de Torneos con premios configurables
- Modalidades: 1v1, 2v2, 3v3
- Juego en tiempo real con WebSockets
- Chat global, privado y en partidas
- Chat privado con admin (soporte)
- Panel de administración completo

## What's Been Implemented

### MVP (March 2026)
- ✅ Landing page con estilo Neo-Noir Casino
- ✅ Sistema de autenticación JWT
- ✅ Dashboard de usuario con saldo y mesas
- ✅ Sistema de Cashbank (depósitos)
- ✅ Mesas públicas y privadas
- ✅ Mesa de juego Truco con cartas españolas
- ✅ Panel de administración básico
- ✅ WebSockets para tiempo real
- ✅ Base de datos MongoDB en Railway

### Iteración 2 (March 2026)
- ✅ Sistema de Retiros completo:
  - Usuario solicita retiro con alias y titular
  - Admin ve solicitudes pendientes
  - Al aprobar se descuenta automáticamente del saldo
- ✅ Sistema de Torneos:
  - Admin crea torneos con configuración (mesas, premios %)
  - Usuarios se inscriben/cancelan inscripción
  - Reembolso si cancelan antes de iniciar
  - Vista previa de premios (1°, 2° lugar)
- ✅ Auto-regeneración de mesas públicas cuando se llenan
- ✅ Chat privado con admin (cada usuario tiene su conversación)

## Prioritized Backlog

### P0 - Critical
- [ ] Lógica completa de torneos (brackets, rondas, final)
- [ ] Validación completa de reglas de Truco (Flor)
- [ ] Sistema de premios automáticos en torneos

### P1 - High Priority
- [ ] Abandono en torneos (lugar vacío)
- [ ] Notificaciones de depósito/retiro aprobado
- [ ] Historial detallado de partidas

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

## Credenciales Admin
- Email: admin@trucoargentino.com
- Password: admin123

## Next Tasks
1. Implementar lógica completa de brackets de torneos
2. Mejorar validación de reglas del Truco (Flor)
3. Notificaciones push de aprobación
4. Sistema de abandono en torneos
