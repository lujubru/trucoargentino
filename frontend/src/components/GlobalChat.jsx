import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Send, MessageCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ScrollArea } from '../components/ui/scroll-area';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const GlobalChat = ({ onClose }) => {
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

    const handleNewMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
      scrollToBottom();
    };

    socket.on('global_message', handleNewMessage);

    return () => {
      socket.off('global_message', handleNewMessage);
    };
  }, [socket]);

  const fetchMessages = async () => {
    try {
      const res = await api.get('/chat/global');
      setMessages(res.data);
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
      await api.post('/chat/global', { content: newMessage });
      setNewMessage('');
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
          <MessageCircle className="w-5 h-5 text-[#FFD700]" />
          <span className="font-display text-lg text-white">CHAT GLOBAL</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-gray-400 hover:text-white"
          data-testid="close-chat-btn"
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
          <p className="text-center text-gray-500 py-8">
            No hay mensajes aún. ¡Sé el primero en escribir!
          </p>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, idx) => (
              <div
                key={msg.id || idx}
                className={`${
                  msg.sender_id === user?.id ? 'ml-auto' : ''
                }`}
              >
                <div
                  className={`chat-bubble ${
                    msg.sender_id === user?.id ? 'sent' : 'received'
                  }`}
                >
                  {msg.sender_id !== user?.id && (
                    <p className="text-xs text-[#FFD700] mb-1">{msg.sender_username}</p>
                  )}
                  <p className="text-sm">{msg.content}</p>
                </div>
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
            placeholder="Escribí un mensaje..."
            className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
            data-testid="chat-input"
          />
          <Button
            onClick={handleSend}
            disabled={!newMessage.trim()}
            className="btn-gold px-4"
            data-testid="send-chat-btn"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default GlobalChat;
