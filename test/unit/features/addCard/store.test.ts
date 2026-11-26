import { describe, expect, it } from 'vitest';
import { useAddCard } from '~/features/addCard';

describe('useAddCard categories', () => {
  it('searches regular cards only by default', () => {
    expect(useAddCard().categories).toEqual(['regular']);
  });

  it('toggles a category on and off', () => {
    const store = useAddCard();
    store.toggleCategory('tokens');
    expect(store.categories).toEqual(['regular', 'tokens']);
    store.toggleCategory('regular');
    expect(store.categories).toEqual(['tokens']);
  });

  it('goes back to regular cards on reset', () => {
    const store = useAddCard();
    store.toggleCategory('extras');
    store.reset();
    expect(store.categories).toEqual(['regular']);
  });
});
