import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, MessageCircle, Users, Trophy, Send, X
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ScrollArea } from '../components/ui/scroll-area';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { toast } from 'sonner';
import PlayingCard from '../components/PlayingCard';

const GameTable = () => {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const { api, user } = useAuth();
  const { 
    socket, joinTable, leaveTable, playCard, 
    callTruco, respondTruco, callEnvido, respondEnvido, callFlor,
    irseAlMazo, sendTableChat 
  } = useSocket();
  
  const [game, setGame] = useState(null);
  const [table, setTable] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [waitingForResponse, setWaitingForResponse] = useState(null);
  const [notification, setNotification] = useState(null);

  const fetchGameData = useCallback(async () => {
    try {
      const [tableRes] = await Promise.all([
        api.get(`/tables/${tableId}`)
      ]);
      setTable(tableRes.data);

      if (tableRes.data.status === 'playing' || tableRes.data.status === 'finished') {
        try {
          const gameRes = await api.get(`/games/table/${tableId}`);
          setGame(gameRes.data);
        } catch (err) {
          console.error('Error fetching game data:', err);
        }
      }
    } catch (error) {
      console.error('Error fetching game:', error);
      toast.error('Error al cargar la partida');
    } finally {
      setLoading(false);
    }
  }, [api, tableId]);

  useEffect(() => {
    fetchGameData();
    joinTable(tableId);
    return () => { leaveTable(tableId); };
  }, [tableId, fetchGameData, joinTable, leaveTable]);

  const handleGameUpdate = useCallback(async () => {
    try {
      const gameRes = await api.get(`/games/table/${tableId}`);
      setGame(gameRes.data);
      setWaitingForResponse(null);
    } catch (error) {
      console.error('Error updating game:', error);
    }
  }, [api, tableId]);

  const handleGameStarted = useCallback(() => {
    showNotif('¡La partida comenzó!', 'success');
    fetchGameData();
  }, [fetchGameData]);

  const handleGameFinished = useCallback((data) => {
    // Update game state immediately with winner_team from socket event
    setGame(prev => prev ? { ...prev, status: 'finished', winner_team: data.winner_team, team1_score: data.team1_score, team2_score: data.team2_score } : prev);
    
    const myTeam = game?.players?.find(p => p.id === user?.id)?.team;
    if (data.winner_team === myTeam) {
      showNotif(`¡Ganaste! Premio: $${data.prize_per_winner?.toFixed(0) || 0}`, 'success');
    } else {
      showNotif('Perdiste la partida', 'error');
    }
    // Also fetch fresh data from server
    setTimeout(() => fetchGameData(), 500);
  }, [game, user, fetchGameData]);

  const handleTrucoCalled = useCallback((data) => {
    const myTeam = game?.players?.find(p => p.id === user?.id)?.team;
    if (data.caller_team !== myTeam) {
      setWaitingForResponse({ type: 'truco', call: data.call_type, points: data.points });
    }
    showNotif(`¡${data.caller_username}: ${data.call_type.replace('_', ' ').toUpperCase()}!`, 'truco');
  }, [game, user]);

  const handleTrucoResponse = useCallback((data) => {
    setWaitingForResponse(null);
    if (data.response === 'quiero') {
      showNotif(`¡QUIERO! (${data.current_points} pts en juego)`, 'success');
    } else {
      showNotif(`No quiero... +${data.points_awarded} pts`, 'info');
    }
    if (data.game_finished) fetchGameData();
    else handleGameUpdate();
  }, [handleGameUpdate, fetchGameData]);

  const handleEnvidoCalled = useCallback((data) => {
    const myTeam = game?.players?.find(p => p.id === user?.id)?.team;
    if (data.caller_team !== myTeam) {
      setWaitingForResponse({ type: 'envido', call: data.call_type, points: data.total_points });
    }
    showNotif(`¡${data.caller_username}: ${data.call_type.replace('_', ' ').toUpperCase()}!`, 'envido');
  }, [game, user]);

  const handleEnvidoResponse = useCallback((data) => {
    setWaitingForResponse(null);
    if (data.response === 'quiero') {
      showNotif(`Envido: ${data.team1_envido} vs ${data.team2_envido}. +${data.points_awarded} pts`, 'success');
    } else {
      showNotif(`No quiero... +${data.points_awarded} pts`, 'info');
    }
    if (data.game_finished) fetchGameData();
    else handleGameUpdate();
  }, [handleGameUpdate, fetchGameData]);

  const handleFlorCalled = useCallback((data) => {
    showNotif(`¡FLOR! ${data.caller_username} (+3 pts)`, 'success');
    if (data.game_finished) fetchGameData();
    else handleGameUpdate();
  }, [handleGameUpdate, fetchGameData]);

  const handleMazo = useCallback((data) => {
    showNotif(`${data.player_username} se fue al mazo. +${data.points_awarded} pts equipo ${data.winner_team}`, 'info');
    if (data.game_finished) {
      setGame(prev => prev ? { ...prev, status: 'finished', winner_team: data.winner_team } : prev);
      setTimeout(() => fetchGameData(), 500);
    } else {
      handleGameUpdate();
    }
  }, [handleGameUpdate, fetchGameData]);

  const handleTableChat = useCallback((msg) => {
    setChatMessages(prev => [...prev, msg]);
  }, []);

  const showNotif = (msg, type) => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    if (!socket) return;
    socket.on('game_update', handleGameUpdate);
    socket.on('game_started', handleGameStarted);
    socket.on('game_finished', handleGameFinished);
    socket.on('truco_called', handleTrucoCalled);
    socket.on('truco_response', handleTrucoResponse);
    socket.on('envido_called', handleEnvidoCalled);
    socket.on('envido_response', handleEnvidoResponse);
    socket.on('flor_called', handleFlorCalled);
    socket.on('mazo', handleMazo);
    socket.on('table_chat', handleTableChat);

    return () => {
      socket.off('game_update', handleGameUpdate);
      socket.off('game_started', handleGameStarted);
      socket.off('game_finished', handleGameFinished);
      socket.off('truco_called', handleTrucoCalled);
      socket.off('truco_response', handleTrucoResponse);
      socket.off('envido_called', handleEnvidoCalled);
      socket.off('envido_response', handleEnvidoResponse);
      socket.off('flor_called', handleFlorCalled);
      socket.off('mazo', handleMazo);
      socket.off('table_chat', handleTableChat);
    };
  }, [socket, handleGameUpdate, handleGameStarted, handleGameFinished, handleTrucoCalled, handleTrucoResponse, handleEnvidoCalled, handleEnvidoResponse, handleFlorCalled, handleMazo, handleTableChat]);

  // Actions
  const handlePlayCard = async (cardIndex) => {
    if (!isMyTurn || !game) return;
    try {
      const result = await playCard(game.id, cardIndex);
      if (result?.error) toast.error(result.error);
      setSelectedCard(null);
    } catch (error) {
      toast.error('Error al jugar carta');
    }
  };

  const handleCallTruco = async (callType) => {
    try {
      const result = await callTruco(game.id, callType);
      if (result?.error) toast.error(result.error);
    } catch (error) {
      toast.error('Error al cantar truco');
    }
  };

  const handleRespondTruco = async (response) => {
    try {
      await respondTruco(game.id, response);
      setWaitingForResponse(null);
    } catch (error) {
      toast.error('Error al responder');
    }
  };

  const handleCallEnvido = async (callType) => {
    try {
      const result = await callEnvido(game.id, callType);
      if (result?.error) toast.error(result.error);
    } catch (error) {
      toast.error('Error al cantar envido');
    }
  };

  const handleRespondEnvido = async (response) => {
    try {
      await respondEnvido(game.id, response);
      setWaitingForResponse(null);
    } catch (error) {
      toast.error('Error al responder envido');
    }
  };

  const handleCallFlor = async () => {
    try {
      const result = await callFlor(game.id);
      if (result?.error) toast.error(result.error);
    } catch (error) {
      toast.error('Error al cantar flor');
    }
  };

  const handleIrseAlMazo = async () => {
    try {
      const result = await irseAlMazo(game.id);
      if (result?.error) toast.error(result.error);
    } catch (error) {
      toast.error('Error al irse al mazo');
    }
  };

  const handleSendChat = () => {
    if (!newMessage.trim()) return;
    sendTableChat(tableId, newMessage, false);
    setNewMessage('');
  };

  // Game state calculations
  const isMyTurn = game?.current_turn === user?.id;
  const myHand = game?.players_hands?.[user?.id];
  const myTeam = game?.players?.find(p => p.id === user?.id)?.team;
  const myTrucoCaller = game?.truco_caller_team === myTeam;
  
  // Envido: permitido en hand 1 y no resuelto
  const canCallEnvido = (game?.current_hand || 1) === 1 && 
                        !game?.envido_resolved && 
                        !game?.envido_pending_response &&
                        !game?.truco_pending_response;
  
  // Truco logic
  const trucoState = game?.truco_state;
  const trucoPending = game?.truco_pending_response;
  const trucoCallerTeam = game?.truco_caller_team;
  const canIRaise = !trucoPending || (trucoPending && trucoCallerTeam !== myTeam);
  
  let trucoButton = null;
  if (!trucoState && canIRaise) {
    trucoButton = { label: 'TRUCO', action: 'truco', points: 2 };
  } else if (trucoState === 'truco' && trucoPending && canIRaise) {
    trucoButton = { label: 'RETRUCO', action: 'retruco', points: 3 };
  } else if (trucoState === 'retruco' && trucoPending && canIRaise) {
    trucoButton = { label: 'VALE 4', action: 'vale_cuatro', points: 4 };
  } else if (trucoState === 'truco' && !trucoPending && !myTrucoCaller) {
    trucoButton = { label: 'RETRUCO', action: 'retruco', points: 3 };
  } else if (trucoState === 'retruco' && !trucoPending && !myTrucoCaller) {
    trucoButton = { label: 'VALE 4', action: 'vale_cuatro', points: 4 };
  }
  
  const canCallFlor = game?.with_flor && 
                      myHand?.has_flor && 
                      !myHand?.flor_announced &&
                      (game?.current_hand || 1) === 1 &&
                      !game?.flor_resolved;

  const canPlayCard = isMyTurn && 
                      !game?.truco_pending_response && 
                      !game?.envido_pending_response;

  // Get opponent info
  const opponent = game?.players?.find(p => p.id !== user?.id);
  const myScore = myTeam === 1 ? (game?.team1_score || 0) : (game?.team2_score || 0);
  const theirScore = myTeam === 1 ? (game?.team2_score || 0) : (game?.team1_score || 0);

  // LOADING
  if (loading) {
    return (
      <div className="h-[100dvh] bg-gradient-to-br from-[#1a4d2e] to-[#0f2818] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-3 border-[#FFD700] border-t-transparent rounded-full" />
      </div>
    );
  }

  // WAITING FOR PLAYERS
  if (table?.status === 'waiting') {
    return (
      <div className="h-[100dvh] bg-gradient-to-br from-[#1a4d2e] to-[#0f2818] flex flex-col items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-sm w-full">
          <Users className="w-12 h-12 text-[#FFD700] mx-auto mb-3" />
          <h1 className="font-bold text-xl text-white mb-3">ESPERANDO JUGADORES</h1>
          <p className="text-gray-300 mb-4 text-sm">{table.players?.length || 0} / {table.max_players}</p>
          
          {table.code && (
            <div className="bg-white/10 backdrop-blur p-3 rounded-xl mb-4">
              <p className="text-gray-300 text-xs mb-1">Código de mesa:</p>
              <p className="font-mono text-2xl text-[#FFD700] tracking-widest">{table.code}</p>
            </div>
          )}
          
          <div className="space-y-2 mb-4">
            {table.players?.map((player) => (
              <div key={player.id} className="flex items-center gap-2 bg-white/10 px-3 py-2 rounded-lg">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs ${
                  player.team === 1 ? 'bg-[#2ECC71]' : 'bg-[#E74C3C]'
                }`}>
                  {player.username.substring(0, 2).toUpperCase()}
                </div>
                <span className="text-white text-sm flex-1">{player.username}</span>
                {player.id === user?.id && <span className="text-[#FFD700] text-xs">(Vos)</span>}
              </div>
            ))}
          </div>

          <Button onClick={() => navigate('/dashboard')} className="w-full bg-white/20 hover:bg-white/30 text-white text-sm" data-testid="back-to-lobby-btn">
            <ArrowLeft className="w-4 h-4 mr-1" /> Volver
          </Button>
        </motion.div>
      </div>
    );
  }

  // GAME FINISHED
  if (game?.status === 'finished' || table?.status === 'finished') {
    const iWon = game?.winner_team === myTeam;
    return (
      <div className="h-[100dvh] bg-gradient-to-br from-[#1a4d2e] to-[#0f2818] flex flex-col items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-sm w-full">
          <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${iWon ? 'bg-[#2ECC71]/20' : 'bg-[#E74C3C]/20'}`}>
            <Trophy className={`w-8 h-8 ${iWon ? 'text-[#FFD700]' : 'text-gray-500'}`} />
          </div>
          <h1 className={`font-bold text-3xl mb-2 ${iWon ? 'text-[#FFD700]' : 'text-[#E74C3C]'}`}>
            {iWon ? '¡GANASTE!' : 'PERDISTE'}
          </h1>
          <div className="bg-white/10 p-4 rounded-xl mb-6">
            <div className="flex items-center justify-center gap-6">
              <div className="text-center">
                <p className="text-[10px] text-[#2ECC71] font-bold">NOS</p>
                <p className="font-mono text-3xl text-white">{myScore}</p>
              </div>
              <span className="text-gray-400 text-xl">-</span>
              <div className="text-center">
                <p className="text-[10px] text-[#E74C3C] font-bold">ELLOS</p>
                <p className="font-mono text-3xl text-white">{theirScore}</p>
              </div>
            </div>
          </div>
          <Button onClick={() => navigate('/dashboard')} className="w-full bg-[#FFD700] hover:bg-[#FFC700] text-[#0f2818] font-bold" data-testid="back-to-dashboard-btn">
            Volver al Lobby
          </Button>
        </motion.div>
      </div>
    );
  }

  // ==================== MAIN GAME VIEW ====================
  return (
    <div className="h-[100dvh] bg-gradient-to-br from-[#1a4d2e] to-[#0f2818] flex flex-col overflow-hidden select-none">
      
      {/* === HEADER: Scores === */}
      <header className="bg-[#0d1f14]/90 backdrop-blur border-b border-white/10 px-2 py-1.5 flex-shrink-0 z-30">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="text-white hover:bg-white/10 h-8 w-8" data-testid="back-btn">
            <ArrowLeft className="w-4 h-4" />
          </Button>

          {/* Score display */}
          <div className="flex items-center gap-2">
            <div className="text-center">
              <p className="text-[8px] text-[#2ECC71] uppercase font-bold leading-none">Nos</p>
              <p className="text-white font-mono text-lg font-bold leading-none">{myScore}</p>
            </div>
            <div className="bg-white/15 rounded-full w-7 h-7 flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">{game?.points_to_win || 15}</span>
            </div>
            <div className="text-center">
              <p className="text-[8px] text-[#E74C3C] uppercase font-bold leading-none">Ellos</p>
              <p className="text-white font-mono text-lg font-bold leading-none">{theirScore}</p>
            </div>
          </div>

          <Button variant="ghost" size="icon" onClick={() => setShowChat(!showChat)} className="text-white hover:bg-white/10 h-8 w-8" data-testid="chat-toggle-btn">
            <MessageCircle className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* === NOTIFICATION BAR === */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`text-center py-1.5 px-3 text-xs font-bold flex-shrink-0 z-20 ${
              notification.type === 'truco' ? 'bg-[#E74C3C] text-white' :
              notification.type === 'envido' ? 'bg-[#3498DB] text-white' :
              notification.type === 'success' ? 'bg-[#2ECC71] text-white' :
              notification.type === 'error' ? 'bg-[#E74C3C] text-white' :
              'bg-[#34495E] text-white'
            }`}
          >
            {notification.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* === GAME AREA === */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        
        {/* Opponent area */}
        <div className="flex-shrink-0 px-3 pt-2 pb-1 flex items-center justify-center gap-2">
          {game?.players?.filter(p => p.id !== user?.id).map(player => {
            const isCurrentTurn = game?.current_turn === player.id;
            const opponentHand = game?.players_hands?.[player.id];
            return (
              <div key={player.id} className="flex flex-col items-center gap-1">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs border-2 ${
                  isCurrentTurn ? 'border-[#FFD700] animate-pulse' : 'border-white/30'
                } ${player.team === 1 ? 'bg-[#2ECC71]' : 'bg-[#E74C3C]'} shadow-md`}>
                  {player.username.substring(0, 2).toUpperCase()}
                </div>
                <span className="text-[9px] font-bold bg-black/40 text-white px-1.5 py-0.5 rounded">
                  {player.username.length > 10 ? player.username.substring(0, 10) : player.username}
                </span>
                {/* Opponent's hidden cards */}
                <div className="flex gap-0.5 mt-0.5">
                  {opponentHand?.cards?.map((_, i) => (
                    <PlayingCard key={i} card={{ hidden: true }} size="xs" faceDown />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Table surface with played cards */}
        <div className="flex-1 relative flex items-center justify-center min-h-0 px-2">
          {/* Table background */}
          <div className="absolute inset-2 rounded-2xl bg-gradient-to-br from-[#8B5E3C] via-[#A0704B] to-[#7A5230] shadow-xl border-2 border-[#5C3D26]/50"
            style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.5), inset 0 1px 8px rgba(255,255,255,0.08)' }}>
            <div className="absolute inset-0 rounded-2xl opacity-10"
              style={{ backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)` }} />
          </div>

          {/* Cards on table */}
          <div className="relative z-10 flex flex-col items-center gap-2 max-w-full">
            {/* Previous hand results */}
            {game?.hand_results && game.hand_results.length > 0 && (
              <div className="flex gap-1.5 flex-wrap justify-center">
                {game.hand_results.map((result, idx) => (
                  <div key={idx} className="bg-black/50 backdrop-blur rounded-lg p-1.5">
                    <p className="text-white text-[8px] font-bold text-center mb-0.5">Mano {idx + 1}</p>
                    <div className="flex gap-0.5 justify-center">
                      {result.cards?.map((c, i) => (
                        <div key={i} className="relative">
                          <PlayingCard card={c.card} size="xs" />
                        </div>
                      ))}
                    </div>
                    <p className={`text-[8px] font-bold mt-0.5 text-center ${
                      result.is_parda ? 'text-yellow-400' : 
                      result.winner_team === myTeam ? 'text-[#2ECC71]' : 'text-[#E74C3C]'
                    }`}>
                      {result.is_parda ? 'Parda' : result.winner_team === myTeam ? '✓ Ganamos' : '✗ Perdimos'}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Current round cards */}
            {game?.round_cards && game.round_cards.length > 0 && (
              <div className="flex gap-2 flex-wrap justify-center">
                {game.round_cards.map((played, idx) => {
                  const player = game.players?.find(p => p.id === played.player_id);
                  return (
                    <motion.div key={idx} initial={{ opacity: 0, scale: 0.5, y: -30 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="relative">
                      <PlayingCard card={played.card} size="md" />
                      <div className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full text-[8px] font-bold whitespace-nowrap ${
                        played.player_id === user?.id ? 'bg-[#FFD700] text-[#0f2818]' : 'bg-black/70 text-white'
                      }`}>
                        {player?.username?.substring(0, 6)}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Round info */}
            {game && (
              <div className="bg-black/40 backdrop-blur px-3 py-1 rounded-full">
                <p className="text-white text-[10px] font-bold">
                  Mano {game.current_hand || 1}/3 · Ronda {game.current_round || 1}
                </p>
                {game.truco_state && (
                  <p className="text-[#FFD700] text-[9px] font-bold text-center">
                    {game.truco_state.replace('_', ' ').toUpperCase()} ({game.truco_points} pts)
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* My hand - always visible at bottom */}
        <div className="flex-shrink-0 px-2 pb-1">
          {/* My player info */}
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-[8px] ${
              myTeam === 1 ? 'bg-[#2ECC71]' : 'bg-[#E74C3C]'
            } ${isMyTurn ? 'ring-2 ring-[#FFD700] animate-pulse' : ''}`}>
              {user?.username?.substring(0, 2).toUpperCase()}
            </div>
            <span className="text-white text-[10px] font-bold">{user?.username}</span>
            {myHand?.envido_points !== undefined && (
              <span className="text-[#3498DB] text-[9px] font-bold bg-[#3498DB]/20 px-1.5 py-0.5 rounded">
                E:{myHand.envido_points}
              </span>
            )}
          </div>

          {/* Cards in hand */}
          <div className="flex gap-2 justify-center items-end">
            {myHand?.cards?.map((card, idx) => (
              <motion.div
                key={`${card.suit}-${card.number}-${idx}`}
                initial={{ opacity: 0, y: 30 }}
                animate={{ 
                  opacity: 1, 
                  y: selectedCard === idx ? -10 : 0,
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                data-testid={`card-${idx}`}
                onClick={() => {
                  if (canPlayCard) {
                    if (selectedCard === idx) {
                      handlePlayCard(idx);
                    } else {
                      setSelectedCard(idx);
                    }
                  }
                }}
              >
                <PlayingCard 
                  card={card} 
                  size="lg"
                  selected={selectedCard === idx}
                  disabled={!canPlayCard}
                />
              </motion.div>
            ))}
            {(!myHand?.cards || myHand.cards.length === 0) && (
              <p className="text-gray-400 text-xs italic py-2">Sin cartas</p>
            )}
          </div>
        </div>
      </div>

      {/* === ACTION BUTTONS === */}
      <div className="bg-[#0d1f14]/95 backdrop-blur border-t border-white/10 px-2 py-1.5 flex-shrink-0 z-20">
        {isMyTurn && canPlayCard && (
          <p className="text-[#FFD700] text-center text-[10px] mb-1 animate-pulse font-bold">
            ⭐ TU TURNO - Tocá una carta para seleccionar, tocá de nuevo para jugar
          </p>
        )}
        
        <div className="grid grid-cols-5 gap-1.5 max-w-lg mx-auto">
          {/* Truco */}
          <Button
            onClick={() => trucoButton && handleCallTruco(trucoButton.action)}
            disabled={!trucoButton}
            className="bg-[#E74C3C] hover:bg-[#C0392B] text-white font-bold py-3 text-[10px] leading-tight disabled:opacity-30 h-auto min-h-0"
            data-testid="truco-btn"
          >
            {trucoButton ? trucoButton.label : 'TRUCO'}
          </Button>
          
          {/* Envido */}
          <Button
            onClick={() => handleCallEnvido('envido')}
            disabled={!canCallEnvido}
            className="bg-[#3498DB] hover:bg-[#2980B9] text-white font-bold py-3 text-[10px] leading-tight disabled:opacity-30 h-auto min-h-0"
            data-testid="envido-btn"
          >
            ENVIDO
          </Button>
          
          {/* Real Envido or Flor */}
          {canCallFlor ? (
            <Button
              onClick={handleCallFlor}
              className="bg-[#9B59B6] hover:bg-[#8E44AD] text-white font-bold py-3 text-[10px] leading-tight h-auto min-h-0"
              data-testid="flor-btn"
            >
              FLOR
            </Button>
          ) : (
            <Button
              onClick={() => handleCallEnvido('real_envido')}
              disabled={!canCallEnvido}
              className="bg-[#2980B9] hover:bg-[#1F6FA0] text-white font-bold py-3 text-[10px] leading-tight disabled:opacity-30 h-auto min-h-0"
            >
              REAL E.
            </Button>
          )}

          {/* Falta Envido */}
          <Button
            onClick={() => handleCallEnvido('falta_envido')}
            disabled={!canCallEnvido}
            className="bg-[#1ABC9C] hover:bg-[#16A085] text-white font-bold py-3 text-[10px] leading-tight disabled:opacity-30 h-auto min-h-0"
          >
            FALTA E.
          </Button>
          
          {/* Mazo */}
          <Button
            onClick={handleIrseAlMazo}
            className="bg-[#7f8c8d] hover:bg-[#636e72] text-white font-bold py-3 text-[10px] leading-tight h-auto min-h-0"
            data-testid="mazo-btn"
          >
            MAZO
          </Button>
        </div>
      </div>

      {/* === RESPONSE OVERLAY (Truco/Envido) === */}
      <AnimatePresence>
        {waitingForResponse && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 z-40 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-gradient-to-br from-[#1a4d2e] to-[#0f2818] p-4 rounded-2xl border-2 border-[#FFD700] max-w-xs w-full shadow-2xl"
            >
              <p className={`font-bold text-2xl mb-1 text-center ${
                waitingForResponse.type === 'truco' ? 'text-[#E74C3C]' : 'text-[#3498DB]'
              }`}>
                ¡{waitingForResponse.call.replace('_', ' ').toUpperCase()}!
              </p>
              <p className="text-white text-center mb-1 text-sm font-bold">
                Vale {waitingForResponse.points} puntos
              </p>
              {waitingForResponse.type === 'envido' && myHand?.envido_points !== undefined && (
                <p className="text-[#3498DB] text-center mb-3 text-xs font-bold">
                  Tu envido: {myHand.envido_points}
                </p>
              )}
              <div className="grid grid-cols-2 gap-2 mt-3">
                <Button
                  onClick={() => waitingForResponse.type === 'truco' ? handleRespondTruco('quiero') : handleRespondEnvido('quiero')}
                  className="bg-[#2ECC71] hover:bg-[#27AE60] text-white font-bold py-4 text-sm"
                >
                  QUIERO
                </Button>
                <Button
                  onClick={() => waitingForResponse.type === 'truco' ? handleRespondTruco('no_quiero') : handleRespondEnvido('no_quiero')}
                  className="bg-[#E74C3C] hover:bg-[#C0392B] text-white font-bold py-4 text-sm"
                >
                  NO QUIERO
                </Button>
              </div>
              {/* Raise options */}
              {waitingForResponse.type === 'truco' && waitingForResponse.call === 'truco' && (
                <Button onClick={() => { handleCallTruco('retruco'); setWaitingForResponse(null); }}
                  className="w-full mt-2 bg-[#9B59B6] hover:bg-[#8E44AD] text-white font-bold py-3 text-xs">
                  RETRUCO (3 pts)
                </Button>
              )}
              {waitingForResponse.type === 'truco' && waitingForResponse.call === 'retruco' && (
                <Button onClick={() => { handleCallTruco('vale_cuatro'); setWaitingForResponse(null); }}
                  className="w-full mt-2 bg-[#9B59B6] hover:bg-[#8E44AD] text-white font-bold py-3 text-xs">
                  VALE 4 (4 pts)
                </Button>
              )}
              {/* Envido counter options */}
              {waitingForResponse.type === 'envido' && (
                <div className="flex gap-1.5 mt-2">
                  {waitingForResponse.call === 'envido' && (
                    <>
                      <Button onClick={() => { handleCallEnvido('envido'); setWaitingForResponse(null); }}
                        className="flex-1 bg-[#3498DB] hover:bg-[#2980B9] text-white font-bold py-2 text-[10px]">
                        ENVIDO
                      </Button>
                      <Button onClick={() => { handleCallEnvido('real_envido'); setWaitingForResponse(null); }}
                        className="flex-1 bg-[#2980B9] hover:bg-[#1F6FA0] text-white font-bold py-2 text-[10px]">
                        REAL E.
                      </Button>
                      <Button onClick={() => { handleCallEnvido('falta_envido'); setWaitingForResponse(null); }}
                        className="flex-1 bg-[#1ABC9C] hover:bg-[#16A085] text-white font-bold py-2 text-[10px]">
                        FALTA E.
                      </Button>
                    </>
                  )}
                  {waitingForResponse.call === 'real_envido' && (
                    <Button onClick={() => { handleCallEnvido('falta_envido'); setWaitingForResponse(null); }}
                      className="flex-1 bg-[#1ABC9C] hover:bg-[#16A085] text-white font-bold py-2 text-[10px]">
                      FALTA ENVIDO
                    </Button>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === CHAT DRAWER === */}
      <AnimatePresence>
        {showChat && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25 }}
            className="fixed inset-x-0 bottom-0 bg-[#0d1f14]/95 backdrop-blur border-t border-white/10 z-50 h-[55vh] flex flex-col"
          >
            <div className="p-2 border-b border-white/10 flex justify-between items-center">
              <span className="font-bold text-white text-sm">CHAT</span>
              <Button variant="ghost" size="icon" onClick={() => setShowChat(false)} className="text-white h-7 w-7">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <ScrollArea className="flex-1 p-2">
              <div className="space-y-1.5">
                {chatMessages.length === 0 ? (
                  <p className="text-gray-400 text-center text-xs">Sin mensajes</p>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div key={idx} className={msg.sender_id === user?.id ? 'text-right' : ''}>
                      <span className="text-[10px] text-gray-400">{msg.sender_username}</span>
                      <p className={`text-xs ${msg.sender_id === user?.id ? 'text-[#FFD700]' : 'text-white'}`}>{msg.message}</p>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
            <div className="p-2 border-t border-white/10 flex gap-1.5">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                placeholder="Mensaje..."
                className="bg-white/10 border-white/20 text-white placeholder:text-gray-400 text-xs h-8"
                data-testid="chat-input"
              />
              <Button onClick={handleSendChat} className="bg-[#FFD700] hover:bg-[#FFC700] text-[#0f2818] h-8 w-8 p-0" data-testid="send-chat-btn">
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GameTable;
