import { nextTick } from 'vue';
import {
  flightKeyframes,
  flightTiming,
  sparkleAngles,
  type ScreenRect,
} from './keyframes';
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

/** A repeatable 0..1 jitter per sparkle, so the burst looks scattered. */
function jitter(i: number, salt: number) {
  const v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

/** Fine magic dust: many tiny bright specks that twinkle and drift down. */
function sparkles(
  layer: HTMLElement,
  rect: ScreenRect,
  count = 32,
  spread = 0.8,
): Animation[] {
  const reach = Math.max(rect.width, rect.height) * spread;
  return sparkleAngles(count).map((base, i) => {
    const s = document.createElement('div');
    const size = 2 + Math.round(jitter(i, 1) * 2);
    const gold = jitter(i, 2) < 0.5;
    Object.assign(s.style, {
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '50%',
      background: gold ? '#fff3b0' : '#ffffff',
      boxShadow: `0 0 3px 1px ${gold ? '#ffd76a' : COLOUR}`,
      // Hidden outside the animation, so none lingers in the middle.
      opacity: '0',
    });
    layer.appendChild(s);
    const angle = base + (jitter(i, 3) - 0.5) * 0.4;
    const r = reach * (0.45 + jitter(i, 4) * 0.6);
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    const fall = 20 + jitter(i, 5) * 25;
    const at = (t: number, drop: number) =>
      `translate(calc(-50% + ${x * t}px), calc(-50% + ${y * t + drop}px))`;
    return s.animate(
      [
        { transform: `${at(0, 0)} scale(0.5)`, opacity: 0 },
        { transform: `${at(0.55, 0)} scale(1.2)`, opacity: 1, offset: 0.25 },
        {
          transform: `${at(0.8, fall * 0.3)} scale(0.8)`,
          opacity: 0.3,
          offset: 0.5,
        },
        {
          transform: `${at(0.9, fall * 0.6)} scale(1)`,
          opacity: 1,
          offset: 0.65,
        },
        { transform: `${at(1, fall)} scale(0.4)`, opacity: 0 },
      ],
      {
        duration: 700 + jitter(i, 6) * 400,
        delay: jitter(i, 7) * 80,
        easing: 'cubic-bezier(0.15, 0.6, 0.35, 1)',
      },
    );
  });
}

/** Expanding outlines; `subtle` is one thin, faint ring. */
function rings(layer: HTMLElement, subtle = false): Animation[] {
  return (subtle ? [0] : [0, 140]).map((delay) => {
    const ring = document.createElement('div');
    Object.assign(ring.style, {
      position: 'absolute',
      inset: '0',
      borderRadius: '12px',
      border: `${subtle ? 2 : 3}px solid ${COLOUR}`,
      boxShadow: `0 0 ${subtle ? 8 : 16}px ${COLOUR}`,
      opacity: '0',
    });
    layer.appendChild(ring);
    return ring.animate(
      [
        { transform: 'scale(1)', opacity: subtle ? 0.55 : 0.9 },
        { transform: `scale(${subtle ? 1.35 : 1.6})`, opacity: 0 },
      ],
      { duration: subtle ? 600 : 700, delay, easing: 'ease-out' },
    );
  });
}

async function land(target: HTMLElement, landing: CastLanding) {
  const pop = target.animate(
    [{ scale: '1' }, { scale: '1.08', offset: 0.35 }, { scale: '1' }],
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
        : [...rings(layer, true), ...sparkles(layer, rect)];

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
        const { easing, landAt } = flightTiming(options.flight);
        const flight = flyer.animate(
          flightKeyframes(options.flight, source.rect, to),
          { duration: options.duration, easing, fill: 'forwards' },
        );
        // Land once the card is there rather than waiting out a still tail.
        await Promise.race([
          flight.finished,
          new Promise((resolve) =>
            setTimeout(resolve, options.duration * landAt),
          ),
        ]);
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

/**
 * A lighter flourish for a card attached to, or put under, another (#124):
 * the moved card pops and sheds a little dust, and the card it joined gives
 * a small nudge. Never throws.
 */
export async function playAttachAnimation(cardId: string, targetId: string) {
  if (reducedMotion() || typeof Element.prototype.animate !== 'function')
    return;
  try {
    await nextTick();
    await frame();
    const moved = cardImage(cardId);
    if (!moved) return;
    const target = cardImage(targetId);

    const rect = moved.getBoundingClientRect();
    const layer = document.createElement('div');
    Object.assign(layer.style, fixedBox(rect));
    document.body.appendChild(layer);

    const animations = [
      moved.animate(
        [{ scale: '1' }, { scale: '1.06', offset: 0.4 }, { scale: '1' }],
        { duration: 260, easing: 'ease-out' },
      ),
      ...sparkles(layer, rect, 14, 0.5),
    ];
    if (target)
      animations.push(
        target.animate(
          [{ scale: '1' }, { scale: '0.97', offset: 0.35 }, { scale: '1' }],
          { duration: 240, easing: 'ease-out' },
        ),
      );

    await Promise.allSettled(animations.map((a) => a.finished));
    layer.remove();
  } catch {
    // Decoration only.
  }
}

/** A board card's image, found by card ID. */
export function cardImage(cardId: string) {
  return document.querySelector<HTMLElement>(
    `[data-card-id="${CSS.escape(cardId)}"] .card-image`,
  );
}

/**
 * The inverse of {@link playAttachAnimation}, for a card detached or taken
 * out (#124): the card slides from where it sat in the stack (`from`,
 * measured before the change) to its own spot with a small twist, sheds a
 * little dust, and the card it left gives a small nudge. Uses the
 * individual `translate`/`rotate`/`scale` properties so the card's own
 * centring transform is kept. Never throws.
 */
export async function playDetachAnimation(
  cardId: string,
  from: ScreenRect | null,
  hostId: string | null,
) {
  if (reducedMotion() || typeof Element.prototype.animate !== 'function')
    return;
  try {
    await nextTick();
    await frame();
    const moved = cardImage(cardId);
    if (!moved) return;
    const host = hostId ? cardImage(hostId) : null;

    const to = moved.getBoundingClientRect();
    const animations: Animation[] = [];

    if (from) {
      // `translate` is in the card's own pixels, so undo the board's zoom.
      const zoom = moved.offsetWidth ? to.width / moved.offsetWidth : 1;
      const dx = (from.x + from.width / 2 - (to.x + to.width / 2)) / zoom;
      const dy = (from.y + from.height / 2 - (to.y + to.height / 2)) / zoom;
      const lean = dx <= 0 ? 1 : -1;
      animations.push(
        moved.animate(
          [
            { translate: `${dx}px ${dy}px`, rotate: '0deg', scale: '1' },
            {
              translate: `${dx * 0.85}px ${dy * 0.85 - 10}px`,
              rotate: `${-6 * lean}deg`,
              scale: '1.06',
              offset: 0.2,
              easing: 'cubic-bezier(0.3, 0.6, 0.5, 1)',
            },
            {
              translate: '0px 0px',
              rotate: `${3 * lean}deg`,
              scale: '0.98',
              offset: 0.8,
              easing: 'ease-out',
            },
            { translate: '0px 0px', rotate: '0deg', scale: '1' },
          ],
          { duration: 380, easing: 'linear' },
        ),
      );
    }
    if (host)
      animations.push(
        host.animate(
          [{ scale: '1' }, { scale: '1.03', offset: 0.35 }, { scale: '1' }],
          { duration: 240, easing: 'ease-out' },
        ),
      );
    await animations[0]?.finished.catch(() => {});

    // Dust where it lands.
    const rect = moved.getBoundingClientRect();
    const layer = document.createElement('div');
    Object.assign(layer.style, fixedBox(rect));
    document.body.appendChild(layer);
    await Promise.allSettled(
      sparkles(layer, rect, 10, 0.45).map((a) => a.finished),
    );
    layer.remove();
  } catch {
    // Decoration only.
  }
}
