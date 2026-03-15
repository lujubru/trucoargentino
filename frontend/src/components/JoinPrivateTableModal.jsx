import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription 
} from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const JoinPrivateTableModal = ({ open, onClose }) => {
  const navigate = useNavigate();
  const { api, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState('');

  const handleJoin = async () => {
    if (!code.trim()) {
      toast.error('Ingresá un código válido');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/tables/join-by-code', { code: code.toUpperCase() });
      toast.success('¡Te uniste a la mesa!');
      await refreshUser();
      
      // Get table info to navigate
      const tableRes = await api.get(`/tables/${res.data.table_id || ''}`);
      navigate(`/game/${tableRes.data?.id || code}`);
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al unirse');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCode('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#0F0F0F] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-[#FFD700]">
            UNIRSE A MESA PRIVADA
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Ingresá el código de la partida
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-gray-300">Código de partida</Label>
            <Input
              type="text"
              placeholder="ABC123"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="bg-white/5 border-white/10 text-white h-14 text-center text-2xl font-mono tracking-widest uppercase"
              maxLength={6}
              data-testid="join-code-input"
            />
          </div>

          <Button
            onClick={handleJoin}
            disabled={loading || !code.trim()}
            className="w-full btn-gold h-12"
            data-testid="join-table-btn"
          >
            {loading ? <Loader2 className="animate-spin" /> : 'UNIRSE'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default JoinPrivateTableModal;
