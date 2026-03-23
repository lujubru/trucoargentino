import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Users, Wallet, Settings, MessageCircle, Trophy, 
  LogOut, Spade, Check, X, Eye, Ban, UserCheck,
  Plus, DollarSign, Menu, ArrowDownToLine, Send
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { ScrollArea } from '../components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle 
} from '../components/ui/dialog';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const AdminPanel = () => {
  const navigate = useNavigate();
  const { api, logout, user } = useAuth();
  const [activeTab, setActiveTab] = useState('deposits');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Data states
  const [deposits, setDeposits] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [users, setUsers] = useState([]);
  const [tables, setTables] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [games, setGames] = useState([]);
  const [chatThreads, setChatThreads] = useState([]);
  const [selectedChatUser, setSelectedChatUser] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [settings, setSettings] = useState({
    private_table_cost: 100,
    platform_commission: 30
  });
  const [transferData, setTransferData] = useState({
    titular: '',
    banco: '',
    alias: '',
    cbu_cvu: '',
    tipo_cuenta: ''
  });
  
  // Modal states
  const [showCreateTable, setShowCreateTable] = useState(false);
  const [showCreateTournament, setShowCreateTournament] = useState(false);
  const [showReceipt, setShowReceipt] = useState(null);
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const chatScrollRef = useRef(null);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      // Hacer cada llamada de forma independiente para que si una falla no rompa las demás
      const safeGet = async (url, fallback = []) => {
        try {
          const res = await api.get(url);
          return res.data;
        } catch (err) {
          console.warn(`Error fetching ${url}:`, err?.message);
          return fallback;
        }
      };

      const [depositsData, withdrawalsData, usersData, tablesData, tournamentsData, gamesData, settingsData, transferData, chatData] = await Promise.all([
        safeGet('/admin/deposits'),
        safeGet('/admin/withdrawals'),
        safeGet('/admin/users'),
        safeGet('/admin/tables'),
        safeGet('/admin/tournaments'),
        safeGet('/admin/games'),
        safeGet('/admin/settings', { private_table_cost: 100, platform_commission: 30 }),
        safeGet('/cashbank/transfer-data', {}),
        safeGet('/chat/admin', { threads: [] })
      ]);
      
      setDeposits(depositsData);
      setWithdrawals(withdrawalsData);
      setUsers(usersData);
      setTables(tablesData);
      setTournaments(tournamentsData);
      setGames(gamesData);
      setSettings(settingsData);
      setTransferData(transferData);
      setChatThreads(chatData.threads || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveDeposit = async (depositId) => {
    try {
      await api.put(`/admin/deposits/${depositId}`, { status: 'approved' });
      toast.success('Depósito aprobado');
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error');
    }
  };

  const handleRejectDeposit = async (depositId) => {
    try {
      await api.put(`/admin/deposits/${depositId}`, { status: 'rejected' });
      toast.success('Depósito rechazado');
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error');
    }
  };

  const handleApproveWithdrawal = async (withdrawalId) => {
    try {
      await api.put(`/admin/withdrawals/${withdrawalId}`, { status: 'approved' });
      toast.success('Retiro aprobado - Saldo descontado');
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error');
    }
  };

  const handleRejectWithdrawal = async (withdrawalId) => {
    try {
      await api.put(`/admin/withdrawals/${withdrawalId}`, { status: 'rejected' });
      toast.success('Retiro rechazado');
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error');
    }
  };

  const handleSuspendUser = async (userId, suspend = true) => {
    try {
      await api.put(`/admin/users/${userId}/${suspend ? 'suspend' : 'unsuspend'}`);
      toast.success(suspend ? 'Usuario suspendido' : 'Usuario reactivado');
      fetchAllData();
    } catch (error) {
      toast.error('Error');
    }
  };

  const handleUpdateSettings = async () => {
    try {
      await api.put('/admin/settings', settings);
      toast.success('Configuración guardada');
    } catch (error) {
      toast.error('Error al guardar');
    }
  };

  const handleUpdateTransferData = async () => {
    try {
      await api.put('/admin/transfer-data', transferData);
      toast.success('Datos de transferencia actualizados');
    } catch (error) {
      toast.error('Error al guardar');
    }
  };

  const handleCreatePublicTable = async (formData) => {
    try {
      await api.post('/tables/public', formData);
      toast.success('Mesa pública creada');
      setShowCreateTable(false);
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error');
    }
  };

  const handleCreateTournament = async (formData) => {
    try {
      await api.post('/tournaments', formData);
      toast.success('Torneo creado');
      setShowCreateTournament(false);
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error');
    }
  };

  const handleSelectChatUser = async (userId) => {
    try {
      const res = await api.get(`/chat/admin/${userId}`);
      setChatMessages(res.data.messages || []);
      setSelectedChatUser(res.data.user);
      setTimeout(() => {
        chatScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (error) {
      toast.error('Error al cargar chat');
    }
  };

  const handleSendAdminMessage = async () => {
    if (!newMessage.trim() || !selectedChatUser) return;
    try {
      await api.post('/chat/admin', { 
        content: newMessage, 
        recipient_id: selectedChatUser.id 
      });
      setNewMessage('');
      handleSelectChatUser(selectedChatUser.id);
    } catch (error) {
      toast.error('Error al enviar');
    }
  };

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const navItems = [
    { id: 'deposits', label: 'Depósitos', icon: Wallet },
    { id: 'withdrawals', label: 'Retiros', icon: ArrowDownToLine },
    { id: 'users', label: 'Usuarios', icon: Users },
    { id: 'tables', label: 'Mesas', icon: Trophy },
    { id: 'tournaments', label: 'Torneos', icon: Trophy },
    { id: 'games', label: 'Partidas', icon: Spade },
    { id: 'chat', label: 'Chat', icon: MessageCircle },
    { id: 'settings', label: 'Configuración', icon: Settings }
  ];

  const pendingDeposits = deposits.filter(d => d.status === 'pending').length;
  const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending').length;

  return (
    <div className="min-h-screen bg-[#050505] flex">
      {/* Sidebar */}
      <aside className={`admin-sidebar fixed lg:static inset-y-0 left-0 z-50 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform`}>
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Spade className="w-6 h-6 text-[#FFD700]" />
            <span className="font-display text-lg text-white">ADMIN</span>
          </div>
        </div>
        
        <nav className="p-2 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setSidebarOpen(false);
              }}
              className={`admin-nav-item w-full flex items-center gap-3 ${activeTab === item.id ? 'active' : ''}`}
              data-testid={`nav-${item.id}`}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
              {item.id === 'deposits' && pendingDeposits > 0 && (
                <span className="ml-auto bg-[#E74C3C] text-white text-xs px-2 py-0.5 rounded-full">
                  {pendingDeposits}
                </span>
              )}
              {item.id === 'withdrawals' && pendingWithdrawals > 0 && (
                <span className="ml-auto bg-[#E74C3C] text-white text-xs px-2 py-0.5 rounded-full">
                  {pendingWithdrawals}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/5">
          <button
            onClick={() => navigate('/dashboard')}
            className="admin-nav-item w-full flex items-center gap-3"
          >
            <LogOut className="w-5 h-5" />
            <span>Volver al juego</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-0">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between p-4 border-b border-white/5 bg-[#0A0A0A]">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="text-white"
          >
            <Menu className="w-6 h-6" />
          </Button>
          <span className="font-display text-white">{navItems.find(i => i.id === activeTab)?.label}</span>
          <div className="w-10" />
        </header>

        <div className="p-6">
          {/* Deposits Tab */}
          {activeTab === 'deposits' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-6">
                <h1 className="font-display text-2xl text-white">DEPÓSITOS PENDIENTES</h1>
              </div>

              <Tabs defaultValue="pending">
                <TabsList className="bg-white/5 mb-4">
                  <TabsTrigger value="pending" className="data-[state=active]:bg-[#FFD700] data-[state=active]:text-black">
                    Pendientes ({deposits.filter(d => d.status === 'pending').length})
                  </TabsTrigger>
                  <TabsTrigger value="approved" className="data-[state=active]:bg-[#2ECC71] data-[state=active]:text-white">
                    Aprobados
                  </TabsTrigger>
                  <TabsTrigger value="rejected" className="data-[state=active]:bg-[#E74C3C] data-[state=active]:text-white">
                    Rechazados
                  </TabsTrigger>
                </TabsList>

                {['pending', 'approved', 'rejected'].map(status => (
                  <TabsContent key={status} value={status}>
                    <div className="space-y-3">
                      {deposits.filter(d => d.status === status).length === 0 ? (
                        <Card className="bg-white/5 border-white/5">
                          <CardContent className="py-12 text-center">
                            <p className="text-gray-500">No hay depósitos {status === 'pending' ? 'pendientes' : status === 'approved' ? 'aprobados' : 'rechazados'}</p>
                          </CardContent>
                        </Card>
                      ) : (
                        deposits.filter(d => d.status === status).map(deposit => (
                          <Card key={deposit.id} className="bg-white/5 border-white/5">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-white font-medium">{deposit.username}</p>
                                  <p className="text-[#FFD700] font-mono text-xl">{formatMoney(deposit.amount)}</p>
                                  <p className="text-gray-500 text-xs">
                                    {new Date(deposit.created_at).toLocaleString()}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {deposit.receipt_url && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setShowReceipt(deposit.receipt_url)}
                                      className="border-white/20 text-white"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                  )}
                                  {status === 'pending' && (
                                    <>
                                      <Button
                                        size="sm"
                                        onClick={() => handleApproveDeposit(deposit.id)}
                                        className="bg-[#2ECC71] hover:bg-[#27AE60]"
                                        data-testid={`approve-${deposit.id}`}
                                      >
                                        <Check className="w-4 h-4" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={() => handleRejectDeposit(deposit.id)}
                                        className="bg-[#E74C3C] hover:bg-[#C0392B]"
                                        data-testid={`reject-${deposit.id}`}
                                      >
                                        <X className="w-4 h-4" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </motion.div>
          )}

          {/* Withdrawals Tab */}
          {activeTab === 'withdrawals' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-6">
                <h1 className="font-display text-2xl text-white">RETIROS PENDIENTES</h1>
              </div>

              <Tabs defaultValue="pending">
                <TabsList className="bg-white/5 mb-4">
                  <TabsTrigger value="pending" className="data-[state=active]:bg-[#E74C3C] data-[state=active]:text-white">
                    Pendientes ({withdrawals.filter(w => w.status === 'pending').length})
                  </TabsTrigger>
                  <TabsTrigger value="approved" className="data-[state=active]:bg-[#2ECC71] data-[state=active]:text-white">
                    Aprobados
                  </TabsTrigger>
                  <TabsTrigger value="rejected" className="data-[state=active]:bg-gray-500 data-[state=active]:text-white">
                    Rechazados
                  </TabsTrigger>
                </TabsList>

                {['pending', 'approved', 'rejected'].map(status => (
                  <TabsContent key={status} value={status}>
                    <div className="space-y-3">
                      {withdrawals.filter(w => w.status === status).length === 0 ? (
                        <Card className="bg-white/5 border-white/5">
                          <CardContent className="py-12 text-center">
                            <p className="text-gray-500">No hay retiros {status === 'pending' ? 'pendientes' : status === 'approved' ? 'aprobados' : 'rechazados'}</p>
                          </CardContent>
                        </Card>
                      ) : (
                        withdrawals.filter(w => w.status === status).map(withdrawal => (
                          <Card key={withdrawal.id} className="bg-white/5 border-white/5">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-white font-medium">{withdrawal.username}</p>
                                  <p className="text-[#E74C3C] font-mono text-xl">{formatMoney(withdrawal.amount)}</p>
                                  <div className="text-gray-400 text-sm mt-1">
                                    <p>Alias: <span className="text-white">{withdrawal.alias}</span></p>
                                    <p>Titular: <span className="text-white">{withdrawal.titular_name}</span></p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      Saldo al solicitar: {formatMoney(withdrawal.user_balance_at_request)}
                                    </p>
                                  </div>
                                  <p className="text-gray-500 text-xs mt-1">
                                    {new Date(withdrawal.created_at).toLocaleString()}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {status === 'pending' && (
                                    <>
                                      <Button
                                        size="sm"
                                        onClick={() => handleApproveWithdrawal(withdrawal.id)}
                                        className="bg-[#2ECC71] hover:bg-[#27AE60]"
                                        data-testid={`approve-withdrawal-${withdrawal.id}`}
                                      >
                                        <Check className="w-4 h-4" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={() => handleRejectWithdrawal(withdrawal.id)}
                                        className="bg-[#E74C3C] hover:bg-[#C0392B]"
                                        data-testid={`reject-withdrawal-${withdrawal.id}`}
                                      >
                                        <X className="w-4 h-4" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </motion.div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h1 className="font-display text-2xl text-white mb-6">USUARIOS</h1>
              
              <div className="space-y-3">
                {users.map(u => (
                  <Card key={u.id} className="bg-white/5 border-white/5">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-white font-medium">{u.username}</p>
                            {u.is_admin && <span className="status-badge status-approved text-xs">ADMIN</span>}
                            {u.is_suspended && <span className="status-badge status-rejected text-xs">SUSPENDIDO</span>}
                          </div>
                          <p className="text-gray-500 text-sm">{u.email}</p>
                          <p className="text-[#FFD700] font-mono">{formatMoney(u.cashbank)}</p>
                        </div>
                        {!u.is_admin && (
                          <Button
                            size="sm"
                            onClick={() => handleSuspendUser(u.id, !u.is_suspended)}
                            className={u.is_suspended ? 'bg-[#2ECC71]' : 'bg-[#E74C3C]'}
                          >
                            {u.is_suspended ? <UserCheck className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}

          {/* Tables Tab */}
          {activeTab === 'tables' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-6">
                <h1 className="font-display text-2xl text-white">MESAS</h1>
                <Button 
                  onClick={() => setShowCreateTable(true)} 
                  className="btn-gold"
                  data-testid="create-public-table-btn"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Mesa Pública
                </Button>
              </div>

              <div className="grid gap-4">
                {tables.map(table => (
                  <Card key={table.id} className="bg-white/5 border-white/5">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-display text-white">{table.modality}</span>
                            <span className={`status-badge ${table.is_private ? 'status-pending' : 'status-approved'}`}>
                              {table.is_private ? 'PRIVADA' : 'PÚBLICA'}
                            </span>
                            <span className={`status-badge ${
                              table.status === 'waiting' ? 'status-pending' : 
                              table.status === 'playing' ? 'status-approved' : 'status-rejected'
                            }`}>
                              {table.status.toUpperCase()}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-400">
                            <span>{formatMoney(table.entry_cost)} entrada</span>
                            <span>{table.players?.length || 0}/{table.max_players} jugadores</span>
                            <span>{table.with_flor ? 'Con flor' : 'Sin flor'}</span>
                            <span>A {table.points_to_win} puntos</span>
                          </div>
                          {table.code && <p className="text-[#FFD700] font-mono mt-1">Código: {table.code}</p>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}

          {/* Tournaments Tab */}
          {activeTab === 'tournaments' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-6">
                <h1 className="font-display text-2xl text-white">TORNEOS</h1>
                <Button 
                  onClick={() => setShowCreateTournament(true)} 
                  className="bg-[#2ECC71] hover:bg-[#27AE60]"
                  data-testid="create-tournament-btn"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Torneo
                </Button>
              </div>

              <div className="grid gap-4">
                {tournaments.length === 0 ? (
                  <Card className="bg-white/5 border-white/5">
                    <CardContent className="py-12 text-center">
                      <Trophy className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                      <p className="text-gray-400">No hay torneos creados</p>
                    </CardContent>
                  </Card>
                ) : (
                  tournaments.map(tournament => (
                    <Card key={tournament.id} className="bg-white/5 border-white/5">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-display text-lg text-white">{tournament.name}</span>
                              <span className={`status-badge ${
                                tournament.status === 'registration' ? 'status-pending' : 
                                tournament.status === 'in_progress' ? 'status-approved' : 'status-rejected'
                              }`}>
                                {tournament.status === 'registration' ? 'INSCRIPCIÓN' : 
                                 tournament.status === 'in_progress' ? 'EN CURSO' : 'FINALIZADO'}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-400">
                              <span>{tournament.modality}</span>
                              <span>{tournament.num_tables} mesas</span>
                              <span>{formatMoney(tournament.entry_cost)} entrada</span>
                              <span>{tournament.with_flor ? 'Con flor' : 'Sin flor'}</span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
                              <span>🥇 {tournament.first_place_percentage}%</span>
                              <span>🥈 {tournament.second_place_percentage}%</span>
                              <span className="text-[#FFD700]">
                                {tournament.registered_players?.length || 0}/{tournament.total_players} jugadores
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {/* Games Tab */}
          {activeTab === 'games' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h1 className="font-display text-2xl text-white mb-6">PARTIDAS</h1>
              
              <div className="space-y-3">
                {games.map(game => (
                  <Card key={game.id} className="bg-white/5 border-white/5">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-white">{game.modality}</span>
                            <span className={`status-badge ${
                              game.status === 'playing' ? 'status-approved' : 'status-rejected'
                            }`}>
                              {game.status.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-gray-400 text-sm">
                            Equipo 1: {game.team1_score} - Equipo 2: {game.team2_score}
                          </p>
                          <p className="text-gray-500 text-xs">
                            {new Date(game.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}

          {/* Chat Tab */}
          {activeTab === 'chat' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h1 className="font-display text-2xl text-white mb-6">SOPORTE - CHAT PRIVADO</h1>
              
              <div className="grid md:grid-cols-3 gap-6 h-[600px]">
                {/* User List */}
                <div className="bg-white/5 rounded-lg border border-white/5 overflow-hidden">
                  <div className="p-3 border-b border-white/5">
                    <p className="text-gray-400 text-sm">Conversaciones</p>
                  </div>
                  <ScrollArea className="h-[540px]">
                    {chatThreads.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">
                        Sin conversaciones
                      </div>
                    ) : (
                      chatThreads.map(thread => (
                        <button
                          key={thread._id}
                          onClick={() => handleSelectChatUser(thread._id)}
                          className={`w-full p-3 text-left border-b border-white/5 hover:bg-white/5 transition-colors ${
                            selectedChatUser?.id === thread._id ? 'bg-white/10' : ''
                          }`}
                        >
                          <p className="text-white font-medium">{thread.username}</p>
                          <p className="text-gray-500 text-xs truncate">{thread.last_message}</p>
                          <p className="text-gray-600 text-xs">
                            {new Date(thread.last_date).toLocaleDateString()}
                          </p>
                        </button>
                      ))
                    )}
                  </ScrollArea>
                </div>

                {/* Chat Area */}
                <div className="md:col-span-2 bg-white/5 rounded-lg border border-white/5 flex flex-col overflow-hidden">
                  {selectedChatUser ? (
                    <>
                      <div className="p-3 border-b border-white/5">
                        <p className="text-white font-medium">{selectedChatUser.username}</p>
                        <p className="text-gray-500 text-xs">{selectedChatUser.email}</p>
                      </div>
                      <ScrollArea className="flex-1 p-4">
                        <div className="space-y-3">
                          {chatMessages.map((msg, idx) => (
                            <div
                              key={msg.id || idx}
                              className={`${msg.is_from_admin ? 'ml-auto' : ''}`}
                            >
                              <div className={`chat-bubble ${msg.is_from_admin ? 'sent' : 'received'}`}>
                                <p className="text-sm">{msg.content}</p>
                              </div>
                              <p className={`text-xs text-gray-600 mt-1 ${msg.is_from_admin ? 'text-right' : ''}`}>
                                {new Date(msg.created_at).toLocaleTimeString()}
                              </p>
                            </div>
                          ))}
                          <div ref={chatScrollRef} />
                        </div>
                      </ScrollArea>
                      <div className="p-3 border-t border-white/5">
                        <div className="flex gap-2">
                          <Input
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSendAdminMessage()}
                            placeholder="Escribí tu respuesta..."
                            className="bg-white/5 border-white/10 text-white"
                          />
                          <Button onClick={handleSendAdminMessage} className="btn-gold px-4">
                            <Send className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-500">
                      Seleccioná una conversación
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              <div>
                <h1 className="font-display text-2xl text-white mb-6">CONFIGURACIÓN</h1>
                
                <Card className="bg-white/5 border-white/5">
                  <CardHeader>
                    <CardTitle className="text-white">Economía</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-gray-300">Costo crear mesa privada</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                          <Input
                            type="number"
                            value={settings.private_table_cost}
                            onChange={(e) => setSettings({ ...settings, private_table_cost: parseFloat(e.target.value) })}
                            className="pl-8 bg-white/5 border-white/10 text-white"
                            data-testid="private-table-cost-input"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-gray-300">Comisión plataforma (%)</Label>
                        <Input
                          type="number"
                          value={settings.platform_commission}
                          onChange={(e) => setSettings({ ...settings, platform_commission: parseFloat(e.target.value) })}
                          className="bg-white/5 border-white/10 text-white"
                          data-testid="commission-input"
                        />
                      </div>
                    </div>
                    <Button onClick={handleUpdateSettings} className="btn-gold" data-testid="save-settings-btn">
                      Guardar Configuración
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-white/5 border-white/5">
                <CardHeader>
                  <CardTitle className="text-white">Datos de Transferencia</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-gray-300">Titular</Label>
                      <Input
                        value={transferData.titular}
                        onChange={(e) => setTransferData({ ...transferData, titular: e.target.value })}
                        className="bg-white/5 border-white/10 text-white"
                        data-testid="transfer-titular-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300">Banco</Label>
                      <Input
                        value={transferData.banco}
                        onChange={(e) => setTransferData({ ...transferData, banco: e.target.value })}
                        className="bg-white/5 border-white/10 text-white"
                        data-testid="transfer-banco-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300">Alias</Label>
                      <Input
                        value={transferData.alias}
                        onChange={(e) => setTransferData({ ...transferData, alias: e.target.value })}
                        className="bg-white/5 border-white/10 text-white"
                        data-testid="transfer-alias-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300">CBU/CVU</Label>
                      <Input
                        value={transferData.cbu_cvu}
                        onChange={(e) => setTransferData({ ...transferData, cbu_cvu: e.target.value })}
                        className="bg-white/5 border-white/10 text-white"
                        data-testid="transfer-cbu-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300">Tipo de cuenta</Label>
                      <Input
                        value={transferData.tipo_cuenta}
                        onChange={(e) => setTransferData({ ...transferData, tipo_cuenta: e.target.value })}
                        className="bg-white/5 border-white/10 text-white"
                        data-testid="transfer-tipo-input"
                      />
                    </div>
                  </div>
                  <Button onClick={handleUpdateTransferData} className="btn-gold" data-testid="save-transfer-btn">
                    Guardar Datos
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </main>

      {/* Receipt Modal */}
      <Dialog open={!!showReceipt} onOpenChange={() => setShowReceipt(null)}>
        <DialogContent className="bg-[#0F0F0F] border-white/10 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Comprobante</DialogTitle>
          </DialogHeader>
          {showReceipt && (
            <img src={showReceipt} alt="Comprobante" className="w-full rounded-lg" />
          )}
        </DialogContent>
      </Dialog>

      {/* Create Table Modal */}
      <CreatePublicTableModal 
        open={showCreateTable} 
        onClose={() => setShowCreateTable(false)}
        onCreate={handleCreatePublicTable}
      />

      {/* Create Tournament Modal */}
      <CreateTournamentModal 
        open={showCreateTournament} 
        onClose={() => setShowCreateTournament(false)}
        onCreate={handleCreateTournament}
      />

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

// Create Public Table Modal Component
const CreatePublicTableModal = ({ open, onClose, onCreate }) => {
  const [formData, setFormData] = useState({
    modality: '1v1',
    entry_cost: 100,
    with_flor: false,
    points_to_win: 15
  });

  const handleSubmit = () => {
    const modalityPlayers = { '1v1': 2, '2v2': 4, '3v3': 6 };
    onCreate({
      ...formData,
      max_players: modalityPlayers[formData.modality]
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#0F0F0F] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-[#FFD700]">CREAR MESA PÚBLICA</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-gray-300">Modalidad</Label>
            <Select
              value={formData.modality}
              onValueChange={(val) => setFormData({ ...formData, modality: val })}
            >
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1A1A1A] border-white/10">
                <SelectItem value="1v1" className="text-white">1 vs 1</SelectItem>
                <SelectItem value="2v2" className="text-white">2 vs 2</SelectItem>
                <SelectItem value="3v3" className="text-white">3 vs 3</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Entrada por jugador</Label>
            <Input
              type="number"
              value={formData.entry_cost}
              onChange={(e) => setFormData({ ...formData, entry_cost: parseFloat(e.target.value) || 0 })}
              className="bg-white/5 border-white/10 text-white"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Puntos para ganar</Label>
            <Select
              value={formData.points_to_win.toString()}
              onValueChange={(val) => setFormData({ ...formData, points_to_win: parseInt(val) })}
            >
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1A1A1A] border-white/10">
                <SelectItem value="15" className="text-white">15 puntos</SelectItem>
                <SelectItem value="30" className="text-white">30 puntos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
            <Label className="text-white">Con Flor</Label>
            <Switch
              checked={formData.with_flor}
              onCheckedChange={(val) => setFormData({ ...formData, with_flor: val })}
            />
          </div>

          <Button onClick={handleSubmit} className="w-full btn-gold">
            CREAR MESA
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Create Tournament Modal Component
const CreateTournamentModal = ({ open, onClose, onCreate }) => {
  const [formData, setFormData] = useState({
    name: '',
    modality: '1v1',
    num_tables: 8,
    entry_cost: 1000,
    with_flor: false,
    points_to_win: 15,
    first_place_percentage: 50,
    second_place_percentage: 20
  });

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      return;
    }
    onCreate(formData);
  };

  const modalityPlayers = { '1v1': 2, '2v2': 4, '3v3': 6 };
  const totalPlayers = formData.num_tables * modalityPlayers[formData.modality];
  const totalPot = formData.entry_cost * totalPlayers;
  const netPot = totalPot * 0.7; // 30% commission
  const firstPrize = netPot * (formData.first_place_percentage / 100);
  const secondPrize = netPot * (formData.second_place_percentage / 100);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#0F0F0F] border-white/10 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-[#2ECC71]">CREAR TORNEO</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="space-y-2">
            <Label className="text-gray-300">Nombre del torneo</Label>
            <Input
              type="text"
              placeholder="Torneo Nocturno"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="bg-white/5 border-white/10 text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Modalidad</Label>
              <Select
                value={formData.modality}
                onValueChange={(val) => setFormData({ ...formData, modality: val })}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1A1A1A] border-white/10">
                  <SelectItem value="1v1" className="text-white">1 vs 1</SelectItem>
                  <SelectItem value="2v2" className="text-white">2 vs 2</SelectItem>
                  <SelectItem value="3v3" className="text-white">3 vs 3</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Número de mesas</Label>
              <Input
                type="number"
                value={formData.num_tables}
                onChange={(e) => setFormData({ ...formData, num_tables: parseInt(e.target.value) || 1 })}
                className="bg-white/5 border-white/10 text-white"
                min={2}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Entrada por jugador</Label>
              <Input
                type="number"
                value={formData.entry_cost}
                onChange={(e) => setFormData({ ...formData, entry_cost: parseFloat(e.target.value) || 0 })}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Puntos para ganar</Label>
              <Select
                value={formData.points_to_win.toString()}
                onValueChange={(val) => setFormData({ ...formData, points_to_win: parseInt(val) })}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1A1A1A] border-white/10">
                  <SelectItem value="15" className="text-white">15 puntos</SelectItem>
                  <SelectItem value="30" className="text-white">30 puntos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Premio 1° (%)</Label>
              <Input
                type="number"
                value={formData.first_place_percentage}
                onChange={(e) => setFormData({ ...formData, first_place_percentage: parseFloat(e.target.value) || 0 })}
                className="bg-white/5 border-white/10 text-white"
                max={100}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Premio 2° (%)</Label>
              <Input
                type="number"
                value={formData.second_place_percentage}
                onChange={(e) => setFormData({ ...formData, second_place_percentage: parseFloat(e.target.value) || 0 })}
                className="bg-white/5 border-white/10 text-white"
                max={100}
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
            <Label className="text-white">Con Flor</Label>
            <Switch
              checked={formData.with_flor}
              onCheckedChange={(val) => setFormData({ ...formData, with_flor: val })}
            />
          </div>

          {/* Preview */}
          <div className="bg-white/5 p-4 rounded-lg space-y-2">
            <p className="text-gray-400 text-sm">Vista previa:</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-gray-500">Total jugadores:</span>
              <span className="text-white">{totalPlayers}</span>
              <span className="text-gray-500">Pozo total:</span>
              <span className="text-white">${totalPot.toLocaleString()}</span>
              <span className="text-gray-500">Comisión (30%):</span>
              <span className="text-gray-400">${(totalPot * 0.3).toLocaleString()}</span>
              <span className="text-gray-500">🥇 Premio 1°:</span>
              <span className="text-[#FFD700]">${firstPrize.toLocaleString()}</span>
              <span className="text-gray-500">🥈 Premio 2°:</span>
              <span className="text-gray-300">${secondPrize.toLocaleString()}</span>
            </div>
          </div>

          <Button onClick={handleSubmit} className="w-full bg-[#2ECC71] hover:bg-[#27AE60]">
            CREAR TORNEO
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminPanel;
