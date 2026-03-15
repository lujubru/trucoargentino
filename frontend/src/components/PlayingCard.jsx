import { motion } from 'framer-motion';

const SUITS = {
  espadas: { symbol: '🗡️', color: '#1a1a1a' },
  bastos: { symbol: '🏏', color: '#1a1a1a' },
  oros: { symbol: '🪙', color: '#B8860B' },
  copas: { symbol: '🏆', color: '#B8860B' }
};

const SUIT_SYMBOLS = {
  espadas: '⚔',
  bastos: '♣',
  oros: '◆',
  copas: '♥'
};

const PlayingCard = ({ card, size = 'md', onClick, selected }) => {
  if (!card || card.hidden) {
    return (
      <div 
        className={`
          playing-card bg-gradient-to-br from-[#1a1a6e] to-[#0d0d3d]
          flex items-center justify-center
          ${size === 'sm' ? 'w-12 h-18' : size === 'md' ? 'w-16 h-24' : 'w-20 h-30 md:w-24 md:h-36'}
          ${selected ? 'ring-2 ring-[#FFD700]' : ''}
        `}
        onClick={onClick}
      >
        <div className="text-4xl opacity-50">🃏</div>
      </div>
    );
  }

  const suit = SUITS[card.suit] || { color: '#333' };
  const suitSymbol = SUIT_SYMBOLS[card.suit] || '?';
  const isRed = card.suit === 'oros' || card.suit === 'copas';

  const getCardNumber = (num) => {
    if (num === 10) return 'S'; // Sota
    if (num === 11) return 'C'; // Caballo
    if (num === 12) return 'R'; // Rey
    return num;
  };

  return (
    <motion.div
      whileHover={{ y: -8 }}
      whileTap={{ scale: 0.95 }}
      className={`
        playing-card cursor-pointer relative
        ${size === 'sm' ? 'w-12 h-18' : size === 'md' ? 'w-16 h-24' : 'w-20 h-30 md:w-24 md:h-36'}
        ${selected ? 'ring-2 ring-[#FFD700] -translate-y-4' : ''}
      `}
      onClick={onClick}
      style={{
        background: 'linear-gradient(145deg, #FFFFFF 0%, #F5F5F5 100%)'
      }}
    >
      {/* Top left corner */}
      <div className="absolute top-1 left-1.5 text-center">
        <div 
          className={`font-bold ${size === 'lg' ? 'text-lg' : 'text-sm'}`}
          style={{ color: isRed ? '#B8860B' : '#1a1a1a' }}
        >
          {getCardNumber(card.number)}
        </div>
        <div className={`${size === 'lg' ? 'text-base' : 'text-xs'}`} style={{ color: isRed ? '#B8860B' : '#1a1a1a' }}>
          {suitSymbol}
        </div>
      </div>

      {/* Center */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span 
          className={`${size === 'lg' ? 'text-4xl' : size === 'md' ? 'text-3xl' : 'text-2xl'}`}
          style={{ color: isRed ? '#B8860B' : '#1a1a1a' }}
        >
          {suitSymbol}
        </span>
      </div>

      {/* Bottom right corner (inverted) */}
      <div className="absolute bottom-1 right-1.5 text-center rotate-180">
        <div 
          className={`font-bold ${size === 'lg' ? 'text-lg' : 'text-sm'}`}
          style={{ color: isRed ? '#B8860B' : '#1a1a1a' }}
        >
          {getCardNumber(card.number)}
        </div>
        <div className={`${size === 'lg' ? 'text-base' : 'text-xs'}`} style={{ color: isRed ? '#B8860B' : '#1a1a1a' }}>
          {suitSymbol}
        </div>
      </div>
    </motion.div>
  );
};

export default PlayingCard;
