import React, { useEffect, useState } from 'react';

export interface TutorialTargetSpec {
  key: string;
  selector: string;
  text: string;
}

interface TutorialSpotlightProps {
  active: boolean;
  targets: TutorialTargetSpec[];
  neverRemind: boolean;
  onNeverRemindChange: (checked: boolean) => void;
  onDismiss: () => void;
  opacity?: number;
  zIndex?: number;
}

type SpotlightRect = {
  top: number;
  left: number;
  right: number;
  bottom: number;
};

type ViewportSize = {
  width: number;
  height: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

const findVisibleTarget = (selector: string) => {
  const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));
  return elements.find(element => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      rect.width > 0 &&
      rect.height > 0
    );
  }) || null;
};

export const TutorialSpotlight: React.FC<TutorialSpotlightProps> = ({
  active,
  targets,
  neverRemind,
  onNeverRemindChange,
  onDismiss,
  opacity = 0.9,
  zIndex = 80
}) => {
  const [rects, setRects] = useState<Record<string, SpotlightRect>>({});
  const [viewport, setViewport] = useState<ViewportSize>({ width: 0, height: 0 });

  useEffect(() => {
    if (!active || typeof window === 'undefined' || typeof document === 'undefined') {
      setRects({});
      return;
    }

    let frame = 0;
    let resizeObserver: ResizeObserver | null = null;

    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const next: Record<string, SpotlightRect> = {};
        const observed: HTMLElement[] = [];

        targets.forEach(target => {
          const element = findVisibleTarget(target.selector);
          if (!element) return;

          const bounds = element.getBoundingClientRect();
          const padding = 7;
          next[target.key] = {
            top: Math.max(0, bounds.top - padding),
            left: Math.max(0, bounds.left - padding),
            right: Math.min(window.innerWidth, bounds.right + padding),
            bottom: Math.min(window.innerHeight, bounds.bottom + padding)
          };
          observed.push(element);
        });

        setViewport({ width: window.innerWidth, height: window.innerHeight });
        setRects(next);

        resizeObserver?.disconnect();
        if (typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(update);
          observed.forEach(element => resizeObserver?.observe(element));
        }
      });
    };

    update();
    const delayed = window.setTimeout(update, 180);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    window.addEventListener('scroll', update, true);

    const mutationObserver = new MutationObserver(update);
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.clearTimeout(delayed);
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      window.removeEventListener('scroll', update, true);
      mutationObserver.disconnect();
      resizeObserver?.disconnect();
    };
  }, [active, targets]);

  if (!active || viewport.width <= 0 || viewport.height <= 0) return null;

  const visibleTargets = targets.filter(target => rects[target.key]);
  if (visibleTargets.length === 0) return null;

  const calloutWidth = Math.min(220, Math.max(156, viewport.width - 24));
  const calloutHeight = 58;
  const isNarrow = viewport.width < 700;

  const calloutPosition = (target: TutorialTargetSpec, index: number) => {
    const rect = rects[target.key];
    if (!rect) return { left: 12, top: 90, width: calloutWidth };

    if (index === 0) {
      return {
        left: 12,
        top: clamp(rect.bottom + 12, 78, viewport.height - calloutHeight - 14),
        width: calloutWidth
      };
    }

    if (index === 1) {
      return {
        left: Math.max(12, viewport.width - calloutWidth - 12),
        top: clamp(
          rect.bottom + (isNarrow ? 86 : 12),
          isNarrow ? 154 : 78,
          viewport.height - calloutHeight - 14
        ),
        width: calloutWidth
      };
    }

    return {
      left: 12,
      top: Math.max(12, viewport.height - calloutHeight - 16),
      width: calloutWidth
    };
  };

  const positions = visibleTargets.map((target, index) => ({
    target,
    rect: rects[target.key],
    position: calloutPosition(target, index)
  }));

  return (
    <>
      <svg
        aria-hidden="true"
        className="fixed inset-0 w-full h-full pointer-events-none"
        style={{ zIndex }}
        viewBox={`0 0 ${viewport.width} ${viewport.height}`}
        preserveAspectRatio="none"
      >
        <defs>
          <mask id="echostars-tutorial-mask">
            <rect width={viewport.width} height={viewport.height} fill="white" />
            {visibleTargets.map(target => {
              const rect = rects[target.key];
              return (
                <rect
                  key={target.key}
                  x={rect.left}
                  y={rect.top}
                  width={Math.max(0, rect.right - rect.left)}
                  height={Math.max(0, rect.bottom - rect.top)}
                  rx="16"
                  ry="16"
                  fill="black"
                />
              );
            })}
          </mask>
          <marker
            id="echostars-tutorial-arrow"
            markerWidth="9"
            markerHeight="9"
            refX="8"
            refY="4.5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L9,4.5 L0,9 z" fill="var(--color-primary, #c06c84)" />
          </marker>
        </defs>

        <rect
          width={viewport.width}
          height={viewport.height}
          fill={`rgba(0,0,0,${opacity})`}
          mask="url(#echostars-tutorial-mask)"
        />

        {positions.map(({ target, rect, position }) => {
          const startX = position.left + position.width / 2;
          const startY = position.top + (rect.top < position.top ? 0 : calloutHeight);
          const endX = (rect.left + rect.right) / 2;
          const endY = (rect.top + rect.bottom) / 2;

          return (
            <line
              key={`arrow-${target.key}`}
              x1={startX}
              y1={startY}
              x2={endX}
              y2={endY}
              stroke="var(--color-primary, #c06c84)"
              strokeWidth="5"
              strokeLinecap="round"
              markerEnd="url(#echostars-tutorial-arrow)"
            />
          );
        })}
      </svg>

      {positions.map(({ target, position }) => (
        <div
          key={`callout-${target.key}`}
          role="status"
          className="fixed pointer-events-none rounded-2xl border-2 border-white/90 bg-[var(--color-primary)] text-white px-3 py-2.5 shadow-2xl"
          style={{
            left: position.left,
            top: position.top,
            width: position.width,
            zIndex: zIndex + 10
          }}
        >
          <p className="text-sm sm:text-base font-black leading-snug text-center">
            {target.text}
          </p>
        </div>
      ))}

      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[110] w-[min(300px,calc(100vw-28px))] rounded-3xl border border-white/30 bg-slate-950/95 text-white px-4 py-4 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="首頁新手教學"
      >
        <label className="flex items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={neverRemind}
            onChange={event => onNeverRemindChange(event.target.checked)}
            className="w-4 h-4 rounded border-white/70 accent-white cursor-pointer"
          />
          <span className="font-bold text-sm">永遠不再提醒</span>
        </label>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-3 w-full rounded-xl bg-white text-slate-950 px-4 py-2.5 font-black shadow-md"
        >
          知道了
        </button>
      </div>
    </>
  );
};
