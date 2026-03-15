import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Wallet, Plus, History, Users, LogOut, Spade, 
  DollarSign, Trophy, MessageCircle, Settings, Copy, Check,
  ArrowDownToLine, Headphones
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import DepositModal from '../components/DepositModal';
import WithdrawalModal from '../components/WithdrawalModal';
import CreatePrivateTableModal from '../components/CreatePrivateTableModal';
import JoinPrivateTableModal from '../components/JoinPrivateTableModal';
import GlobalChat from '../components/GlobalChat';
import AdminChat from '../components/AdminChat';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout, api, refreshUser } = useAuth();
  const [tables, setTables] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [gameHistory, setGameHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdrawal, setShowWithdrawal] = useState(false);
  const [showCreatePrivate, setShowCreatePrivate] = useState(false);
  const [showJoinPrivate, setShowJoinPrivate] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showAdminChat, setShowAdminChat] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [tablesRes, tournamentsRes, depositsRes, withdrawalsRes, historyRes] = await Promise.all([
        api.get('/tables'),
        api.get('/tournaments'),
        api.get('/cashbank/deposits'),
        api.get('/cashbank/withdrawals'),
        api.get('/history/games')
      ]);
      setTables(tablesRes.data);
      setTournaments(tournamentsRes.data);
      setDeposits(depositsRes.data);
      setWithdrawals(withdrawalsRes.data);
      setGameHistory(historyRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinTable = async (tableId) => {
    try {
      const res = await api.post(`/tables/${tableId}/join`);
      toast.success('¡Te uniste a la mesa!');
      await refreshUser();
      navigate(`/game/${res.data.table_id || tableId}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al unirse');
    }
  };

  const handleJoinTournament = async (tournamentId) => {
    try {
      const res = await api.post(`/tournaments/${tournamentId}/join`);
      toast.success(res.data.message);
      await refreshUser();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al inscribirse');
    }
  };

  const handleCancelTournament = async (tournamentId) => {
    try {
      const res = await api.post(`/tournaments/${tournamentId}/cancel`);
      toast.success(res.data.message);
      await refreshUser();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al cancelar');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-[#050505]">
      {/* Header */}
      <header className="border-b border-white/5 bg-[#0A0A0A]">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Spade className="w-8 h-8 text-[#FFD700]" />
              <span className="font-display text-xl tracking-widest text-white hidden sm:inline">
                TRUCO ARGENTINO
              </span>
            </div>
            
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowAdminChat(!showAdminChat)}
                className="text-gray-400 hover:text-[#2ECC71]"
                data-testid="admin-chat-toggle-btn"
                title="Chat con Soporte"
              >
                <Headphones className="w-5 h-5" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowChat(!showChat)}
                className="text-gray-400 hover:text-[#FFD700]"
                data-testid="chat-toggle-btn"
              >
                <MessageCircle className="w-5 h-5" />
              </Button>
              
              {user?.is_admin && (
                <Button
                  variant="ghost"
                  onClick={() => navigate('/admin')}
                  className="text-gray-400 hover:text-[#FFD700]"
                  data-testid="admin-link"
                >
                  <Settings className="w-5 h-5" />
                </Button>
              )}
              
              <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg">
                <Wallet className="w-4 h-4 text-[#FFD700]" />
                <span className="font-mono text-[#FFD700]" data-testid="user-balance">
                  {formatMoney(user?.cashbank || 0)}
                </span>
              </div>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="text-gray-400 hover:text-red-500"
                data-testid="logout-btn"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Welcome */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h1 className="font-display text-3xl text-white mb-2">
                HOLA, <span className="text-[#FFD700]">{user?.username?.toUpperCase()}</span>
              </h1>
              <p className="text-gray-400">¿Listo para jugar?</p>
            </motion.div>

            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-2 sm:grid-cols-4 gap-3"
            >
              <Button
                onClick={() => setShowDeposit(true)}
                className="btn-gold h-14 text-sm"
                data-testid="deposit-btn"
              >
                <Plus className="w-4 h-4 mr-1" />
                Depositar
              </Button>
              <Button
                onClick={() => setShowWithdrawal(true)}
                className="bg-[#E74C3C] hover:bg-[#C0392B] h-14 text-sm text-white"
                data-testid="withdrawal-btn"
              >
                <ArrowDownToLine className="w-4 h-4 mr-1" />
                Retirar
              </Button>
              <Button
                onClick={() => setShowCreatePrivate(true)}
                className="bg-[#2ECC71] hover:bg-[#27AE60] h-14 text-sm text-white"
                data-testid="create-private-btn"
              >
                <Users className="w-4 h-4 mr-1" />
                Crear Mesa
              </Button>
              <Button
                onClick={() => setShowJoinPrivate(true)}
                variant="outline"
                className="border-white/20 text-white hover:bg-white/5 h-14 text-sm"
                data-testid="join-private-btn"
              >
                <Copy className="w-4 h-4 mr-1" />
                Código
              </Button>
            </motion.div>

            {/* Tabs for Tables and Tournaments */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Tabs defaultValue="tables">
                <TabsList className="bg-white/5 mb-4">
                  <TabsTrigger value="tables" className="data-[state=active]:bg-[#FFD700] data-[state=active]:text-black">
                    Mesas Públicas
                  </TabsTrigger>
                  <TabsTrigger value="tournaments" className="data-[state=active]:bg-[#2ECC71] data-[state=active]:text-white">
                    Torneos
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="tables">
                  {loading ? (
                    <div className="flex justify-center py-12">
                      <div className="spinner" />
                    </div>
                  ) : tables.length === 0 ? (
                    <Card className="bg-white/5 border-white/5">
                      <CardContent className="py-12 text-center">
                        <Users className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                        <p className="text-gray-400">No hay mesas disponibles</p>
                        <p className="text-gray-500 text-sm">Las mesas públicas son creadas por el administrador</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-4">
                      {tables.map((table) => (
                        <Card 
                          key={table.id} 
                          className="table-card bg-white/5 border-white/5 hover:border-[#FFD700]/30"
                          data-testid={`table-${table.id}`}
                        >
                          <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-3 mb-2">
                                  <span className="font-display text-xl text-white">
                                    {table.modality}
                                  </span>
                                  <span className={`status-badge ${table.with_flor ? 'status-approved' : 'status-pending'}`}>
                                    {table.with_flor ? 'CON FLOR' : 'SIN FLOR'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-gray-400">
                                  <span className="flex items-center gap-1">
                                    <DollarSign className="w-4 h-4" />
                                    {formatMoney(table.entry_cost)}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Users className="w-4 h-4" />
                                    {table.players?.length || 0}/{table.max_players}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Trophy className="w-4 h-4" />
                                    A {table.points_to_win} puntos
                                  </span>
                                </div>
                              </div>
                              <Button
                                onClick={() => handleJoinTable(table.id)}
                                className="btn-gold"
                                disabled={user?.cashbank < table.entry_cost}
                                data-testid={`join-table-${table.id}`}
                              >
                                UNIRSE
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="tournaments">
                  {loading ? (
                    <div className="flex justify-center py-12">
                      <div className="spinner" />
                    </div>
                  ) : tournaments.length === 0 ? (
                    <Card className="bg-white/5 border-white/5">
                      <CardContent className="py-12 text-center">
                        <Trophy className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                        <p className="text-gray-400">No hay torneos disponibles</p>
                        <p className="text-gray-500 text-sm">Los torneos son creados por el administrador</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-4">
                      {tournaments.map((tournament) => {
                        const isRegistered = tournament.registered_players?.some(p => p.id === user?.id);
                        const spotsLeft = tournament.total_players - (tournament.registered_players?.length || 0);
                        
                        return (
                          <Card 
                            key={tournament.id} 
                            className="table-card bg-white/5 border-white/5 hover:border-[#2ECC71]/30"
                            data-testid={`tournament-${tournament.id}`}
                          >
                            <CardContent className="p-6">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="flex items-center gap-3 mb-2">
                                    <span className="font-display text-xl text-white">
                                      {tournament.name}
                                    </span>
                                    <span className={`status-badge ${tournament.status === 'registration' ? 'status-pending' : 'status-approved'}`}>
                                      {tournament.status === 'registration' ? 'INSCRIPCIÓN' : 'EN CURSO'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-4 text-sm text-gray-400 mb-2">
                                    <span>{tournament.modality}</span>
                                    <span>{tournament.num_tables} mesas</span>
                                    <span>{formatMoney(tournament.entry_cost)} entrada</span>
                                    <span>{tournament.with_flor ? 'Con flor' : 'Sin flor'}</span>
                                  </div>
                                  <div className="flex items-center gap-4 text-xs text-gray-500">
                                    <span>🥇 {tournament.first_place_percentage}%</span>
                                    <span>🥈 {tournament.second_place_percentage}%</span>
                                    <span className="text-[#FFD700]">
                                      {tournament.registered_players?.length || 0}/{tournament.total_players} jugadores
                                    </span>
                                  </div>
                                </div>
                                <div>
                                  {isRegistered ? (
                                    <Button
                                      onClick={() => handleCancelTournament(tournament.id)}
                                      className="bg-[#E74C3C] hover:bg-[#C0392B]"
                                      disabled={tournament.status !== 'registration'}
                                      data-testid={`cancel-tournament-${tournament.id}`}
                                    >
                                      CANCELAR
                                    </Button>
                                  ) : (
                                    <Button
                                      onClick={() => handleJoinTournament(tournament.id)}
                                      className="bg-[#2ECC71] hover:bg-[#27AE60]"
                                      disabled={user?.cashbank < tournament.entry_cost || spotsLeft <= 0}
                                      data-testid={`join-tournament-${tournament.id}`}
                                    >
                                      INSCRIBIRSE
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Recent Deposits */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="bg-white/5 border-white/5">
                <CardHeader>
                  <CardTitle className="font-display text-lg text-white flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-[#FFD700]" />
                    MIS DEPÓSITOS
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {deposits.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-4">Sin depósitos</p>
                  ) : (
                    <div className="space-y-3">
                      {deposits.slice(0, 5).map((deposit) => (
                        <div 
                          key={deposit.id}
                          className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                        >
                          <div>
                            <span className="font-mono text-white">
                              {formatMoney(deposit.amount)}
                            </span>
                            <span className="text-gray-500 text-xs block">
                              {new Date(deposit.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <span className={`status-badge status-${deposit.status}`}>
                            {deposit.status === 'pending' ? 'PENDIENTE' : 
                             deposit.status === 'approved' ? 'APROBADO' : 'RECHAZADO'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Recent Withdrawals */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 }}
            >
              <Card className="bg-white/5 border-white/5">
                <CardHeader>
                  <CardTitle className="font-display text-lg text-white flex items-center gap-2">
                    <ArrowDownToLine className="w-5 h-5 text-[#E74C3C]" />
                    MIS RETIROS
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {withdrawals.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-4">Sin retiros</p>
                  ) : (
                    <div className="space-y-3">
                      {withdrawals.slice(0, 5).map((withdrawal) => (
                        <div 
                          key={withdrawal.id}
                          className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                        >
                          <div>
                            <span className="font-mono text-white">
                              {formatMoney(withdrawal.amount)}
                            </span>
                            <span className="text-gray-500 text-xs block">
                              {withdrawal.alias}
                            </span>
                          </div>
                          <span className={`status-badge status-${withdrawal.status}`}>
                            {withdrawal.status === 'pending' ? 'PENDIENTE' : 
                             withdrawal.status === 'approved' ? 'APROBADO' : 'RECHAZADO'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Game History */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="bg-white/5 border-white/5">
                <CardHeader>
                  <CardTitle className="font-display text-lg text-white flex items-center gap-2">
                    <History className="w-5 h-5 text-[#FFD700]" />
                    HISTORIAL
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {gameHistory.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-4">Sin partidas</p>
                  ) : (
                    <div className="space-y-3">
                      {gameHistory.slice(0, 5).map((game) => {
                        const isWinner = game.winner_team === 
                          game.players?.find(p => p.id === user?.id)?.team;
                        return (
                          <div 
                            key={game.id}
                            className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                          >
                            <div>
                              <span className="text-white text-sm">
                                {game.modality}
                              </span>
                              <span className="text-gray-500 text-xs block">
                                {game.team1_score} - {game.team2_score}
                              </span>
                            </div>
                            <span className={`status-badge ${isWinner ? 'status-approved' : 'status-rejected'}`}>
                              {isWinner ? 'GANASTE' : 'PERDISTE'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <DepositModal 
        open={showDeposit} 
        onClose={() => {
          setShowDeposit(false);
          fetchData();
          refreshUser();
        }} 
      />
      <WithdrawalModal 
        open={showWithdrawal} 
        onClose={() => {
          setShowWithdrawal(false);
          fetchData();
          refreshUser();
        }} 
      />
      <CreatePrivateTableModal 
        open={showCreatePrivate} 
        onClose={() => setShowCreatePrivate(false)}
        onCreated={(code) => {
          setShowCreatePrivate(false);
          refreshUser();
          toast.success(`Mesa creada! Código: ${code}`);
        }}
      />
      <JoinPrivateTableModal 
        open={showJoinPrivate} 
        onClose={() => setShowJoinPrivate(false)}
      />

      {/* Global Chat */}
      {showChat && (
        <GlobalChat onClose={() => setShowChat(false)} />
      )}

      {/* Admin Chat */}
      {showAdminChat && (
        <AdminChat onClose={() => setShowAdminChat(false)} />
      )}
    </div>
  );
};

export default Dashboard;
