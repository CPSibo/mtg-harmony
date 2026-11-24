import { describe, expect, it } from 'vitest';
import { scryfallLink } from '~/utils/scryfallLink';

// #157: tampered storage or odd API data mustn't produce a javascript: link.
describe('scryfallLink', () => {
  it('keeps a Scryfall card page', () => {
    const url = 'https://scryfall.com/card/sld/798/discord-lord-of-disharmony';
    expect(scryfallLink(url)).toBe(url);
  });

  it.each([
    'javascript:alert(1)',
    'http://scryfall.com/card/x',
    'https://scryfall.com.evil.example/card',
    'https://evil.example/?https://scryfall.com/',
    '',
    undefined,
  ])('drops %s', (url) => {
    expect(scryfallLink(url)).toBeUndefined();
  });
});
