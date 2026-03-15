import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Send, MessageCircle, User } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ScrollArea } from '../components/ui/scroll-area';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const AdminChat = ({ onClose }) => {
  const { api, user } = useAuth();
  const { socket } = useSocket();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);

  useEffect(() => {
    fetchMessages();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleAdminMessage = (msg) => {
      if (msg.thread_user_id === user?.id || msg.sender_id === user?.id) {
        setMessages((prev) => [...prev, msg]);
        scrollToBottom();
      }
    };

    socket.on('admin_message', handleAdminMessage);

    return () => {
      socket.off('admin_message', handleAdminMessage);
    };
  }, [socket, user?.id]);

  const fetchMessages = async () => {
    try {
      const res = await api.get('/chat/admin');
      setMessages(res.data.messages || []);
      scrollToBottom();
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSend = async () => {
    if (!newMessage.trim()) return;

    try {
      await api.post('/chat/admin', { content: newMessage });
      // Optimistic update
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        sender_id: user?.id,
        sender_username: user?.username,
        content: newMessage,
        is_from_admin: false,
        created_at: new Date().toISOString()
      }]);
      setNewMessage('');
      scrollToBottom();
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-[#0A0A0A] border-l border-white/10 z-50 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-[#FFD700]" />
          <span className="font-display text-lg text-white">SOPORTE</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-gray-400 hover:text-white"
          data-testid="close-admin-chat-btn"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="spinner" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8">
            <MessageCircle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500">
              Escribí tu consulta al administrador
            </p>
            <p className="text-gray-600 text-sm mt-1">
              Te responderemos a la brevedad
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, idx) => (
              <div
                key={msg.id || idx}
                className={`${msg.is_from_admin ? '' : 'ml-auto'}`}
              >
                <div
                  className={`chat-bubble ${msg.is_from_admin ? 'received' : 'sent'}`}
                >
                  {msg.is_from_admin && (
                    <p className="text-xs text-[#FFD700] mb-1">Admin</p>
                  )}
                  <p className="text-sm">{msg.content}</p>
                </div>
                <p className={`text-xs text-gray-600 mt-1 ${msg.is_from_admin ? '' : 'text-right'}`}>
                  {new Date(msg.created_at).toLocaleTimeString()}
                </p>
              </div>
            ))}
            <div ref={scrollRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-white/10">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Escribí tu consulta..."
            className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
            data-testid="admin-chat-input"
          />
          <Button
            onClick={handleSend}
            disabled={!newMessage.trim()}
            className="btn-gold px-4"
            data-testid="send-admin-chat-btn"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default AdminChat;
