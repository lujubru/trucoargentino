import { motion } from 'framer-motion';

// Spanish card suit symbols and colors
const SUITS = {
  espadas: { name: 'Espadas', color: '#1B4D3E' },
  bastos: { name: 'Bastos', color: '#2D5016' },
  oros: { name: 'Oros', color: '#DAA520' },
  copas: { name: 'Copas', color: '#DC143C' }
};

// Simplified suit icons for mobile
const SuitIcon = ({ suit, size = 24 }) => {
  const color = SUITS[suit]?.color || '#333';
  
  if (suit === 'espadas') {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100">
        <path 
          d="M50 10 L60 50 L75 50 L50 90 L25 50 L40 50 Z" 
          fill={color}
          stroke="#000"
          strokeWidth="3"
        />
      </svg>
    );
  }
  
  if (suit === 'bastos') {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100">
        <rect x="40" y="15" width="20" height="70" rx="6" fill={color} stroke="#000" strokeWidth="3"/>
        <ellipse cx="50" cy="30" rx="25" ry="12" fill="#228B22" stroke="#000" strokeWidth="2"/>
        <ellipse cx="50" cy="70" rx="25" ry="12" fill="#228B22" stroke="#000" strokeWidth="2"/>
      </svg>
    );
  }
  
  if (suit === 'oros') {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="38" fill={color} stroke="#B8860B" strokeWidth="4"/>
        <circle cx="50" cy="50" r="22" fill="#FFD700" stroke="#B8860B" strokeWidth="3"/>
        <circle cx="50" cy="50" r="10" fill={color}/>
      </svg>
    );
  }
  
  if (suit === 'copas') {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100">
        <path 
          d="M25 25 Q25 65 50 75 Q75 65 75 25 L25 25" 
          fill={color}
          stroke="#000"
          strokeWidth="3"
        />
        <rect x="43" y="73" width="14" height="15" fill={color} stroke="#000" strokeWidth="2"/>
        <ellipse cx="50" cy="92" rx="18" ry="6" fill={color} stroke="#000" strokeWidth="2"/>
      </svg>
    );
  }
  
  return null;
};

const PlayingCard = ({ card, size = 'md', onClick, selected, disabled }) => {
  const sizeClasses = {
    sm: 'w-12 h-18 md:w-16 md:h-24',
    md: 'w-16 h-24 md:w-20 md:h-30',
    lg: 'w-20 h-30 md:w-24 md:h-36'
  };
  
  const iconSizes = {
    sm: 20,
    md: 28,
    lg: 36
  };

  // Card back
  if (!card || card.hidden) {
    return (
      <div 
        className={`
          ${sizeClasses[size]} rounded-lg shadow-xl cursor-pointer
          bg-gradient-to-br from-[#8B4513] via-[#A0522D] to-[#654321]
          border-2 border-[#654321]
          flex items-center justify-center
          ${selected ? 'ring-2 ring-[#FFD700]' : ''}
        `}
        onClick={onClick}
        style={{
          boxShadow: '0 4px 15px rgba(0,0,0,0.4)'
        }}
      >
        <div className="w-full h-full flex items-center justify-center p-2 rounded">
          <div className="w-full h-full rounded border-2 border-[#FFD700]/30 flex items-center justify-center"
            style={{
              backgroundImage: `repeating-linear-gradient(
                90deg,
                transparent,
                transparent 3px,
                rgba(255,215,0,0.1) 3px,
                rgba(255,215,0,0.1) 6px
              )`
            }}
          >
            <span className="text-3xl">🃏</span>
          </div>
        </div>
      </div>
    );
  }

  const suit = SUITS[card.suit];
  
  const getDisplayNumber = (num) => {
    if (num === 10) return '10';
    if (num === 11) return '11';
    if (num === 12) return '12';
    return num;
  };

  return (
    <motion.div
      whileHover={!disabled ? { scale: 1.05 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      className={`
        ${sizeClasses[size]} rounded-lg shadow-2xl cursor-pointer relative overflow-hidden
        bg-gradient-to-br from-[#FFFEF0] via-white to-[#F5F0DC]
        border-2 border-gray-400
        ${selected ? 'ring-4 ring-[#FFD700]' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      onClick={!disabled ? onClick : undefined}
      style={{
        boxShadow: selected 
          ? '0 15px 40px rgba(255, 215, 0, 0.6), 0 0 20px rgba(255, 215, 0, 0.4)' 
          : '0 6px 20px rgba(0, 0, 0, 0.4)'
      }}
    >
      {/* Card background subtle pattern */}
      <div className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 8px,
            rgba(0,0,0,0.02) 8px,
            rgba(0,0,0,0.02) 16px
          )`
        }}
      />

      {/* Top left corner */}
      <div className="absolute top-1 left-1.5 flex flex-col items-center z-10">
        <span 
          className={`font-bold ${size === 'lg' ? 'text-xl' : size === 'md' ? 'text-base' : 'text-sm'} leading-none`}
          style={{ color: suit?.color }}
        >
          {getDisplayNumber(card.number)}
        </span>
        <div className="mt-0.5">
          <SuitIcon suit={card.suit} size={iconSizes[size] * 0.5} />
        </div>
      </div>

      {/* Center - Large suit icon */}
      <div className="absolute inset-0 flex items-center justify-center">
        <SuitIcon suit={card.suit} size={iconSizes[size] * 1.8} />
      </div>

      {/* Bottom right corner (rotated) */}
      <div className="absolute bottom-1 right-1.5 flex flex-col items-center rotate-180 z-10">
        <span 
          className={`font-bold ${size === 'lg' ? 'text-xl' : size === 'md' ? 'text-base' : 'text-sm'} leading-none`}
          style={{ color: suit?.color }}
        >
          {getDisplayNumber(card.number)}
        </span>
        <div className="mt-0.5">
          <SuitIcon suit={card.suit} size={iconSizes[size] * 0.5} />
        </div>
      </div>

      {/* Special card indicator */}
      {((card.number === 1 && (card.suit === 'espadas' || card.suit === 'bastos')) ||
        (card.number === 7 && (card.suit === 'espadas' || card.suit === 'oros'))) && (
        <div className="absolute top-0 right-0 w-4 h-4 bg-[#FFD700] rounded-bl-lg z-10">
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[8px] text-[#0f2818] font-bold">★</span>
          </div>
        </div>
      )}

      {/* Shine effect for selected card */}
      {selected && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent"
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 1 }}
        />
      )}
    </motion.div>
  );
};

export default PlayingCard;
