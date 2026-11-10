import { nextTick } from 'vue';
import { flightKeyframes, sparkleAngles, type ScreenRect } from './keyframes';
import type { CastFlight, CastLanding } from './options';

export interface CastAnimationOptions {
  flight: CastFlight;
  landing: CastLanding;
  duration: number;
}

export interface CastSource {
  element: Element;
  rect: ScreenRect;
}

const EASE = 'cubic-bezier(0.22, 0.8, 0.3, 1)';
const COLOUR = 'var(--ui-primary, #a78bfa)';

function reducedMotion() {
  return (
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function frame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function fixedBox(rect: ScreenRect): Partial<CSSStyleDeclaration> {
  return {
    position: 'fixed',
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: '0',
    pointerEvents: 'none',
    zIndex: '1000',
  };
}

/** A fixed-position copy of `source` at `rect`, on top of everything. */
function makeFlyer(source: Element, rect: ScreenRect): HTMLElement {
  const flyer = source.cloneNode(true) as HTMLElement;
  flyer.removeAttribute('id');
  flyer.classList.remove('opacity-40');
  Object.assign(flyer.style, fixedBox(rect), {
    transformOrigin: 'top left',
    willChange: 'transform',
    filter: 'drop-shadow(0 12px 18px rgb(0 0 0 / 0.45))',
  });
  document.body.appendChild(flyer);
  return flyer;
}

function sparkles(layer: HTMLElement, rect: ScreenRect): Animation[] {
  const reach = Math.max(rect.width, rect.height) * 0.75;
  return sparkleAngles(14).map((angle, i) => {
    const s = document.createElement('div');
    const size = 6 + (i % 3) * 3;
    Object.assign(s.style, {
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '50%',
      background: i % 2 ? '#fff7c2' : COLOUR,
      boxShadow: `0 0 8px 2px ${COLOUR}`,
    });
    layer.appendChild(s);
    const r = reach * (0.7 + (i % 4) * 0.12);
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    return s.animate(
      [
        { transform: 'translate(-50%, -50%) scale(0.2)', opacity: 1 },
        {
          transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(1)`,
          opacity: 0,
        },
      ],
      {
        duration: 650 + (i % 3) * 120,
        easing: 'cubic-bezier(0.1, 0.7, 0.3, 1)',
      },
    );
  });
}

function rings(layer: HTMLElement): Animation[] {
  return [0, 140].map((delay) => {
    const ring = document.createElement('div');
    Object.assign(ring.style, {
      position: 'absolute',
      inset: '0',
      borderRadius: '12px',
      border: `3px solid ${COLOUR}`,
      boxShadow: `0 0 16px ${COLOUR}`,
    });
    layer.appendChild(ring);
    return ring.animate(
      [
        { transform: 'scale(1)', opacity: 0.9 },
        { transform: 'scale(1.6)', opacity: 0 },
      ],
      { duration: 700, delay, easing: 'ease-out', fill: 'backwards' },
    );
  });
}

function glow(layer: HTMLElement): Animation[] {
  layer.style.borderRadius = '12px';
  return [
    layer.animate(
      [
        { boxShadow: `0 0 0 0 ${COLOUR}`, opacity: 1 },
        { boxShadow: `0 0 40px 18px ${COLOUR}`, opacity: 1, offset: 0.3 },
        { boxShadow: `0 0 60px 30px ${COLOUR}`, opacity: 0 },
      ],
      { duration: 1100, easing: 'ease-out' },
    ),
  ];
}

async function land(target: HTMLElement, landing: CastLanding) {
  const pop = target.animate(
    [
      { transform: 'scale(1)' },
      { transform: 'scale(1.08)', offset: 0.35 },
      { transform: 'scale(1)' },
    ],
    { duration: 320, easing: 'ease-out' },
  );
  if (landing === 'none') {
    await pop.finished;
    return;
  }

  const rect = target.getBoundingClientRect();
  const layer = document.createElement('div');
  Object.assign(layer.style, fixedBox(rect));
  document.body.appendChild(layer);

  const effects =
    landing === 'sparkle'
      ? sparkles(layer, rect)
      : landing === 'ring'
        ? rings(layer)
        : glow(layer);

  await Promise.allSettled([pop, ...effects].map((a) => a.finished));
  layer.remove();
}

/**
 * Flies a copy of `source` (where the card was shown, measured before its
 * window closed) onto the newly cast stack, then plays the landing effect.
 * Without a source (a drag-and-drop cast) only the landing plays. Never
 * throws: it's decoration.
 */
export async function playCastAnimation(
  stackId: string,
  source: CastSource | null,
  options: CastAnimationOptions,
) {
  if (reducedMotion() || typeof Element.prototype.animate !== 'function')
    return;
  try {
    await nextTick();
    await frame();
    const target = document.querySelector<HTMLElement>(
      `[data-stack-id="${CSS.escape(stackId)}"] .primary-card`,
    );
    if (!target) return;

    if (source && options.flight !== 'off') {
      const to = target.getBoundingClientRect();
      const flyer = makeFlyer(source.element, source.rect);
      target.style.visibility = 'hidden';
      try {
        await flyer.animate(flightKeyframes(options.flight, source.rect, to), {
          duration: options.duration,
          easing: EASE,
          fill: 'forwards',
        }).finished;
      } finally {
        flyer.remove();
        target.style.visibility = '';
      }
    }
    await land(target, options.landing);
  } catch {
    // Decoration only.
  }
}

/** Where `element` is now, to fly from once its window has closed. */
export function castSource(
  element: Element | null | undefined,
): CastSource | null {
  if (!element) return null;
  const { x, y, width, height } = element.getBoundingClientRect();
  return width && height ? { element, rect: { x, y, width, height } } : null;
}
