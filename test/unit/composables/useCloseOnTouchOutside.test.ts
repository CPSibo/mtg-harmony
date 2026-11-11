import { afterEach, describe, expect, it } from 'vitest';
import { effectScope, ref } from 'vue';
import { useCloseOnTouchOutside } from '~/composables/useCloseOnTouchOutside';

function pointerdown(target: EventTarget, pointerType = 'touch') {
  const event = new Event('pointerdown', { bubbles: true }) as PointerEvent;
  Object.assign(event, { pointerType });
  target.dispatchEvent(event);
}

function setup(initiallyOpen = true) {
  const content = document.createElement('div');
  const inside = document.createElement('button');
  content.append(inside);
  const outside = document.createElement('div');
  document.body.append(content, outside);
  const open = ref(initiallyOpen);
  const scope = effectScope();
  scope.run(() => useCloseOnTouchOutside(open, ref(content)));
  return { open, inside, outside, scope };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('useCloseOnTouchOutside', () => {
  it('closes on a touch outside the content (#135)', () => {
    const { open, outside, scope } = setup();
    pointerdown(outside);
    expect(open.value).toBe(false);
    scope.stop();
  });

  // The board stops propagation nowhere, but a card stack's own listener
  // runs in the capture phase; the document's capture listener runs first.
  it('closes even when the target stops the event', () => {
    const { open, outside, scope } = setup();
    outside.addEventListener('pointerdown', (e) => e.stopPropagation());
    pointerdown(outside);
    expect(open.value).toBe(false);
    scope.stop();
  });

  it('stays open on a touch inside the content', () => {
    const { open, inside, scope } = setup();
    pointerdown(inside);
    expect(open.value).toBe(true);
    scope.stop();
  });

  // Reka already closes the window on a mouse press outside.
  it('leaves mouse presses to the dialog', () => {
    const { open, outside, scope } = setup();
    pointerdown(outside, 'mouse');
    expect(open.value).toBe(true);
    scope.stop();
  });

  it('stops listening when its scope ends', () => {
    const { open, outside, scope } = setup();
    scope.stop();
    pointerdown(outside);
    expect(open.value).toBe(true);
  });
});
