import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription 
} from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Loader2, Copy, Check, Share2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const CreatePrivateTableModal = ({ open, onClose, onCreated }) => {
  const navigate = useNavigate();
  const { api, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState({
    modality: '1v1',
    entry_cost: 100,
    with_flor: false,
    points_to_win: 15
  });

  const handleCreate = async () => {
    setLoading(true);
    try {
      const res = await api.post('/tables/private', formData);
      setCreated(res.data);
      onCreated?.(res.data.code);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear mesa');
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(created?.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = () => {
    const url = `${window.location.origin}/join/${created?.code}`;
    const text = `¡Unite a mi mesa de Truco! 🃏\nCódigo: ${created?.code}\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const goToTable = () => {
    navigate(`/game/${created?.id}`);
    onClose();
  };

  const handleClose = () => {
    setCreated(null);
    setFormData({
      modality: '1v1',
      entry_cost: 100,
      with_flor: false,
      points_to_win: 15
    });
    onClose();
  };

  const formatMoney = (val) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    }).format(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#0F0F0F] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-[#2ECC71]">
            {created ? 'MESA CREADA' : 'CREAR MESA PRIVADA'}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {created 
              ? 'Compartí el código con tus amigos' 
              : 'Configurá tu partida privada'}
          </DialogDescription>
        </DialogHeader>

        {!created ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            <div className="space-y-2">
              <Label className="text-gray-300">Modalidad</Label>
              <Select
                value={formData.modality}
                onValueChange={(val) => setFormData({ ...formData, modality: val })}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white h-12" data-testid="modality-select">
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
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <Input
                  type="number"
                  value={formData.entry_cost}
                  onChange={(e) => setFormData({ ...formData, entry_cost: parseFloat(e.target.value) || 0 })}
                  className="pl-8 bg-white/5 border-white/10 text-white h-12"
                  data-testid="entry-cost-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Puntos para ganar</Label>
              <Select
                value={formData.points_to_win.toString()}
                onValueChange={(val) => setFormData({ ...formData, points_to_win: parseInt(val) })}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white h-12" data-testid="points-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1A1A1A] border-white/10">
                  <SelectItem value="15" className="text-white">15 puntos</SelectItem>
                  <SelectItem value="30" className="text-white">30 puntos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
              <div>
                <Label className="text-white">Con Flor</Label>
                <p className="text-gray-500 text-sm">Habilitar cantos de flor</p>
              </div>
              <Switch
                checked={formData.with_flor}
                onCheckedChange={(val) => setFormData({ ...formData, with_flor: val })}
                data-testid="flor-switch"
              />
            </div>

            <div className="bg-white/5 p-4 rounded-lg">
              <p className="text-gray-400 text-sm">
                Tu saldo: <span className="text-[#FFD700] font-mono">{formatMoney(user?.cashbank || 0)}</span>
              </p>
              <p className="text-gray-500 text-xs mt-1">
                Se descontará el costo de creación + tu entrada
              </p>
            </div>

            <Button
              onClick={handleCreate}
              disabled={loading}
              className="w-full bg-[#2ECC71] hover:bg-[#27AE60] h-12"
              data-testid="create-table-btn"
            >
              {loading ? <Loader2 className="animate-spin" /> : 'CREAR MESA'}
            </Button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            <div className="text-center py-4">
              <p className="text-gray-400 mb-2">Código de la mesa:</p>
              <div className="flex items-center justify-center gap-2">
                <span className="font-mono text-4xl text-[#FFD700] tracking-widest">
                  {created.code}
                </span>
                <button
                  onClick={copyCode}
                  className="p-2 hover:bg-white/10 rounded"
                >
                  {copied ? (
                    <Check className="w-5 h-5 text-[#2ECC71]" />
                  ) : (
                    <Copy className="w-5 h-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div className="grid gap-3">
              <Button
                onClick={shareWhatsApp}
                className="w-full bg-[#25D366] hover:bg-[#20BD5A] h-12"
                data-testid="share-whatsapp-btn"
              >
                <Share2 className="w-5 h-5 mr-2" />
                Compartir por WhatsApp
              </Button>
              
              <Button
                onClick={goToTable}
                className="w-full btn-gold h-12"
                data-testid="go-to-table-btn"
              >
                IR A LA MESA
              </Button>
            </div>
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CreatePrivateTableModal;
