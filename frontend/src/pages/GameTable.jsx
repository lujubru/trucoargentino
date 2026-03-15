import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, MessageCircle, Users, Trophy, 
  Send, Volume2, VolumeX 
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
  const { socket, joinTable, leaveTable, playCard, callTruco, respondTruco, callEnvido, sendTableChat } = useSocket();
  
  const [game, setGame] = useState(null);
  const [table, setTable] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [waitingForResponse, setWaitingForResponse] = useState(null);

  useEffect(() => {
    fetchGameData();
    joinTable(tableId);

    return () => {
      leaveTable(tableId);
    };
  }, [tableId]);

  useEffect(() => {
    if (!socket) return;

    socket.on('game_update', handleGameUpdate);
    socket.on('game_started', handleGameStarted);
    socket.on('game_finished', handleGameFinished);
    socket.on('truco_called', handleTrucoCalled);
    socket.on('truco_response', handleTrucoResponse);
    socket.on('envido_called', handleEnvidoCalled);
    socket.on('table_chat', handleTableChat);

    return () => {
      socket.off('game_update', handleGameUpdate);
      socket.off('game_started', handleGameStarted);
      socket.off('game_finished', handleGameFinished);
      socket.off('truco_called', handleTrucoCalled);
      socket.off('truco_response', handleTrucoResponse);
      socket.off('envido_called', handleEnvidoCalled);
      socket.off('table_chat', handleTableChat);
    };
  }, [socket]);

  const fetchGameData = async () => {
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
  };

  const handleGameUpdate = async () => {
    try {
      const gameRes = await api.get(`/games/table/${tableId}`);
      setGame(gameRes.data);
    } catch (error) {
      console.error('Error updating game:', error);
    }
  };

  const handleGameStarted = () => {
    toast.success('¡La partida comenzó!');
    fetchGameData();
  };

  const handleGameFinished = (data) => {
    const myTeam = game?.players?.find(p => p.id === user?.id)?.team;
    if (data.winner_team === myTeam) {
      toast.success(`¡Ganaste! Premio: $${data.prize_per_winner.toFixed(0)}`);
    } else {
      toast.error('Perdiste la partida');
    }
    fetchGameData();
  };

  const handleTrucoCalled = (data) => {
    if (data.caller_id !== user?.id) {
      setWaitingForResponse({ type: 'truco', call: data.call_type });
      toast.info(`¡${data.call_type.toUpperCase()}!`, { duration: 5000 });
    }
  };

  const handleTrucoResponse = (data) => {
    setWaitingForResponse(null);
    toast.info(data.response === 'quiero' ? '¡QUIERO!' : 'No quiero...');
  };

  const handleEnvidoCalled = (data) => {
    if (data.caller_id !== user?.id) {
      setWaitingForResponse({ type: 'envido', call: data.call_type });
      toast.info(`¡${data.call_type.replace('_', ' ').toUpperCase()}!`, { duration: 5000 });
    }
  };

  const handleTableChat = (msg) => {
    setChatMessages(prev => [...prev, msg]);
  };

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
      await callTruco(game.id, callType);
    } catch (error) {
      toast.error('Error al cantar');
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
      await callEnvido(game.id, callType);
    } catch (error) {
      toast.error('Error al cantar envido');
    }
  };

  const handleSendChat = () => {
    if (!newMessage.trim()) return;
    sendTableChat(tableId, newMessage, false);
    setNewMessage('');
  };

  const isMyTurn = game?.current_turn === user?.id;
  const myHand = game?.players_hands?.[user?.id];
  const myTeam = game?.players?.find(p => p.id === user?.id)?.team;
  const canCallTruco = isMyTurn && !game?.truco_state;
  const canCallEnvido = isMyTurn && game?.current_hand === 1 && !game?.envido_state;

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
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al lobby
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col">
      {/* Header */}
      <header className="border-b border-white/5 bg-[#0A0A0A] p-4">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          {/* Score */}
          <div className="flex items-center gap-8">
            <div className="text-center">
              <p className="text-xs text-[#2ECC71] mb-1">EQUIPO 1</p>
              <p className="font-mono text-2xl text-white">{game?.team1_score || 0}</p>
            </div>
            <div className="text-gray-500">vs</div>
            <div className="text-center">
              <p className="text-xs text-[#E74C3C] mb-1">EQUIPO 2</p>
              <p className="font-mono text-2xl text-white">{game?.team2_score || 0}</p>
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
            >
              <MessageCircle className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Game Area */}
      <div className="flex-1 table-felt relative overflow-hidden">
        {/* Round info */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-center">
          <span className="text-white/50 text-sm">
            Ronda {game?.current_round || 1} - Mano {game?.current_hand || 1}
          </span>
          {isMyTurn && (
            <p className="text-[#FFD700] font-display animate-pulse">TU TURNO</p>
          )}
        </div>

        {/* Played cards in center */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-4">
          {game?.round_cards?.map((played, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <PlayingCard card={played.card} size="md" />
            </motion.div>
          ))}
        </div>

        {/* Truco/Envido response */}
        <AnimatePresence>
          {waitingForResponse && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-20 left-1/2 -translate-x-1/2 bg-[#0A0A0A]/90 backdrop-blur p-4 rounded-xl border border-white/10"
            >
              <p className="text-white text-center mb-3">
                ¿Aceptás {waitingForResponse.call.toUpperCase()}?
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={() => handleRespondTruco('quiero')}
                  className="bg-[#2ECC71] hover:bg-[#27AE60]"
                >
                  QUIERO
                </Button>
                <Button
                  onClick={() => handleRespondTruco('no_quiero')}
                  className="bg-[#E74C3C] hover:bg-[#C0392B]"
                >
                  NO QUIERO
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action buttons */}
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 flex gap-3">
          {canCallEnvido && (
            <>
              <Button
                onClick={() => handleCallEnvido('envido')}
                className="bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/30 hover:bg-[#FFD700]/30"
                data-testid="envido-btn"
              >
                ENVIDO
              </Button>
              <Button
                onClick={() => handleCallEnvido('real_envido')}
                className="bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/30 hover:bg-[#FFD700]/30"
              >
                REAL ENVIDO
              </Button>
            </>
          )}
          
          {canCallTruco && (
            <Button
              onClick={() => handleCallTruco('truco')}
              className="bg-[#E74C3C] hover:bg-[#C0392B] text-white font-display text-lg px-6"
              data-testid="truco-btn"
            >
              ¡TRUCO!
            </Button>
          )}
          
          {game?.truco_state === 'truco' && isMyTurn && (
            <Button
              onClick={() => handleCallTruco('retruco')}
              className="bg-[#E74C3C] hover:bg-[#C0392B] text-white"
            >
              RETRUCO
            </Button>
          )}
          
          {game?.truco_state === 'retruco' && isMyTurn && (
            <Button
              onClick={() => handleCallTruco('vale_cuatro')}
              className="bg-[#E74C3C] hover:bg-[#C0392B] text-white"
            >
              VALE 4
            </Button>
          )}
        </div>

        {/* My hand */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <div className="flex gap-2 md:gap-4">
            {myHand?.cards?.map((card, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                onClick={() => {
                  if (isMyTurn) {
                    if (selectedCard === idx) {
                      handlePlayCard(idx);
                    } else {
                      setSelectedCard(idx);
                    }
                  }
                }}
                className={`cursor-pointer transition-transform ${
                  selectedCard === idx ? '-translate-y-4' : ''
                } ${!isMyTurn ? 'opacity-70' : ''}`}
                data-testid={`card-${idx}`}
              >
                <PlayingCard card={card} size="lg" />
              </motion.div>
            ))}
          </div>
          {myHand?.envido_points && (
            <p className="text-center text-[#FFD700] text-sm mt-2">
              Envido: {myHand.envido_points}
            </p>
          )}
        </div>
      </div>

      {/* Chat drawer */}
      <AnimatePresence>
        {showChat && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="fixed right-0 top-0 bottom-0 w-80 bg-[#0A0A0A] border-l border-white/10 z-50 flex flex-col"
          >
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
              <span className="font-display text-white">CHAT</span>
              <Button variant="ghost" size="icon" onClick={() => setShowChat(false)}>
                <ArrowLeft className="w-5 h-5 text-gray-400" />
              </Button>
            </div>
            
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-2">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={msg.sender_id === user?.id ? 'text-right' : ''}>
                    <span className="text-xs text-gray-500">{msg.sender_username}</span>
                    <p className={`text-sm ${msg.sender_id === user?.id ? 'text-[#FFD700]' : 'text-white'}`}>
                      {msg.message}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="p-4 border-t border-white/10 flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendChat()}
                placeholder="Mensaje..."
                className="bg-white/5 border-white/10 text-white"
              />
              <Button onClick={handleSendChat} className="btn-gold px-3">
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
