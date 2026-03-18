import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, MessageCircle, Users, Trophy,
  Send, Volume2, VolumeX, Flower2, Menu
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
    sendTableChat 
  } = useSocket();
  
  const [game, setGame] = useState(null);
  const [table, setTable] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [waitingForResponse, setWaitingForResponse] = useState(null);

  const fetchGameData = useCallback(async () => {
    try {
      const [tableRes] = await Promise.all([
        api.get(`/tables/${tableId}`)
      ]);
      setTable(tableRes.data);

      if (tableRes.data.status === 'playing') {
        const gameRes = await api.get(`/games/table/${tableId}`);
        setGame(gameRes.data);
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

    return () => {
      leaveTable(tableId);
    };
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
    toast.success('¡La partida comenzó!');
    fetchGameData();
  }, [fetchGameData]);

  const handleGameFinished = useCallback((data) => {
    const myTeam = game?.players?.find(p => p.id === user?.id)?.team;
    if (data.winner_team === myTeam) {
      toast.success(`¡Ganaste! Premio: $${data.prize_per_winner.toFixed(0)}`);
    } else {
      toast.error('Perdiste la partida');
    }
    fetchGameData();
  }, [game, user, fetchGameData]);

  const handleTrucoCalled = useCallback((data) => {
    const myTeam = game?.players?.find(p => p.id === user?.id)?.team;
    if (data.caller_team !== myTeam) {
      setWaitingForResponse({ type: 'truco', call: data.call_type, points: data.points });
    }
    toast.info(`¡${data.call_type.replace('_', ' ').toUpperCase()}! (${data.points} pts)`, { duration: 5000 });
  }, [game, user]);

  const handleTrucoResponse = useCallback((data) => {
    setWaitingForResponse(null);
    if (data.response === 'quiero') {
      toast.success(`¡QUIERO! (${data.current_points} puntos en juego)`);
    } else {
      toast.info(`No quiero... ${data.points_awarded} punto(s) para el equipo ${data.winner_team}`);
    }
    if (data.game_finished) {
      fetchGameData();
    } else {
      handleGameUpdate();
    }
  }, [handleGameUpdate, fetchGameData]);

  const handleEnvidoCalled = useCallback((data) => {
    const myTeam = game?.players?.find(p => p.id === user?.id)?.team;
    if (data.caller_team !== myTeam) {
      setWaitingForResponse({ type: 'envido', call: data.call_type, points: data.total_points });
    }
    toast.info(`¡${data.call_type.replace('_', ' ').toUpperCase()}! (${data.total_points} pts)`, { duration: 5000 });
  }, [game, user]);

  const handleEnvidoResponse = useCallback((data) => {
    setWaitingForResponse(null);
    if (data.response === 'quiero') {
      toast.success(`¡QUIERO! Envido: Nosotros ${data.team1_envido} - Ellos ${data.team2_envido}. Gana equipo ${data.winner_team} (+${data.points_awarded} pts)`);
    } else {
      toast.info(`No quiero... ${data.points_awarded} punto(s) para el equipo ${data.winner_team}`);
    }
    if (data.game_finished) {
      fetchGameData();
    } else {
      handleGameUpdate();
    }
  }, [handleGameUpdate, fetchGameData]);

  const handleFlorCalled = useCallback((data) => {
    toast.success(`¡FLOR! ${data.caller_username} tiene flor (+3 puntos)`, { duration: 4000 });
    if (data.game_finished) {
      fetchGameData();
    } else {
      handleGameUpdate();
    }
  }, [handleGameUpdate, fetchGameData]);

  const handleTableChat = useCallback((msg) => {
    setChatMessages(prev => [...prev, msg]);
  }, []);

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
      socket.off('table_chat', handleTableChat);
    };
  }, [socket, handleGameUpdate, handleGameStarted, handleGameFinished, handleTrucoCalled, handleTrucoResponse, handleEnvidoCalled, handleEnvidoResponse, handleFlorCalled, handleTableChat]);

  const handlePlayCard = async (cardIndex) => {
    if (!isMyTurn || !game) return;

    try {
      const result = await playCard(game.id, cardIndex);
      if (result?.error) {
        toast.error(result.error);
      }
      setSelectedCard(null);
    } catch (error) {
      toast.error('Error al jugar carta');
    }
  };

  const handleCallTruco = async (callType) => {
    try {
      const result = await callTruco(game.id, callType);
      if (result?.error) {
        toast.error(result.error);
      }
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
      if (result?.error) {
        toast.error(result.error);
      }
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
      if (result?.error) {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error('Error al cantar flor');
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
  
  const canCallEnvido = !game?.first_card_played && 
                        !game?.envido_resolved && 
                        !game?.envido_pending_response &&
                        !game?.truco_pending_response;
  
  // Lógica mejorada de Truco/Retruco/Vale 4
  const trucoState = game?.truco_state; // null, "truco", "retruco", "vale_cuatro"
  const trucoPending = game?.truco_pending_response;
  const trucoCallerTeam = game?.truco_caller_team;
  
  // Solo puedo cantar si NO soy el equipo que cantó lo último
  const canIRaise = !trucoPending || (trucoPending && trucoCallerTeam !== myTeam);
  
  // Determinar qué botón de truco mostrar
  let trucoButton = null;
  if (!trucoState && canIRaise) {
    // Estado inicial: puedo cantar TRUCO
    trucoButton = { label: 'TRUCO', action: 'truco', points: 2 };
  } else if (trucoState === 'truco' && trucoPending && canIRaise) {
    // Me cantaron TRUCO, puedo RETRUCO
    trucoButton = { label: 'RETRUCO', action: 'retruco', points: 3 };
  } else if (trucoState === 'retruco' && trucoPending && canIRaise) {
    // Me cantaron RETRUCO, puedo VALE 4
    trucoButton = { label: 'VALE 4', action: 'vale_cuatro', points: 4 };
  } else if (trucoState === 'truco' && !trucoPending && !myTrucoCaller) {
    // Aceptaron mi TRUCO, el otro equipo puede RETRUCO
    trucoButton = { label: 'RETRUCO', action: 'retruco', points: 3 };
  } else if (trucoState === 'retruco' && !trucoPending && !myTrucoCaller) {
    // Aceptaron RETRUCO, el otro equipo puede VALE 4
    trucoButton = { label: 'VALE 4', action: 'vale_cuatro', points: 4 };
  }
  
  const canCallFlor = game?.with_flor && 
                      myHand?.has_flor && 
                      !myHand?.flor_announced &&
                      !game?.first_card_played &&
                      !game?.flor_resolved;

  const canPlayCard = isMyTurn && 
                      !game?.truco_pending_response && 
                      !game?.envido_pending_response;

  // Get player positions around table
  const getPlayerPosition = (index, total) => {
    const positions = {
      2: ['bottom', 'top'],
      4: ['bottom', 'left', 'top', 'right'],
      6: ['bottom-left', 'left', 'top-left', 'top-right', 'right', 'bottom-right']
    };
    return positions[total]?.[index] || 'bottom';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a4d2e] to-[#0f2818] flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  // Waiting for players
  if (table?.status === 'waiting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a4d2e] to-[#0f2818] flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md w-full"
        >
          <Users className="w-16 h-16 text-[#FFD700] mx-auto mb-4" />
          <h1 className="font-display text-2xl md:text-3xl text-white mb-4">ESPERANDO JUGADORES</h1>
          <p className="text-gray-300 mb-6">
            {table.players?.length || 0} / {table.max_players} jugadores
          </p>
          
          {table.code && (
            <div className="bg-white/10 backdrop-blur p-4 rounded-xl mb-6">
              <p className="text-gray-300 text-sm mb-2">Código de la mesa:</p>
              <p className="font-mono text-2xl md:text-3xl text-[#FFD700] tracking-widest">{table.code}</p>
            </div>
          )}
          
          <div className="space-y-2 mb-6">
            {table.players?.map((player) => (
              <div key={player.id} className="flex items-center gap-3 bg-white/10 backdrop-blur px-4 py-3 rounded-lg">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                  player.team === 1 ? 'bg-[#2ECC71]' : 'bg-[#E74C3C]'
                }`}>
                  {player.username.substring(0, 2).toUpperCase()}
                </div>
                <span className="text-white flex-1">{player.username}</span>
                {player.id === user?.id && <span className="text-[#FFD700] text-sm">(Vos)</span>}
              </div>
            ))}
          </div>

          <Button
            onClick={() => navigate('/dashboard')}
            className="w-full bg-white/20 hover:bg-white/30 text-white border border-white/30"
            data-testid="back-to-lobby-btn"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al lobby
          </Button>
        </motion.div>
      </div>
    );
  }

  // Game finished
  if (game?.status === 'finished' || table?.status === 'finished') {
    const myScore = myTeam === 1 ? game?.team1_score : game?.team2_score;
    const theirScore = myTeam === 1 ? game?.team2_score : game?.team1_score;
    const iWon = game?.winner_team === myTeam;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a4d2e] to-[#0f2818] flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md w-full"
        >
          <div className={`w-20 h-20 md:w-24 md:h-24 rounded-full mx-auto mb-6 flex items-center justify-center ${
            iWon ? 'bg-[#2ECC71]/20' : 'bg-[#E74C3C]/20'
          }`}>
            <Trophy className={`w-10 h-10 md:w-12 md:h-12 ${iWon ? 'text-[#FFD700]' : 'text-gray-500'}`} />
          </div>
          
          <h1 className={`font-display text-3xl md:text-4xl mb-2 ${
            iWon ? 'text-[#FFD700]' : 'text-[#E74C3C]'
          }`}>
            {iWon ? '¡GANASTE!' : 'PERDISTE'}
          </h1>
          
          <p className="text-gray-300 mb-8">
            {iWon ? '¡Felicitaciones por la victoria!' : 'Mejor suerte la próxima'}
          </p>
          
          <div className="bg-white/10 backdrop-blur p-6 rounded-xl mb-8">
            <p className="text-gray-300 text-sm mb-4">Resultado Final</p>
            <div className="flex items-center justify-center gap-8">
              <div className="text-center">
                <p className="text-xs text-[#2ECC71] mb-1">VOS</p>
                <p className="font-mono text-4xl text-white">{myScore || 0}</p>
              </div>
              <span className="text-gray-400 text-2xl">-</span>
              <div className="text-center">
                <p className="text-xs text-[#E74C3C] mb-1">ELLOS</p>
                <p className="font-mono text-4xl text-white">{theirScore || 0}</p>
              </div>
            </div>
          </div>
          
          <Button
            onClick={() => navigate('/dashboard')}
            className="w-full bg-[#FFD700] hover:bg-[#FFC700] text-[#0f2818] font-bold"
            data-testid="back-to-dashboard-btn"
          >
            Volver al Lobby
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a4d2e] to-[#0f2818] flex flex-col overflow-hidden">
      {/* Header - Mobile optimized */}
      <header className="bg-[#0d1f14]/90 backdrop-blur border-b border-white/10 px-3 py-2.5 shrink-0">
        <div className="flex items-center justify-between">
          {/* Left: Back button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/dashboard')}
            className="text-white hover:bg-white/10 h-9 w-9"
            data-testid="back-btn"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          {/* Center: Scores */}
          <div className="flex items-center gap-3">
            <div className="text-center">
              <p className="text-[9px] text-[#2ECC71] uppercase tracking-wide font-bold">Nos</p>
              <div className="flex gap-0.5 mt-1">
                {[...Array(Math.min(5, game?.points_to_win || 15))].map((_, i) => (
                  <div
                    key={i}
                    className={`w-2.5 h-2.5 rounded-sm ${
                      i < (myTeam === 1 ? game?.team1_score : game?.team2_score || 0)
                        ? 'bg-[#2ECC71]'
                        : 'bg-white/20'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="bg-white/20 rounded-full w-9 h-9 flex items-center justify-center">
              <span className="text-white text-xs font-bold">{game?.points_to_win || 15}</span>
            </div>

            <div className="text-center">
              <p className="text-[9px] text-[#E74C3C] uppercase tracking-wide font-bold">Ella</p>
              <div className="flex gap-0.5 mt-1">
                {[...Array(Math.min(5, game?.points_to_win || 15))].map((_, i) => (
                  <div
                    key={i}
                    className={`w-2.5 h-2.5 rounded-sm ${
                      i < (myTeam === 1 ? game?.team2_score : game?.team1_score || 0)
                        ? 'bg-[#E74C3C]'
                        : 'bg-white/20'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowChat(!showChat)}
              className="text-white hover:bg-white/10 h-9 w-9"
              data-testid="chat-toggle-btn"
            >
              <MessageCircle className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Game Table - Responsive 2D/3D View */}
      <div className="flex-1 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.3) 100%)`
          }} />
        </div>

        {/* Main table area */}
        <div className="absolute inset-0 flex flex-col">
          {/* Top players area */}
          <div className="h-20 flex items-center justify-center gap-4 px-2">
            {game?.players?.filter((_, idx) => {
              const pos = getPlayerPosition(idx, game.players.length);
              return pos.includes('top');
            }).map((player) => {
              const isMe = player.id === user?.id;
              const isCurrentTurn = game?.current_turn === player.id;
              return (
                <div key={player.id} className="flex flex-col items-center gap-1">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm border-3 ${
                    isCurrentTurn ? 'border-[#FFD700] ring-2 ring-[#FFD700] animate-pulse' : 'border-white/30'
                  } ${
                    player.team === 1 ? 'bg-gradient-to-br from-[#2ECC71] to-[#27AE60]' : 'bg-gradient-to-br from-[#E74C3C] to-[#C0392B]'
                  } shadow-lg`}>
                    {player.username.substring(0, 2).toUpperCase()}
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    isMe ? 'bg-[#FFD700] text-[#0f2818]' : 'bg-black/50 text-white'
                  }`}>
                    {player.username.length > 8 ? player.username.substring(0, 8) + '...' : player.username}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Middle: Table with cards */}
          <div className="flex-1 relative flex items-center justify-center">
            {/* Table surface */}
            <div className="absolute inset-4 md:inset-8 rounded-3xl bg-gradient-to-br from-[#8B4513] via-[#A0522D] to-[#654321] shadow-2xl border-4 border-[#654321]/50"
              style={{
                boxShadow: '0 10px 40px rgba(0,0,0,0.6), inset 0 2px 15px rgba(255,255,255,0.1)'
              }}
            >
              {/* Wood texture */}
              <div className="absolute inset-0 rounded-3xl opacity-10"
                style={{
                  backgroundImage: `repeating-linear-gradient(
                    90deg,
                    transparent,
                    transparent 3px,
                    rgba(0,0,0,0.2) 3px,
                    rgba(0,0,0,0.2) 6px
                  )`
                }}
              />
            </div>

            {/* Side players */}
            <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col gap-3">
              {game?.players?.filter((_, idx) => {
                const pos = getPlayerPosition(idx, game.players.length);
                return pos.includes('left') && !pos.includes('top') && !pos.includes('bottom');
              }).map((player) => {
                const isMe = player.id === user?.id;
                const isCurrentTurn = game?.current_turn === player.id;
                return (
                  <div key={player.id} className="flex flex-col items-center gap-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs border-2 ${
                      isCurrentTurn ? 'border-[#FFD700] ring-2 ring-[#FFD700] animate-pulse' : 'border-white/30'
                    } ${
                      player.team === 1 ? 'bg-gradient-to-br from-[#2ECC71] to-[#27AE60]' : 'bg-gradient-to-br from-[#E74C3C] to-[#C0392B]'
                    } shadow-lg`}>
                      {player.username.substring(0, 2).toUpperCase()}
                    </div>
                    <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${
                      isMe ? 'bg-[#FFD700] text-[#0f2818]' : 'bg-black/50 text-white'
                    }`}>
                      {player.username.substring(0, 5)}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-3">
              {game?.players?.filter((_, idx) => {
                const pos = getPlayerPosition(idx, game.players.length);
                return pos.includes('right') && !pos.includes('top') && !pos.includes('bottom');
              }).map((player) => {
                const isMe = player.id === user?.id;
                const isCurrentTurn = game?.current_turn === player.id;
                return (
                  <div key={player.id} className="flex flex-col items-center gap-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs border-2 ${
                      isCurrentTurn ? 'border-[#FFD700] ring-2 ring-[#FFD700] animate-pulse' : 'border-white/30'
                    } ${
                      player.team === 1 ? 'bg-gradient-to-br from-[#2ECC71] to-[#27AE60]' : 'bg-gradient-to-br from-[#E74C3C] to-[#C0392B]'
                    } shadow-lg`}>
                      {player.username.substring(0, 2).toUpperCase()}
                    </div>
                    <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${
                      isMe ? 'bg-[#FFD700] text-[#0f2818]' : 'bg-black/50 text-white'
                    }`}>
                      {player.username.substring(0, 5)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Center area: Previous hands + Current cards */}
            <div className="relative z-10 flex flex-col items-center gap-3">
              {/* Previous hands results */}
              {game?.hand_results && game.hand_results.length > 0 && (
                <div className="flex gap-2 mb-2">
                  {game.hand_results.map((result, idx) => (
                    <div key={idx} className="bg-black/60 backdrop-blur rounded-lg p-2">
                      <p className="text-white text-[9px] font-bold mb-1 text-center">
                        Mano {idx + 1}
                      </p>
                      <div className="flex gap-1">
                        {result.cards?.slice(0, 3).map((c, i) => (
                          <div key={i} className="relative">
                            <PlayingCard card={c.card} size="sm" />
                            <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center text-[8px] ${
                              game.players?.find(p => p.id === c.player_id)?.team === 1 ? 'bg-[#2ECC71]' : 'bg-[#E74C3C]'
                            }`}>
                              {game.players?.find(p => p.id === c.player_id)?.username.substring(0, 1).toUpperCase()}
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className={`text-[9px] font-bold mt-1 text-center ${
                        result.is_parda ? 'text-yellow-400' : 
                        result.winner_team === myTeam ? 'text-[#2ECC71]' : 'text-[#E74C3C]'
                      }`}>
                        {result.is_parda ? 'Parda' : result.winner_team === myTeam ? 'Ganamos' : 'Perdimos'}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Current hand cards on table */}
              {game?.round_cards && game.round_cards.length > 0 && (
                <div className="flex gap-2 flex-wrap justify-center">
                  {game.round_cards.map((played, idx) => {
                    const player = game.players?.find(p => p.id === played.player_id);
                    return (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, scale: 0.5, y: -50 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="relative"
                      >
                        <PlayingCard card={played.card} size="md" />
                        <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          played.player_id === user?.id ? 'bg-[#FFD700] text-[#0f2818]' : 'bg-black/80 text-white'
                        }`}>
                          {player?.username.substring(0, 6)}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Current hand indicator */}
              {game && (
                <div className="text-center bg-black/50 backdrop-blur px-3 py-1 rounded-full">
                  <p className="text-white text-xs font-bold">
                    Mano {game.current_hand || 1}/3 - Ronda {game.current_round || 1}
                  </p>
                  {game.truco_state && (
                    <p className="text-[#E74C3C] text-[10px] font-bold">
                      {game.truco_state.replace('_', ' ').toUpperCase()} ({game.truco_points} pts)
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Bottom: My hand (larger, always visible) */}
          <div className="h-32 md:h-36 flex items-end justify-center pb-2 relative z-20">
            <div className="flex gap-2 px-2">
              {myHand?.cards?.map((card, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ 
                    opacity: 1, 
                    y: selectedCard === idx ? -15 : 0,
                    scale: selectedCard === idx ? 1.1 : 1
                  }}
                  whileTap={canPlayCard ? { scale: 0.95 } : {}}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
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
            </div>
          </div>
        </div>

        {/* Truco/Envido response overlays */}
        <AnimatePresence>
          {waitingForResponse && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/85 z-30 flex items-center justify-center p-4"
            >
              <motion.div 
                initial={{ scale: 0.8, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-gradient-to-br from-[#1a4d2e] to-[#0f2818] p-5 rounded-2xl border-3 border-[#FFD700] max-w-sm w-full shadow-2xl"
              >
                <p className={`font-display text-3xl mb-2 text-center ${
                  waitingForResponse.type === 'truco' ? 'text-[#E74C3C]' : 'text-[#FFD700]'
                }`}>
                  ¡{waitingForResponse.call.replace('_', ' ').toUpperCase()}!
                </p>
                <p className="text-white text-center mb-1 text-lg font-bold">
                  Vale {waitingForResponse.points} puntos
                </p>
                {waitingForResponse.type === 'envido' && myHand?.envido_points !== undefined && (
                  <p className="text-gray-300 text-center mb-4 text-sm">
                    Tu envido: {myHand.envido_points}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <Button
                    onClick={() => waitingForResponse.type === 'truco' ? handleRespondTruco('quiero') : handleRespondEnvido('quiero')}
                    className="bg-[#2ECC71] hover:bg-[#27AE60] text-white font-bold py-5 text-base"
                  >
                    QUIERO
                  </Button>
                  <Button
                    onClick={() => waitingForResponse.type === 'truco' ? handleRespondTruco('no_quiero') : handleRespondEnvido('no_quiero')}
                    className="bg-[#E74C3C] hover:bg-[#C0392B] text-white font-bold py-5 text-base"
                  >
                    NO QUIERO
                  </Button>
                </div>
                {/* Raise options */}
                {waitingForResponse.type === 'truco' && (
                  <div className="mt-3">
                    {waitingForResponse.call === 'truco' && (
                      <Button
                        onClick={() => {
                          handleCallTruco('retruco');
                          setWaitingForResponse(null);
                        }}
                        className="w-full bg-[#9B59B6] hover:bg-[#8E44AD] text-white font-bold py-3"
                      >
                        RETRUCO (3 pts)
                      </Button>
                    )}
                    {waitingForResponse.call === 'retruco' && (
                      <Button
                        onClick={() => {
                          handleCallTruco('vale_cuatro');
                          setWaitingForResponse(null);
                        }}
                        className="w-full bg-[#9B59B6] hover:bg-[#8E44AD] text-white font-bold py-3"
                      >
                        VALE 4 (4 pts)
                      </Button>
                    )}
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Action Buttons - Bottom */}
      <div className="bg-[#0d1f14]/95 backdrop-blur border-t border-white/10 p-2 shrink-0">
        {isMyTurn && canPlayCard && (
          <p className="text-[#FFD700] text-center text-xs mb-2 animate-pulse font-bold">
            ⭐ TU TURNO - Seleccioná una carta
          </p>
        )}
        
        <div className="grid grid-cols-4 gap-2 max-w-2xl mx-auto">
          {/* Truco button - Dinámico según estado */}
          <Button
            onClick={() => trucoButton && handleCallTruco(trucoButton.action)}
            disabled={!trucoButton}
            className="bg-[#E74C3C] hover:bg-[#C0392B] text-white font-display py-5 text-xs disabled:opacity-30 disabled:cursor-not-allowed"
            data-testid="truco-btn"
          >
            {trucoButton ? trucoButton.label : 'TRUCO'}
            {trucoButton && <span className="block text-[9px] mt-0.5">({trucoButton.points})</span>}
          </Button>
          
          <Button
            onClick={() => handleCallEnvido('envido')}
            disabled={!canCallEnvido}
            className="bg-[#3498DB] hover:bg-[#2980B9] text-white font-display py-5 text-xs disabled:opacity-30"
            data-testid="envido-btn"
          >
            ENVIDO
            <span className="block text-[9px] mt-0.5">(2)</span>
          </Button>
          
          {canCallFlor ? (
            <Button
              onClick={handleCallFlor}
              className="bg-[#9B59B6] hover:bg-[#8E44AD] text-white font-display py-5 text-xs"
              data-testid="flor-btn"
            >
              FLOR
              <span className="block text-[9px] mt-0.5">(3)</span>
            </Button>
          ) : (
            <Button
              onClick={() => handleCallEnvido('real_envido')}
              disabled={!canCallEnvido}
              className="bg-[#3498DB] hover:bg-[#2980B9] text-white font-display py-5 text-xs disabled:opacity-30"
            >
              REAL
              <span className="block text-[9px] mt-0.5">(3)</span>
            </Button>
          )}
          
          <Button
            onClick={() => toast.info('Función de abandonar partida')}
            className="bg-[#34495E] hover:bg-[#2C3E50] text-white font-display py-5 text-xs"
          >
            MAZO
          </Button>
        </div>
      </div>

      {/* Chat Drawer */}
      <AnimatePresence>
        {showChat && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25 }}
            className="fixed inset-x-0 bottom-0 bg-[#0d1f14]/95 backdrop-blur border-t border-white/10 z-40 h-[60vh] flex flex-col"
          >
            <div className="p-3 border-b border-white/10 flex justify-between items-center">
              <span className="font-display text-white text-lg">CHAT</span>
              <Button variant="ghost" size="icon" onClick={() => setShowChat(false)} className="text-white">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </div>
            
            <ScrollArea className="flex-1 p-3">
              <div className="space-y-2">
                {chatMessages.length === 0 ? (
                  <p className="text-gray-400 text-center text-sm">Sin mensajes</p>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div key={idx} className={msg.sender_id === user?.id ? 'text-right' : ''}>
                      <span className="text-xs text-gray-400">{msg.sender_username}</span>
                      <p className={`text-sm ${msg.sender_id === user?.id ? 'text-[#FFD700]' : 'text-white'}`}>
                        {msg.message}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            <div className="p-3 border-t border-white/10 flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendChat()}
                placeholder="Mensaje..."
                className="bg-white/10 border-white/20 text-white placeholder:text-gray-400"
                data-testid="chat-input"
              />
              <Button onClick={handleSendChat} className="bg-[#FFD700] hover:bg-[#FFC700] text-[#0f2818]" data-testid="send-chat-btn">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GameTable;
