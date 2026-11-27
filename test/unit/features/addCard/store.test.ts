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

// #244: Add card from the board menu puts the card where it opened.
describe('useAddCard target point', () => {
  it('opens aimed at a board point, or at none', () => {
    const store = useAddCard();
    store.openAddCardWindow({ x: 10, y: 20 });
    expect(store.addCardWindowIsOpen).toBe(true);
    expect(store.target).toEqual({ x: 10, y: 20 });

    store.closeAddCardWindow();
    store.openAddCardWindow();
    expect(store.target).toBeNull();
  });

  it('forgets the point when the window closes, however it closes', () => {
    const store = useAddCard();
    store.openAddCardWindow({ x: 10, y: 20 });
    store.closeAddCardWindow();
    expect(store.target).toBeNull();

    store.openAddCardWindow({ x: 10, y: 20 });
    store.toggleAddCardWindow();
    expect(store.target).toBeNull();

    store.openAddCardWindow({ x: 10, y: 20 });
    store.addCardWindowIsOpen = false;
    expect(store.target).toBeNull();
  });
});
