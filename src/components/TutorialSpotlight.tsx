import React, { useEffect, useState } from 'react';

interface TutorialSpotlightProps {
  active: boolean;
  targetSelector: string;
  padding?: number;
  opacity?: number;
  zIndex?: number;
}

type SpotlightRect = {
  top: number;
  left: number;
  right: number;
  bottom: number;
};

export const TutorialSpotlight: React.FC<TutorialSpotlightProps> = ({
  active,
  targetSelector,
  padding = 6,
  opacity = 0.74,
  zIndex = 70
}) => {
  const [rect, setRect] = useState<SpotlightRect | null>(null);

  useEffect(() => {
    if (!active || typeof window === 'undefined' || typeof document === 'undefined') {
      setRect(null);
      return;
    }

    let resizeObserver: ResizeObserver | null = null;

    const update = () => {
      const target = document.querySelector<HTMLElement>(targetSelector);
      if (!target) {
        setRect(null);
        return;
      }

      const bounds = target.getBoundingClientRect();
      setRect({
        top: Math.max(0, bounds.top - padding),
        left: Math.max(0, bounds.left - padding),
        right: Math.min(window.innerWidth, bounds.right + padding),
        bottom: Math.min(window.innerHeight, bounds.bottom + padding)
      });

      resizeObserver?.disconnect();
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(update);
        resizeObserver.observe(target);
      }
    };

    update();

    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);

    const mutationObserver = new MutationObserver(update);
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      mutationObserver.disconnect();
      resizeObserver?.disconnect();
    };
  }, [active, targetSelector, padding]);

  if (!active || !rect) return null;

  const shade = `rgba(0, 0, 0, ${opacity})`;
  const holeHeight = Math.max(0, rect.bottom - rect.top);

  return (
    <div aria-hidden="true" className="pointer-events-none">
      <div
        className="fixed left-0 right-0 top-0"
        style={{ height: rect.top, backgroundColor: shade, zIndex }}
      />
      <div
        className="fixed left-0 right-0 bottom-0"
        style={{ top: rect.bottom, backgroundColor: shade, zIndex }}
      />
      <div
        className="fixed left-0"
        style={{
          top: rect.top,
          width: rect.left,
          height: holeHeight,
          backgroundColor: shade,
          zIndex
        }}
      />
      <div
        className="fixed right-0"
        style={{
          top: rect.top,
          left: rect.right,
          height: holeHeight,
          backgroundColor: shade,
          zIndex
        }}
      />
    </div>
  );
};
