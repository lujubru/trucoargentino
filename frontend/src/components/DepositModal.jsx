import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription 
} from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Upload, Loader2, Copy, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const DepositModal = ({ open, onClose }) => {
  const { api } = useAuth();
  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState('');
  const [transferData, setTransferData] = useState(null);
  const [depositId, setDepositId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    if (open) {
      fetchTransferData();
      setStep(1);
      setAmount('');
      setDepositId(null);
    }
  }, [open]);

  const fetchTransferData = async () => {
    try {
      const res = await api.get('/cashbank/transfer-data');
      setTransferData(res.data);
    } catch (error) {
      console.error('Error fetching transfer data:', error);
    }
  };

  const handleSubmitAmount = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Ingresá un monto válido');
      return;
    }

    try {
      const res = await api.post('/cashbank/deposit', { amount: parseFloat(amount) });
      setDepositId(res.data.id);
      setStep(2);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear depósito');
    }
  };

  const handleUploadReceipt = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('receipt', file);

    try {
      await api.post(`/cashbank/deposit/${depositId}/receipt`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Comprobante subido correctamente');
      setStep(3);
    } catch (error) {
      toast.error('Error al subir comprobante');
    } finally {
      setUploading(false);
    }
  };

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatMoney = (val) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    }).format(val);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#0F0F0F] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-[#FFD700]">
            DEPOSITAR DINERO
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {step === 1 && 'Ingresá el monto que querés depositar'}
            {step === 2 && 'Realizá la transferencia y subí el comprobante'}
            {step === 3 && 'Tu depósito está siendo procesado'}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Amount */}
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="space-y-2">
              <Label className="text-gray-300">Monto a depositar</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <Input
                  type="number"
                  placeholder="1000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-8 bg-white/5 border-white/10 text-white h-12 text-lg"
                  data-testid="deposit-amount-input"
                />
              </div>
            </div>

            <Button
              onClick={handleSubmitAmount}
              className="w-full btn-gold h-12"
              data-testid="deposit-continue-btn"
            >
              CONTINUAR
            </Button>
          </motion.div>
        )}

        {/* Step 2: Transfer Data */}
        {step === 2 && transferData && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="bg-white/5 p-4 rounded-lg space-y-3">
              <p className="text-[#FFD700] font-mono text-xl text-center mb-4">
                {formatMoney(amount)}
              </p>
              
              {[
                { label: 'Titular', value: transferData.titular, key: 'titular' },
                { label: 'Banco', value: transferData.banco, key: 'banco' },
                { label: 'Alias', value: transferData.alias, key: 'alias' },
                { label: 'CBU/CVU', value: transferData.cbu_cvu, key: 'cbu' },
                { label: 'Tipo', value: transferData.tipo_cuenta, key: 'tipo' }
              ].map(({ label, value, key }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">{label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-mono text-sm">{value}</span>
                    <button
                      onClick={() => copyToClipboard(value, key)}
                      className="text-gray-400 hover:text-[#FFD700]"
                    >
                      {copied === key ? (
                        <Check className="w-4 h-4 text-[#2ECC71]" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Subir comprobante</Label>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/20 rounded-lg cursor-pointer hover:border-[#FFD700]/50 transition-colors">
                <div className="flex flex-col items-center">
                  {uploading ? (
                    <Loader2 className="w-8 h-8 text-[#FFD700] animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-gray-400 mb-2" />
                      <span className="text-gray-400 text-sm">Click para subir</span>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUploadReceipt}
                  className="hidden"
                  data-testid="deposit-receipt-input"
                />
              </label>
            </div>
          </motion.div>
        )}

        {/* Step 3: Success */}
        {step === 3 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-8"
          >
            <div className="w-16 h-16 bg-[#2ECC71]/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-[#2ECC71]" />
            </div>
            <h3 className="font-display text-xl text-white mb-2">¡LISTO!</h3>
            <p className="text-gray-400 mb-6">
              Tu depósito de {formatMoney(amount)} está pendiente de aprobación.
              Te notificaremos cuando sea procesado.
            </p>
            <Button onClick={onClose} className="btn-gold" data-testid="deposit-close-btn">
              CERRAR
            </Button>
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DepositModal;
