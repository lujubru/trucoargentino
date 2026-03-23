import { motion } from 'framer-motion';

// Spanish card suit configuration - authentic colors
const SUITS = {
  espadas: { name: 'Espadas', color: '#1a5276', bgColor: '#d4e6f1' },
  bastos: { name: 'Bastos', color: '#1e8449', bgColor: '#d5f5e3' },
  oros: { name: 'Oros', color: '#b7950b', bgColor: '#fdebd0' },
  copas: { name: 'Copas', color: '#922b21', bgColor: '#fadbd8' }
};

// Traditional Spanish card suit SVG icons
const SuitIcon = ({ suit, size = 24 }) => {
  if (suit === 'espadas') {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100">
        {/* Espada - Traditional sword design */}
        <line x1="50" y1="8" x2="50" y2="72" stroke="#1a5276" strokeWidth="6" strokeLinecap="round"/>
        <polygon points="50,8 42,22 50,18 58,22" fill="#1a5276"/>
        <line x1="35" y1="62" x2="65" y2="62" stroke="#1a5276" strokeWidth="5" strokeLinecap="round"/>
        <ellipse cx="50" cy="72" rx="8" ry="4" fill="#1a5276"/>
        <rect x="46" y="72" width="8" height="20" rx="2" fill="#1a5276"/>
      </svg>
    );
  }
  
  if (suit === 'bastos') {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100">
        {/* Basto - Traditional club/stick */}
        <rect x="44" y="15" width="12" height="65" rx="4" fill="#5d4037" stroke="#3e2723" strokeWidth="2"/>
        <ellipse cx="50" cy="22" rx="18" ry="10" fill="#2e7d32" stroke="#1b5e20" strokeWidth="1.5"/>
        <ellipse cx="50" cy="22" rx="12" ry="6" fill="#43a047"/>
        <ellipse cx="50" cy="75" rx="14" ry="8" fill="#2e7d32" stroke="#1b5e20" strokeWidth="1.5"/>
        <rect x="43" y="82" width="14" height="8" rx="3" fill="#5d4037" stroke="#3e2723" strokeWidth="1"/>
      </svg>
    );
  }
  
  if (suit === 'oros') {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100">
        {/* Oro - Traditional gold coin */}
        <circle cx="50" cy="50" r="36" fill="#f9a825" stroke="#f57f17" strokeWidth="3"/>
        <circle cx="50" cy="50" r="28" fill="#fdd835" stroke="#f9a825" strokeWidth="2"/>
        <circle cx="50" cy="50" r="18" fill="#ffee58" stroke="#fdd835" strokeWidth="1.5"/>
        <circle cx="50" cy="50" r="8" fill="#f9a825"/>
        {/* Rayos decorativos */}
        <line x1="50" y1="16" x2="50" y2="22" stroke="#f57f17" strokeWidth="2"/>
        <line x1="50" y1="78" x2="50" y2="84" stroke="#f57f17" strokeWidth="2"/>
        <line x1="16" y1="50" x2="22" y2="50" stroke="#f57f17" strokeWidth="2"/>
        <line x1="78" y1="50" x2="84" y2="50" stroke="#f57f17" strokeWidth="2"/>
      </svg>
    );
  }
  
  if (suit === 'copas') {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100">
        {/* Copa - Traditional chalice/cup */}
        <path d="M30 20 Q30 55 50 65 Q70 55 70 20 Z" fill="#c0392b" stroke="#922b21" strokeWidth="2"/>
        <path d="M35 24 Q35 50 50 58 Q65 50 65 24 Z" fill="#e74c3c"/>
        <rect x="45" y="65" width="10" height="12" fill="#922b21" stroke="#7b241c" strokeWidth="1"/>
        <ellipse cx="50" cy="82" rx="16" ry="6" fill="#922b21" stroke="#7b241c" strokeWidth="1.5"/>
        <ellipse cx="50" cy="82" rx="11" ry="3.5" fill="#c0392b"/>
      </svg>
    );
  }
  
  return null;
};

// Get figure name for Spanish cards
const getFigureName = (number) => {
  if (number === 10) return 'SOTA';
  if (number === 11) return 'CABALLO';
  if (number === 12) return 'REY';
  return null;
};

const PlayingCard = ({ card, size = 'md', onClick, selected, disabled, faceDown }) => {
  // Mobile-first sizes
  const sizeConfig = {
    xs: { w: 'w-10', h: 'h-[60px]', iconSize: 16, fontSize: 'text-[10px]', cornerSize: 8, figSize: 'text-[7px]' },
    sm: { w: 'w-12', h: 'h-[72px]', iconSize: 20, fontSize: 'text-xs', cornerSize: 10, figSize: 'text-[8px]' },
    md: { w: 'w-14', h: 'h-[84px]', iconSize: 26, fontSize: 'text-sm', cornerSize: 12, figSize: 'text-[9px]' },
    lg: { w: 'w-[68px]', h: 'h-[100px]', iconSize: 32, fontSize: 'text-base', cornerSize: 14, figSize: 'text-[10px]' },
  };

  const cfg = sizeConfig[size] || sizeConfig.md;

  // Card back
  if (!card || card.hidden || faceDown) {
    return (
      <div 
        className={`${cfg.w} ${cfg.h} rounded-lg shadow-lg cursor-default flex-shrink-0
          bg-gradient-to-br from-[#1a237e] via-[#283593] to-[#1a237e]
          border border-[#5c6bc0]/50`}
        onClick={onClick}
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}
      >
        <div className="w-full h-full flex items-center justify-center p-1 rounded-lg">
          <div className="w-full h-full rounded border border-[#7986cb]/40 flex items-center justify-center"
            style={{
              backgroundImage: `repeating-conic-gradient(#3949ab 0% 25%, #283593 0% 50%)`,
              backgroundSize: '8px 8px'
            }}
          >
            <div className="bg-[#1a237e] rounded-full w-5 h-5 flex items-center justify-center border border-[#7986cb]/50">
              <span className="text-[#7986cb] text-[8px] font-bold">T</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const suit = SUITS[card.suit];
  const figureName = getFigureName(card.number);
  const isSpecial = (card.number === 1 && (card.suit === 'espadas' || card.suit === 'bastos')) ||
                    (card.number === 7 && (card.suit === 'espadas' || card.suit === 'oros'));

  return (
    <motion.div
      whileHover={!disabled ? { y: -4, scale: 1.03 } : {}}
      whileTap={!disabled ? { scale: 0.97 } : {}}
      className={`
        ${cfg.w} ${cfg.h} rounded-lg shadow-lg cursor-pointer relative overflow-hidden flex-shrink-0
        bg-gradient-to-b from-[#FFFFF0] to-[#F5F0DC]
        border-2 ${selected ? 'border-yellow-400' : 'border-gray-300'}
        ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
      `}
      onClick={!disabled ? onClick : undefined}
      style={{
        boxShadow: selected 
          ? '0 0 12px rgba(255, 215, 0, 0.7), 0 4px 12px rgba(0,0,0,0.3)' 
          : '0 2px 8px rgba(0, 0, 0, 0.3)'
      }}
    >
      {/* Top left corner */}
      <div className="absolute top-0.5 left-1 flex flex-col items-center z-10 leading-none">
        <span className={`font-black ${cfg.fontSize}`} style={{ color: suit?.color }}>
          {card.number}
        </span>
        <SuitIcon suit={card.suit} size={cfg.cornerSize} />
      </div>

      {/* Center - Main suit icon */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <SuitIcon suit={card.suit} size={cfg.iconSize * 1.4} />
        {figureName && (
          <span className={`${cfg.figSize} font-bold mt-0.5 tracking-wider`} style={{ color: suit?.color }}>
            {figureName}
          </span>
        )}
      </div>

      {/* Bottom right corner (rotated) */}
      <div className="absolute bottom-0.5 right-1 flex flex-col items-center rotate-180 z-10 leading-none">
        <span className={`font-black ${cfg.fontSize}`} style={{ color: suit?.color }}>
          {card.number}
        </span>
        <SuitIcon suit={card.suit} size={cfg.cornerSize} />
      </div>

      {/* Special card indicator (gold star for high-value cards) */}
      {isSpecial && (
        <div className="absolute top-0 right-0 w-3 h-3 bg-[#FFD700] rounded-bl-md z-10 flex items-center justify-center">
          <span className="text-[6px] text-[#0f2818] font-bold">★</span>
        </div>
      )}

      {/* Selected glow */}
      {selected && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-tr from-yellow-400/20 via-transparent to-yellow-400/20 rounded-lg"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
    </motion.div>
  );
};

export default PlayingCard;
