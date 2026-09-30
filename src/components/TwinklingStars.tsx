import React, { useMemo } from 'react';

interface TwinklingStarsProps {
  density?: 'subtle' | 'normal' | 'dense';
  className?: string;
}

interface StarItem {
  id: number;
  top: number; // percentage
  left: number; // percentage
  size: number; // px
  type: 'sparkle' | 'dot' | 'cross';
  color: string;
  speedClass: string;
  delay: string;
  opacity: number;
}

export const TwinklingStars: React.FC<TwinklingStarsProps> = ({
  density = 'normal',
  className = ''
}) => {
  const stars = useMemo<StarItem[]>(() => {
    const count = density === 'subtle' ? 18 : density === 'dense' ? 42 : 28;
    const colors = [
      '#f59e0b', // warm gold
      '#fbbf24', // bright amber
      '#f43f5e', // rose
      '#ec4899', // pink
      '#38bdf8', // sky cyan
      '#ffffff', // pure starlight
      '#c084fc'  // lilac
    ];

    const speeds = ['star-twinkle-slow', 'star-twinkle-medium', 'star-twinkle-fast'];
    const items: StarItem[] = [];

    // Pre-calculate deterministic pseudo-random positions so it doesn't jitter on re-renders
    for (let i = 0; i < count; i++) {
      const seed = (i * 9301 + 49297) % 233280;
      const rnd1 = seed / 233280;
      const rnd2 = ((seed * 9301 + 49297) % 233280) / 233280;
      const rnd3 = ((seed * 1337 + 7919) % 233280) / 233280;

      const top = Math.round(rnd1 * 94 + 3); // 3% to 97%
      const left = Math.round(rnd2 * 96 + 2); // 2% to 98%
      const sizeType = rnd3;

      let type: 'sparkle' | 'dot' | 'cross' = 'dot';
      let size = 2;

      if (sizeType > 0.75) {
        type = 'sparkle';
        size = Math.round(rnd1 * 6 + 8); // 8px - 14px
      } else if (sizeType > 0.45) {
        type = 'cross';
        size = Math.round(rnd1 * 4 + 5); // 5px - 9px
      } else {
        type = 'dot';
        size = Math.round(rnd1 * 2.5 + 1.5); // 1.5px - 4px
      }

      const color = colors[i % colors.length];
      const speedClass = speeds[i % speeds.length];
      const delay = `${(i * 0.35) % 3.5}s`;
      const opacity = Math.min(0.9, Math.max(0.35, rnd3));

      items.push({
        id: i,
        top,
        left,
        size,
        type,
        color,
        speedClass,
        delay,
        opacity
      });
    }

    return items;
  }, [density]);

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden select-none z-0 ${className}`}
      aria-hidden="true"
    >
      {stars.map(star => {
        if (star.type === 'sparkle') {
          return (
            <div
              key={star.id}
              className={`absolute ${star.speedClass}`}
              style={{
                top: `${star.top}%`,
                left: `${star.left}%`,
                width: `${star.size}px`,
                height: `${star.size}px`,
                animationDelay: star.delay,
                opacity: star.opacity,
                transform: 'translate(-50%, -50%)'
              }}
            >
              <svg
                viewBox="0 0 24 24"
                className="w-full h-full drop-shadow-[0_0_3px_rgba(255,255,255,0.7)]"
                fill={star.color}
              >
                {/* 4-pointed radiant star */}
                <path d="M12 0 L14 9 L23 12 L14 15 L12 24 L10 15 L1 12 L10 9 Z" />
              </svg>
            </div>
          );
        }

        if (star.type === 'cross') {
          return (
            <div
              key={star.id}
              className={`absolute ${star.speedClass}`}
              style={{
                top: `${star.top}%`,
                left: `${star.left}%`,
                width: `${star.size}px`,
                height: `${star.size}px`,
                animationDelay: star.delay,
                opacity: star.opacity,
                transform: 'translate(-50%, -50%)'
              }}
            >
              <svg
                viewBox="0 0 16 16"
                className="w-full h-full"
                fill={star.color}
              >
                <polygon points="8,0 10,6 16,8 10,10 8,16 6,10 0,8 6,6" opacity="0.9" />
              </svg>
            </div>
          );
        }

        return (
          <div
            key={star.id}
            className={`absolute rounded-full ${star.speedClass}`}
            style={{
              top: `${star.top}%`,
              left: `${star.left}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              backgroundColor: star.color,
              boxShadow: `0 0 ${star.size * 2}px ${star.color}`,
              animationDelay: star.delay,
              opacity: star.opacity,
              transform: 'translate(-50%, -50%)'
            }}
          />
        );
      })}
    </div>
  );
};
