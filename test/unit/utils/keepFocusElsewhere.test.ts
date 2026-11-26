import { afterEach, describe, expect, it } from 'vitest';
import { keepFocusElsewhere } from '~/utils/keepFocusElsewhere';

describe('keepFocusElsewhere (#229)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  const closeEvent = () =>
    new Event('focusScope.autoFocusOnUnmount', { cancelable: true });

  it('lets focus go back to the trigger when nothing else has it', () => {
    (document.activeElement as HTMLElement | null)?.blur();
    const e = closeEvent();
    keepFocusElsewhere(e);
    expect(e.defaultPrevented).toBe(false);
  });

  it('keeps focus where it is when another element has taken it', () => {
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    const e = closeEvent();
    keepFocusElsewhere(e);
    expect(e.defaultPrevented).toBe(true);
  });
});
