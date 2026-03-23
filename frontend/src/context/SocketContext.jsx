import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

const SOCKET_URL = process.env.REACT_APP_BACKEND_URL;

export const SocketProvider = ({ children }) => {
  const { token, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    const newSocket = io(SOCKET_URL, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    newSocket.on('connect', () => {
      console.log('Socket connected');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [isAuthenticated, token]);

  const joinTable = useCallback((tableId) => {
    if (socket && connected) {
      socket.emit('join_table_room', { table_id: tableId });
    }
  }, [socket, connected]);

  const leaveTable = useCallback((tableId) => {
    if (socket && connected) {
      socket.emit('leave_table_room', { table_id: tableId });
    }
  }, [socket, connected]);

  const playCard = useCallback((gameId, cardIndex) => {
    if (socket && connected) {
      return new Promise((resolve) => {
        socket.emit('play_card', { game_id: gameId, card_index: cardIndex }, resolve);
      });
    }
    return Promise.reject('Not connected');
  }, [socket, connected]);

  const callTruco = useCallback((gameId, callType) => {
    if (socket && connected) {
      return new Promise((resolve) => {
        socket.emit('call_truco', { game_id: gameId, call_type: callType }, resolve);
      });
    }
    return Promise.reject('Not connected');
  }, [socket, connected]);

  const respondTruco = useCallback((gameId, response) => {
    if (socket && connected) {
      return new Promise((resolve) => {
        socket.emit('respond_truco', { game_id: gameId, response }, resolve);
      });
    }
    return Promise.reject('Not connected');
  }, [socket, connected]);

  const callEnvido = useCallback((gameId, callType) => {
    if (socket && connected) {
      return new Promise((resolve) => {
        socket.emit('call_envido', { game_id: gameId, call_type: callType }, resolve);
      });
    }
    return Promise.reject('Not connected');
  }, [socket, connected]);

  const respondEnvido = useCallback((gameId, response) => {
    if (socket && connected) {
      return new Promise((resolve) => {
        socket.emit('respond_envido', { game_id: gameId, response }, resolve);
      });
    }
    return Promise.reject('Not connected');
  }, [socket, connected]);

  const callFlor = useCallback((gameId) => {
    if (socket && connected) {
      return new Promise((resolve) => {
        socket.emit('call_flor', { game_id: gameId }, resolve);
      });
    }
    return Promise.reject('Not connected');
  }, [socket, connected]);

  const irseAlMazo = useCallback((gameId) => {
    if (socket && connected) {
      return new Promise((resolve) => {
        socket.emit('irse_al_mazo', { game_id: gameId }, resolve);
      });
    }
    return Promise.reject('Not connected');
  }, [socket, connected]);

  const sendTableChat = useCallback((tableId, message, isTeamOnly = false) => {
    if (socket && connected) {
      socket.emit('table_chat', { table_id: tableId, message, is_team_only: isTeamOnly });
    }
  }, [socket, connected]);

  return (
    <SocketContext.Provider value={{
      socket,
      connected,
      joinTable,
      leaveTable,
      playCard,
      callTruco,
      respondTruco,
      callEnvido,
      respondEnvido,
      callFlor,
      irseAlMazo,
      sendTableChat
    }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
