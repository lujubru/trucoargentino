import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, MessageCircle, Users, 
  Send, Volume2, VolumeX, Flower2
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
      setWaitingForResponse(null); // Clear any pending response after game update
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
    handleGameUpdate();
  }, [handleGameUpdate]);

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
    handleGameUpdate();
  }, [handleGameUpdate]);

  const handleFlorCalled = useCallback((data) => {
    toast.success(`¡FLOR! ${data.caller_username} tiene flor (+3 puntos)`, { duration: 4000 });
    handleGameUpdate();
  }, [handleGameUpdate]);

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
  
  // Envido: only before first card is played and not resolved
  const canCallEnvido = !game?.first_card_played && 
                        !game?.envido_resolved && 
                        !game?.envido_pending_response &&
                        !game?.truco_pending_response;
  
  // Truco: can call if no pending response or if we can raise
  const canCallTruco = !game?.truco_pending_response && !game?.truco_state;
  const canRaiseTruco = game?.truco_pending_response && 
                        game?.truco_caller_team !== myTeam;
  
  // Flor: if has flor, before first card, and flor enabled
  const canCallFlor = game?.with_flor && 
                      myHand?.has_flor && 
                      !myHand?.flor_announced &&
                      !game?.first_card_played &&
                      !game?.flor_resolved;

  // Can play card: my turn and no pending responses
  const canPlayCard = isMyTurn && 
                      !game?.truco_pending_response && 
                      !game?.envido_pending_response;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  // Waiting for players
  if (table?.status === 'waiting') {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <Users className="w-16 h-16 text-[#FFD700] mx-auto mb-4" />
          <h1 className="font-display text-3xl text-white mb-4">ESPERANDO JUGADORES</h1>
          <p className="text-gray-400 mb-6">
            {table.players?.length || 0} / {table.max_players} jugadores
          </p>
          
          {table.code && (
            <div className="bg-white/5 p-6 rounded-xl mb-6">
              <p className="text-gray-400 text-sm mb-2">Código de la mesa:</p>
              <p className="font-mono text-3xl text-[#FFD700] tracking-widest">{table.code}</p>
            </div>
          )}
          
          <div className="space-y-2">
            {table.players?.map((player, idx) => (
              <div key={player.id} className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-lg">
                <div className={`w-3 h-3 rounded-full ${player.team === 1 ? 'bg-[#2ECC71]' : 'bg-[#E74C3C]'}`} />
                <span className="text-white">{player.username}</span>
                {player.id === user?.id && <span className="text-[#FFD700] text-sm">(Vos)</span>}
              </div>
            ))}
          </div>

          <Button
            onClick={() => navigate('/dashboard')}
            variant="outline"
            className="mt-8 border-white/20 text-white"
            data-testid="back-to-lobby-btn"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al lobby
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] flex">
      {/* Main game area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="border-b border-white/5 bg-[#0A0A0A] p-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => navigate('/dashboard')}
              className="text-gray-400 hover:text-white"
              data-testid="back-btn"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>

            {/* Score */}
            <div className="flex items-center gap-8">
              <div className="text-center">
                <p className="text-xs text-[#2ECC71] mb-1">NOSOTROS</p>
                <p className="font-mono text-3xl text-white" data-testid="team1-score">
                  {myTeam === 1 ? game?.team1_score : game?.team2_score || 0}
                </p>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-gray-500 text-xs">A {game?.points_to_win || 15}</span>
                <span className="text-gray-600">vs</span>
              </div>
              <div className="text-center">
                <p className="text-xs text-[#E74C3C] mb-1">ELLOS</p>
                <p className="font-mono text-3xl text-white" data-testid="team2-score">
                  {myTeam === 1 ? game?.team2_score : game?.team1_score || 0}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="text-gray-400"
              >
                {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowChat(!showChat)}
                className="text-gray-400"
                data-testid="chat-toggle-btn"
              >
                <MessageCircle className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </header>

        {/* Game Area */}
        <div className="flex-1 flex">
          {/* Action buttons - LEFT SIDE */}
          <div className="w-52 bg-[#0A0A0A] border-r border-white/5 p-4 flex flex-col gap-3">
            <div className="text-center mb-4">
              <p className="text-gray-500 text-xs">Ronda {game?.current_round || 1}</p>
              <p className="text-gray-400 text-sm">Mano {game?.current_hand || 1}/3</p>
              {game?.truco_state && (
                <p className="text-[#E74C3C] font-display text-sm mt-2">
                  {game.truco_state.replace('_', ' ').toUpperCase()} ({game.truco_points} pts)
                </p>
              )}
              {game?.with_flor && (
                <p className="text-[#9B59B6] text-xs mt-1">Con Flor</p>
              )}
            </div>

            {isMyTurn && !game?.truco_pending_response && !game?.envido_pending_response && (
              <p className="text-[#FFD700] text-center font-display animate-pulse mb-2">
                TU TURNO
              </p>
            )}

            {/* Flor button - only shown if has flor and can call */}
            {canCallFlor && (
              <Button
                onClick={handleCallFlor}
                className="w-full bg-[#9B59B6] hover:bg-[#8E44AD] text-white font-display"
                data-testid="flor-btn"
              >
                <Flower2 className="w-4 h-4 mr-2" />
                ¡FLOR! (3 pts)
              </Button>
            )}

            {/* Envido buttons - only before first card */}
            {canCallEnvido && (
              <div className="space-y-2">
                <p className="text-gray-500 text-xs text-center">ENVIDO</p>
                <Button
                  onClick={() => handleCallEnvido('envido')}
                  className="w-full bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/30 hover:bg-[#FFD700]/30 text-sm"
                  data-testid="envido-btn"
                >
                  Envido
                </Button>
                <Button
                  onClick={() => handleCallEnvido('real_envido')}
                  className="w-full bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/30 hover:bg-[#FFD700]/30 text-sm"
                  data-testid="real-envido-btn"
                >
                  Real Envido
                </Button>
                <Button
                  onClick={() => handleCallEnvido('falta_envido')}
                  className="w-full bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/30 hover:bg-[#FFD700]/30 text-sm"
                  data-testid="falta-envido-btn"
                >
                  Falta Envido
                </Button>
              </div>
            )}

            {/* Envido resolved indicator */}
            {game?.envido_resolved && (
              <p className="text-gray-500 text-xs text-center italic">Envido jugado</p>
            )}

            {/* First card indicator */}
            {game?.first_card_played && !game?.envido_resolved && (
              <p className="text-gray-500 text-xs text-center italic">Primera carta jugada</p>
            )}

            {/* Truco buttons */}
            <div className="space-y-2 mt-4">
              <p className="text-gray-500 text-xs text-center">TRUCO</p>
              
              {/* Initial truco call */}
              {canCallTruco && (
                <Button
                  onClick={() => handleCallTruco('truco')}
                  className="w-full bg-[#E74C3C] hover:bg-[#C0392B] text-white font-display"
                  data-testid="truco-btn"
                >
                  ¡TRUCO! (2 pts)
                </Button>
              )}
              
              {/* Retruco - only if opponent called truco and it's pending */}
              {canRaiseTruco && game?.truco_state === 'truco' && (
                <Button
                  onClick={() => handleCallTruco('retruco')}
                  className="w-full bg-[#E74C3C] hover:bg-[#C0392B] text-white font-display"
                  data-testid="retruco-btn"
                >
                  RETRUCO (3 pts)
                </Button>
              )}
              
              {/* Vale cuatro - only if opponent called retruco and it's pending */}
              {canRaiseTruco && game?.truco_state === 'retruco' && (
                <Button
                  onClick={() => handleCallTruco('vale_cuatro')}
                  className="w-full bg-[#E74C3C] hover:bg-[#C0392B] text-white font-display"
                  data-testid="vale-cuatro-btn"
                >
                  VALE 4 (4 pts)
                </Button>
              )}
              
              {/* Show current truco state if accepted */}
              {game?.truco_state && !game?.truco_pending_response && (
                <p className="text-center text-[#E74C3C] text-xs">
                  {game.truco_state.replace('_', ' ').toUpperCase()} aceptado
                </p>
              )}
            </div>

            {/* My envido points */}
            {myHand?.envido_points !== undefined && (
              <div className="mt-auto text-center p-3 bg-white/5 rounded-lg">
                <p className="text-gray-500 text-xs">Tu envido</p>
                <p className="text-[#FFD700] font-mono text-2xl">{myHand.envido_points}</p>
                {myHand?.has_flor && (
                  <p className="text-[#9B59B6] text-xs mt-1 flex items-center justify-center gap-1">
                    <Flower2 className="w-3 h-3" />
                    FLOR ({myHand.flor_points})
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Table */}
          <div className="flex-1 table-felt relative overflow-hidden">
            {/* Truco response overlay */}
            <AnimatePresence>
              {waitingForResponse && waitingForResponse.type === 'truco' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="absolute inset-0 bg-black/70 z-20 flex items-center justify-center"
                >
                  <div className="bg-[#0A0A0A] p-8 rounded-xl border border-white/10 text-center">
                    <p className="text-[#E74C3C] font-display text-4xl mb-2">
                      ¡{waitingForResponse.call.replace('_', ' ').toUpperCase()}!
                    </p>
                    <p className="text-gray-400 mb-6">Vale {waitingForResponse.points} puntos</p>
                    <div className="flex gap-4">
                      <Button
                        onClick={() => handleRespondTruco('quiero')}
                        className="bg-[#2ECC71] hover:bg-[#27AE60] text-white px-8 py-3 text-lg"
                        data-testid="quiero-truco-btn"
                      >
                        QUIERO
                      </Button>
                      <Button
                        onClick={() => handleRespondTruco('no_quiero')}
                        className="bg-[#E74C3C] hover:bg-[#C0392B] text-white px-8 py-3 text-lg"
                        data-testid="no-quiero-truco-btn"
                      >
                        NO QUIERO
                      </Button>
                    </div>
                    {/* Option to raise */}
                    {waitingForResponse.call === 'truco' && (
                      <Button
                        onClick={() => {
                          handleCallTruco('retruco');
                          setWaitingForResponse(null);
                        }}
                        className="mt-4 bg-[#9B59B6] hover:bg-[#8E44AD] text-white"
                        data-testid="raise-retruco-btn"
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
                        className="mt-4 bg-[#9B59B6] hover:bg-[#8E44AD] text-white"
                        data-testid="raise-vale-cuatro-btn"
                      >
                        VALE CUATRO (4 pts)
                      </Button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Envido response overlay */}
            <AnimatePresence>
              {waitingForResponse && waitingForResponse.type === 'envido' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="absolute inset-0 bg-black/70 z-20 flex items-center justify-center"
                >
                  <div className="bg-[#0A0A0A] p-8 rounded-xl border border-white/10 text-center">
                    <p className="text-[#FFD700] font-display text-4xl mb-2">
                      ¡{waitingForResponse.call.replace('_', ' ').toUpperCase()}!
                    </p>
                    <p className="text-gray-400 mb-2">Vale {waitingForResponse.points} puntos</p>
                    <p className="text-gray-500 text-sm mb-6">Tu envido: {myHand?.envido_points}</p>
                    <div className="flex gap-4">
                      <Button
                        onClick={() => handleRespondEnvido('quiero')}
                        className="bg-[#2ECC71] hover:bg-[#27AE60] text-white px-8 py-3 text-lg"
                        data-testid="quiero-envido-btn"
                      >
                        QUIERO
                      </Button>
                      <Button
                        onClick={() => handleRespondEnvido('no_quiero')}
                        className="bg-[#E74C3C] hover:bg-[#C0392B] text-white px-8 py-3 text-lg"
                        data-testid="no-quiero-envido-btn"
                      >
                        NO QUIERO
                      </Button>
                    </div>
                    {/* Option to raise envido */}
                    <div className="flex gap-2 mt-4 justify-center">
                      {waitingForResponse.call === 'envido' && (
                        <>
                          <Button
                            onClick={() => {
                              handleCallEnvido('envido');
                              setWaitingForResponse(null);
                            }}
                            className="bg-[#FFD700]/30 text-[#FFD700] text-sm"
                          >
                            +Envido
                          </Button>
                          <Button
                            onClick={() => {
                              handleCallEnvido('real_envido');
                              setWaitingForResponse(null);
                            }}
                            className="bg-[#FFD700]/30 text-[#FFD700] text-sm"
                          >
                            Real Envido
                          </Button>
                        </>
                      )}
                      <Button
                        onClick={() => {
                          handleCallEnvido('falta_envido');
                          setWaitingForResponse(null);
                        }}
                        className="bg-[#FFD700]/30 text-[#FFD700] text-sm"
                      >
                        Falta Envido
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Previous hands results */}
            {game?.hand_results?.length > 0 && (
              <div className="absolute top-4 left-4 bg-black/50 backdrop-blur rounded-lg p-3">
                <p className="text-gray-400 text-xs mb-2">Manos anteriores:</p>
                <div className="space-y-1">
                  {game.hand_results.map((result, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      <span className="text-gray-500">Mano {idx + 1}:</span>
                      {result.is_parda ? (
                        <span className="text-yellow-500">Parda</span>
                      ) : (
                        <span className={result.winner_team === myTeam ? 'text-[#2ECC71]' : 'text-[#E74C3C]'}>
                          {result.winner_team === myTeam ? 'Ganamos' : 'Perdimos'}
                        </span>
                      )}
                      <div className="flex gap-1 ml-2">
                        {result.cards?.map((c, i) => (
                          <span key={i} className="text-gray-400">
                            {c.card.number}{c.card.suit[0].toUpperCase()}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Current round cards played */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="flex gap-6 items-end">
                {game?.round_cards?.map((played, idx) => {
                  const player = game.players?.find(p => p.id === played.player_id);
                  const isMyCard = played.player_id === user?.id;
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: -50, rotate: -10 }}
                      animate={{ opacity: 1, y: 0, rotate: 0 }}
                      className="flex flex-col items-center"
                    >
                      <PlayingCard card={played.card} size="md" />
                      <span className={`text-xs mt-2 ${isMyCard ? 'text-[#FFD700]' : 'text-gray-400'}`}>
                        {player?.username || 'Jugador'}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* My hand */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
              <div className="flex gap-3 md:gap-4">
                {myHand?.cards?.map((card, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    data-testid={`card-${idx}`}
                  >
                    <PlayingCard 
                      card={card} 
                      size="lg"
                      selected={selectedCard === idx}
                      disabled={!canPlayCard}
                      onClick={() => {
                        if (canPlayCard) {
                          if (selectedCard === idx) {
                            handlePlayCard(idx);
                          } else {
                            setSelectedCard(idx);
                          }
                        }
                      }}
                    />
                  </motion.div>
                ))}
              </div>
              <p className="text-center text-gray-500 text-xs mt-3">
                {canPlayCard 
                  ? 'Hacé click en una carta para seleccionar, doble click para jugar' 
                  : game?.truco_pending_response || game?.envido_pending_response
                    ? 'Esperando respuesta...'
                    : 'Esperando turno...'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Chat drawer */}
      <AnimatePresence>
        {showChat && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: 320 }}
            exit={{ width: 0 }}
            className="bg-[#0A0A0A] border-l border-white/10 flex flex-col overflow-hidden"
          >
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
              <span className="font-display text-white">CHAT</span>
              <Button variant="ghost" size="icon" onClick={() => setShowChat(false)}>
                <ArrowLeft className="w-5 h-5 text-gray-400" />
              </Button>
            </div>
            
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-2">
                {chatMessages.length === 0 ? (
                  <p className="text-gray-500 text-center text-sm">Sin mensajes</p>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div key={idx} className={msg.sender_id === user?.id ? 'text-right' : ''}>
                      <span className="text-xs text-gray-500">{msg.sender_username}</span>
                      <p className={`text-sm ${msg.sender_id === user?.id ? 'text-[#FFD700]' : 'text-white'}`}>
                        {msg.message}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            <div className="p-4 border-t border-white/10 flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendChat()}
                placeholder="Mensaje..."
                className="bg-white/5 border-white/10 text-white"
                data-testid="chat-input"
              />
              <Button onClick={handleSendChat} className="btn-gold px-3" data-testid="send-chat-btn">
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
