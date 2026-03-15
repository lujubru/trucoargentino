import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription 
} from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Loader2, Check, ArrowDownToLine } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const WithdrawalModal = ({ open, onClose }) => {
  const { api, user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    amount: '',
    alias: '',
    titular_name: ''
  });

  const formatMoney = (val) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    }).format(val);
  };

  const handleSubmit = async () => {
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error('Ingresá un monto válido');
      return;
    }
    if (!formData.alias.trim()) {
      toast.error('Ingresá el alias');
      return;
    }
    if (!formData.titular_name.trim()) {
      toast.error('Ingresá el nombre del titular');
      return;
    }
    if (parseFloat(formData.amount) > (user?.cashbank || 0)) {
      toast.error('El monto supera tu saldo disponible');
      return;
    }

    setLoading(true);
    try {
      await api.post('/cashbank/withdrawal', {
        amount: parseFloat(formData.amount),
        alias: formData.alias,
        titular_name: formData.titular_name
      });
      setSuccess(true);
      await refreshUser();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al solicitar retiro');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({ amount: '', alias: '', titular_name: '' });
    setSuccess(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#0F0F0F] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-[#E74C3C]">
            SOLICITAR RETIRO
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {!success ? 'Ingresá los datos para tu retiro' : 'Solicitud enviada'}
          </DialogDescription>
        </DialogHeader>

        {!success ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-5"
          >
            <div className="bg-white/5 p-4 rounded-lg">
              <p className="text-gray-400 text-sm">Tu saldo disponible:</p>
              <p className="text-[#FFD700] font-mono text-2xl">{formatMoney(user?.cashbank || 0)}</p>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Monto a retirar</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <Input
                  type="number"
                  placeholder="1000"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="pl-8 bg-white/5 border-white/10 text-white h-12 text-lg"
                  max={user?.cashbank || 0}
                  data-testid="withdrawal-amount-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Alias de la cuenta</Label>
              <Input
                type="text"
                placeholder="mi.alias.banco"
                value={formData.alias}
                onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
                className="bg-white/5 border-white/10 text-white h-12"
                data-testid="withdrawal-alias-input"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Nombre del titular</Label>
              <Input
                type="text"
                placeholder="Juan Pérez"
                value={formData.titular_name}
                onChange={(e) => setFormData({ ...formData, titular_name: e.target.value })}
                className="bg-white/5 border-white/10 text-white h-12"
                data-testid="withdrawal-titular-input"
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-[#E74C3C] hover:bg-[#C0392B] h-12"
              data-testid="withdrawal-submit-btn"
            >
              {loading ? <Loader2 className="animate-spin" /> : 'SOLICITAR RETIRO'}
            </Button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-8"
          >
            <div className="w-16 h-16 bg-[#2ECC71]/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-[#2ECC71]" />
            </div>
            <h3 className="font-display text-xl text-white mb-2">¡SOLICITUD ENVIADA!</h3>
            <p className="text-gray-400 mb-2">
              Tu retiro de {formatMoney(formData.amount)} está pendiente de aprobación.
            </p>
            <p className="text-gray-500 text-sm mb-6">
              A: {formData.alias} ({formData.titular_name})
            </p>
            <Button onClick={handleClose} className="btn-gold" data-testid="withdrawal-close-btn">
              CERRAR
            </Button>
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WithdrawalModal;
