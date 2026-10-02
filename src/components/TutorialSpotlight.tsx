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

type CalloutSide = 'top' | 'bottom' | 'left' | 'right';

type CalloutPlacement = {
  left: number;
  top: number;
  width: number;
  height: number;
  side: CalloutSide;
};

type Box = {
  left: number;
  top: number;
  right: number;
  bottom: number;
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

const placementBox = (placement: CalloutPlacement): Box => ({
  left: placement.left,
  top: placement.top,
  right: placement.left + placement.width,
  bottom: placement.top + placement.height
});

const boxesOverlap = (a: Box, b: Box, gap = 8) =>
  !(
    a.right + gap <= b.left ||
    b.right + gap <= a.left ||
    a.bottom + gap <= b.top ||
    b.bottom + gap <= a.top
  );

const inViewport = (placement: CalloutPlacement, viewport: ViewportSize) =>
  placement.left >= 8 &&
  placement.top >= 8 &&
  placement.left + placement.width <= viewport.width - 8 &&
  placement.top + placement.height <= viewport.height - 8;

export const TutorialSpotlight: React.FC<TutorialSpotlightProps> = ({
  active,
  targets,
  neverRemind,
  onNeverRemindChange,
  onDismiss,
  opacity = 0.92,
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
          const padding = 6;
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

  const isPhone = viewport.width < 560;
  const isTablet = viewport.width >= 560 && viewport.width < 980;
  const calloutWidth = isPhone
    ? Math.min(150, Math.max(126, viewport.width * 0.38))
    : isTablet
    ? 164
    : 178;
  const calloutHeight = isPhone ? 54 : 56;
  const edge = isPhone ? 10 : 14;

  const controlWidth = Math.min(272, viewport.width - 28);
  const controlHeight = 126;
  const controlBox: Box = {
    left: viewport.width / 2 - controlWidth / 2,
    top: viewport.height / 2 - controlHeight / 2,
    right: viewport.width / 2 + controlWidth / 2,
    bottom: viewport.height / 2 + controlHeight / 2
  };

  const usedBoxes: Box[] = [];
  const positions = visibleTargets.map((target, index) => {
    const rect = rects[target.key];
    const targetCenterX = (rect.left + rect.right) / 2;
    const targetCenterY = (rect.top + rect.bottom) / 2;

    const belowCentered: CalloutPlacement = {
      left: clamp(targetCenterX - calloutWidth / 2, edge, viewport.width - calloutWidth - edge),
      top: rect.bottom + 10,
      width: calloutWidth,
      height: calloutHeight,
      side: 'top'
    };

    const aboveCentered: CalloutPlacement = {
      left: clamp(targetCenterX - calloutWidth / 2, edge, viewport.width - calloutWidth - edge),
      top: rect.top - calloutHeight - 10,
      width: calloutWidth,
      height: calloutHeight,
      side: 'bottom'
    };

    const rightSide: CalloutPlacement = {
      left: rect.right + 10,
      top: clamp(targetCenterY - calloutHeight / 2, edge, viewport.height - calloutHeight - edge),
      width: calloutWidth,
      height: calloutHeight,
      side: 'left'
    };

    const leftSide: CalloutPlacement = {
      left: rect.left - calloutWidth - 10,
      top: clamp(targetCenterY - calloutHeight / 2, edge, viewport.height - calloutHeight - edge),
      width: calloutWidth,
      height: calloutHeight,
      side: 'right'
    };

    let candidates: CalloutPlacement[];

    if (target.key === 'logo') {
      candidates = [
        {
          ...belowCentered,
          left: clamp(rect.left, edge, viewport.width - calloutWidth - edge)
        },
        belowCentered,
        rightSide
      ];
    } else if (target.key === 'visitor') {
      candidates = [
        {
          ...belowCentered,
          left: clamp(rect.right - calloutWidth, edge, viewport.width - calloutWidth - edge)
        },
        belowCentered,
        leftSide
      ];
    } else {
      // Keep the photo instruction physically close to the photo. This avoids
      // the long full-screen arrow that looked awkward on phones/tablets/desktops.
      candidates = isPhone
        ? [rightSide, leftSide, belowCentered, aboveCentered]
        : [rightSide, belowCentered, leftSide, aboveCentered];
    }

    let chosen =
      candidates.find(candidate => {
        if (!inViewport(candidate, viewport)) return false;
        const box = placementBox(candidate);
        if (boxesOverlap(box, controlBox, 10)) return false;
        return !usedBoxes.some(used => boxesOverlap(box, used, 8));
      }) ||
      candidates.find(candidate => inViewport(candidate, viewport)) ||
      {
        left: edge,
        top: clamp(
          rect.bottom + 10 + index * (calloutHeight + 8),
          edge,
          viewport.height - calloutHeight - edge
        ),
        width: calloutWidth,
        height: calloutHeight,
        side: 'top' as CalloutSide
      };

    // Final collision guard for very narrow screens: stack the second top
    // callout just enough to keep both boxes readable without stretching arrows.
    let chosenBox = placementBox(chosen);
    let guard = 0;
    while (
      usedBoxes.some(used => boxesOverlap(chosenBox, used, 6)) &&
      guard < 4
    ) {
      chosen = {
        ...chosen,
        top: clamp(
          chosen.top + calloutHeight + 8,
          edge,
          viewport.height - calloutHeight - edge
        )
      };
      chosenBox = placementBox(chosen);
      guard += 1;
    }

    usedBoxes.push(chosenBox);
    return { target, rect, position: chosen };
  });

  const arrowPoints = (rect: SpotlightRect, position: CalloutPlacement) => {
    const targetX = (rect.left + rect.right) / 2;
    const targetY = (rect.top + rect.bottom) / 2;

    switch (position.side) {
      case 'top':
        return {
          x1: position.left + position.width / 2,
          y1: position.top + 2,
          x2: targetX,
          y2: rect.bottom + 2
        };
      case 'bottom':
        return {
          x1: position.left + position.width / 2,
          y1: position.top + position.height - 2,
          x2: targetX,
          y2: rect.top - 2
        };
      case 'left':
        return {
          x1: position.left + 2,
          y1: position.top + position.height / 2,
          x2: rect.right + 2,
          y2: targetY
        };
      case 'right':
        return {
          x1: position.left + position.width - 2,
          y1: position.top + position.height / 2,
          x2: rect.left - 2,
          y2: targetY
        };
    }

    return {
      x1: position.left + position.width / 2,
      y1: position.top + position.height / 2,
      x2: targetX,
      y2: targetY
    };
  };

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
            markerWidth="6"
            markerHeight="6"
            refX="5.2"
            refY="3"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path d="M0,0 L6,3 L0,6 z" fill="var(--color-primary, #c06c84)" />
          </marker>
        </defs>

        <rect
          width={viewport.width}
          height={viewport.height}
          fill={`rgba(0,0,0,${opacity})`}
          mask="url(#echostars-tutorial-mask)"
        />

        {visibleTargets.map(target => {
          const rect = rects[target.key];
          return (
            <rect
              key={`outline-${target.key}`}
              x={rect.left}
              y={rect.top}
              width={Math.max(0, rect.right - rect.left)}
              height={Math.max(0, rect.bottom - rect.top)}
              rx="16"
              ry="16"
              fill="none"
              stroke="rgba(255,255,255,0.92)"
              strokeWidth="2"
            />
          );
        })}

        {positions.map(({ target, rect, position }) => {
          const points = arrowPoints(rect, position);
          return (
            <line
              key={`arrow-${target.key}`}
              x1={points.x1}
              y1={points.y1}
              x2={points.x2}
              y2={points.y2}
              stroke="var(--color-primary, #c06c84)"
              strokeWidth="2.6"
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
          className="fixed pointer-events-none flex items-center justify-center rounded-xl sm:rounded-2xl border border-white/90 bg-[var(--color-primary)] text-white px-2.5 py-2 shadow-xl"
          style={{
            left: position.left,
            top: position.top,
            width: position.width,
            height: position.height,
            zIndex: zIndex + 10
          }}
        >
          <p
            className="font-black text-center"
            style={{
              fontSize: isPhone ? 13 : 14,
              lineHeight: 1.32,
              whiteSpace: 'normal',
              wordBreak: 'keep-all',
              overflowWrap: 'break-word'
            }}
          >
            {target.text}
          </p>
        </div>
      ))}

      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[110] rounded-3xl border border-white/30 bg-slate-950/95 text-white px-3.5 py-3.5 shadow-2xl"
        style={{ width: controlWidth }}
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
          className="mt-2.5 w-full rounded-xl bg-white text-slate-950 px-4 py-2.5 font-black shadow-md"
        >
          知道了
        </button>
      </div>
    </>
  );
};
