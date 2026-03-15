import { motion } from 'framer-motion';

// Spanish card suit symbols and colors
const SUITS = {
  espadas: { name: 'Espadas', color: '#1B4D3E' },
  bastos: { name: 'Bastos', color: '#2D5016' },
  oros: { name: 'Oros', color: '#B8860B' },
  copas: { name: 'Copas', color: '#8B0000' }
};

// SVG paths for Spanish card suits
const SuitIcon = ({ suit, size = 24 }) => {
  const color = SUITS[suit]?.color || '#333';
  
  if (suit === 'espadas') {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100">
        <path 
          d="M50 5 L55 45 L75 45 L50 95 L25 45 L45 45 Z" 
          fill={color}
          stroke="#000"
          strokeWidth="2"
        />
        <ellipse cx="50" cy="40" rx="8" ry="12" fill={color} stroke="#000" strokeWidth="1"/>
      </svg>
    );
  }
  
  if (suit === 'bastos') {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100">
        <rect x="42" y="10" width="16" height="80" rx="4" fill={color} stroke="#000" strokeWidth="2"/>
        <ellipse cx="50" cy="25" rx="20" ry="10" fill="#228B22" stroke="#000" strokeWidth="1"/>
        <ellipse cx="50" cy="50" rx="18" ry="8" fill="#228B22" stroke="#000" strokeWidth="1"/>
        <ellipse cx="50" cy="75" rx="15" ry="6" fill="#228B22" stroke="#000" strokeWidth="1"/>
      </svg>
    );
  }
  
  if (suit === 'oros') {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="35" fill={color} stroke="#DAA520" strokeWidth="4"/>
        <circle cx="50" cy="50" r="20" fill="#FFD700" stroke="#B8860B" strokeWidth="2"/>
        <circle cx="50" cy="50" r="8" fill={color}/>
      </svg>
    );
  }
  
  if (suit === 'copas') {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100">
        <path 
          d="M30 20 Q30 60 50 70 Q70 60 70 20 L30 20" 
          fill={color}
          stroke="#000"
          strokeWidth="2"
        />
        <rect x="45" y="68" width="10" height="15" fill={color} stroke="#000" strokeWidth="1"/>
        <ellipse cx="50" cy="88" rx="15" ry="5" fill={color} stroke="#000" strokeWidth="1"/>
        <ellipse cx="50" cy="30" rx="12" ry="6" fill="#FFB6C1" opacity="0.5"/>
      </svg>
    );
  }
  
  return null;
};

const PlayingCard = ({ card, size = 'md', onClick, selected, disabled }) => {
  const sizeClasses = {
    sm: 'w-14 h-20',
    md: 'w-20 h-28',
    lg: 'w-24 h-36 md:w-28 md:h-40'
  };
  
  const iconSizes = {
    sm: 16,
    md: 24,
    lg: 32
  };

  // Card back
  if (!card || card.hidden) {
    return (
      <div 
        className={`
          ${sizeClasses[size]} rounded-lg shadow-lg cursor-pointer
          bg-gradient-to-br from-[#1a1a6e] to-[#0d0d3d]
          border-2 border-[#FFD700]/30
          flex items-center justify-center
          ${selected ? 'ring-2 ring-[#FFD700]' : ''}
        `}
        onClick={onClick}
      >
        <div className="w-full h-full flex items-center justify-center p-2">
          <div className="w-full h-full rounded border border-[#FFD700]/20 flex items-center justify-center">
            <span className="text-[#FFD700]/50 text-2xl">🃏</span>
          </div>
        </div>
      </div>
    );
  }

  const suit = SUITS[card.suit];
  const isRed = card.suit === 'oros' || card.suit === 'copas';
  
  const getDisplayNumber = (num) => {
    if (num === 10) return 'X'; // Sota
    if (num === 11) return 'XI'; // Caballo  
    if (num === 12) return 'XII'; // Rey
    return num;
  };

  const getFigureName = (num) => {
    if (num === 10) return 'SOTA';
    if (num === 11) return 'CABALLO';
    if (num === 12) return 'REY';
    return null;
  };

  return (
    <motion.div
      whileHover={!disabled ? { y: -8, scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      className={`
        ${sizeClasses[size]} rounded-lg shadow-xl cursor-pointer relative overflow-hidden
        bg-gradient-to-br from-[#FFFEF0] to-[#F5F0DC]
        border border-gray-300
        ${selected ? 'ring-2 ring-[#FFD700] -translate-y-4' : ''}
        ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
      `}
      onClick={!disabled ? onClick : undefined}
      style={{
        boxShadow: selected 
          ? '0 10px 30px rgba(255, 215, 0, 0.4)' 
          : '0 4px 15px rgba(0, 0, 0, 0.2)'
      }}
    >
      {/* Card background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="w-full h-full" style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 10px,
            rgba(0,0,0,0.03) 10px,
            rgba(0,0,0,0.03) 20px
          )`
        }} />
      </div>

      {/* Top left corner */}
      <div className="absolute top-1 left-1.5 flex flex-col items-center">
        <span 
          className={`font-bold ${size === 'lg' ? 'text-lg' : 'text-sm'} leading-none`}
          style={{ color: suit?.color }}
        >
          {getDisplayNumber(card.number)}
        </span>
        <div className={size === 'lg' ? 'mt-0.5' : 'mt-0'}>
          <SuitIcon suit={card.suit} size={iconSizes[size] * 0.7} />
        </div>
      </div>

      {/* Center content */}
      <div className="absolute inset-0 flex items-center justify-center">
        {getFigureName(card.number) ? (
          <div className="flex flex-col items-center">
            <SuitIcon suit={card.suit} size={iconSizes[size] * 1.5} />
            <span 
              className={`font-bold mt-1 ${size === 'lg' ? 'text-xs' : 'text-[8px]'}`}
              style={{ color: suit?.color }}
            >
              {getFigureName(card.number)}
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            {/* Show multiple suit icons based on card number */}
            {card.number <= 3 ? (
              <div className="flex flex-col items-center gap-1">
                {[...Array(card.number)].map((_, i) => (
                  <SuitIcon key={i} suit={card.suit} size={iconSizes[size]} />
                ))}
              </div>
            ) : card.number <= 7 ? (
              <div className="grid grid-cols-2 gap-1">
                {[...Array(Math.min(card.number, 6))].map((_, i) => (
                  <SuitIcon key={i} suit={card.suit} size={iconSizes[size] * 0.8} />
                ))}
                {card.number === 7 && (
                  <div className="col-span-2 flex justify-center">
                    <SuitIcon suit={card.suit} size={iconSizes[size] * 0.8} />
                  </div>
                )}
              </div>
            ) : (
              <SuitIcon suit={card.suit} size={iconSizes[size] * 1.5} />
            )}
          </div>
        )}
      </div>

      {/* Bottom right corner (rotated) */}
      <div className="absolute bottom-1 right-1.5 flex flex-col items-center rotate-180">
        <span 
          className={`font-bold ${size === 'lg' ? 'text-lg' : 'text-sm'} leading-none`}
          style={{ color: suit?.color }}
        >
          {getDisplayNumber(card.number)}
        </span>
        <div className={size === 'lg' ? 'mt-0.5' : 'mt-0'}>
          <SuitIcon suit={card.suit} size={iconSizes[size] * 0.7} />
        </div>
      </div>

      {/* Special card indicator for powerful cards */}
      {((card.number === 1 && (card.suit === 'espadas' || card.suit === 'bastos')) ||
        (card.number === 7 && (card.suit === 'espadas' || card.suit === 'oros'))) && (
        <div className="absolute top-0 right-0 w-3 h-3 bg-[#FFD700] rounded-bl-lg" />
      )}
    </motion.div>
  );
};

export default PlayingCard;
