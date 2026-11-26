import type { Modifier } from '~/types/PlayArea';

/**
 * Every counter and keyword a card can carry, in menu order. Saved cards
 * store only the `key` (#155), so a name or mana-font class can change here
 * without leaving saved cards stale. Keys never change once shipped.
 */
export const MODIFIERS = [
  // Counters
  { key: 'plus-one', name: '+1/+1', symbol: 'ms ms-counter-plus' },
  { key: 'minus-one', name: '-1/-1', symbol: 'ms ms-counter-minus' },
  { key: 'loyalty', name: 'Loyalty', symbol: 'ms ms-counter-loyalty' },
  { key: 'charge', name: 'Charge', symbol: 'ms ms-counter-charge' },
  { key: 'shield', name: 'Shield', symbol: 'ms ms-counter-shield' },
  { key: 'poison', name: 'Poison', symbol: 'ms ms-counter-skull' },
  { key: 'lore', name: 'Lore', symbol: 'ms ms-counter-lore' },
  { key: 'stun', name: 'Stun', symbol: 'ms ms-counter-stun' },
  { key: 'goad', name: 'Goad', symbol: 'ms ms-counter-goad' },
  // Preparation cards' spell can be cast while prepared (#146). Mana has no
  // prepared symbol; Learn's book suits the Strixhaven cards.
  { key: 'prepared', name: 'Prepared', symbol: 'ms ms-ability-learn' },

  // Keyword abilities
  { key: 'flying', name: 'Flying', symbol: 'ms ms-ability-flying' },
  { key: 'haste', name: 'Haste', symbol: 'ms ms-ability-haste' },
  { key: 'trample', name: 'Trample', symbol: 'ms ms-ability-trample' },
  { key: 'vigilance', name: 'Vigilance', symbol: 'ms ms-ability-vigilance' },
  { key: 'deathtouch', name: 'Deathtouch', symbol: 'ms ms-ability-deathtouch' },
  { key: 'lifelink', name: 'Lifelink', symbol: 'ms ms-ability-lifelink' },
  { key: 'hexproof', name: 'Hexproof', symbol: 'ms ms-ability-hexproof' },
  {
    key: 'indestructible',
    name: 'Indestructible',
    symbol: 'ms ms-ability-indestructible',
  },
  {
    key: 'first-strike',
    name: 'First Strike',
    symbol: 'ms ms-ability-first-strike',
  },
  {
    key: 'double-strike',
    name: 'Double Strike',
    symbol: 'ms ms-ability-double-strike',
  },
  { key: 'menace', name: 'Menace', symbol: 'ms ms-ability-menace' },
  { key: 'reach', name: 'Reach', symbol: 'ms ms-ability-reach' },
  { key: 'decayed', name: 'Decayed', symbol: 'ms ms-ability-decayed' },
] as const satisfies readonly Modifier[];

export type ModifierKey = (typeof MODIFIERS)[number]['key'];

const byKey = new Map<string, Modifier>(MODIFIERS.map((m) => [m.key, m]));

/** The modifier with this key, or undefined for an unknown key. */
export function modifierByKey(key: string): Modifier | undefined {
  return byKey.get(key);
}

/**
 * Whether a modifier is a counter, which proliferate adds to (#222).
 * Keywords aren't, and nor is Prepared, a state rather than a counter.
 */
export function isCounter(key: ModifierKey): boolean {
  return byKey.get(key)!.symbol.includes('ms-counter-');
}

export function isModifierKey(value: unknown): value is ModifierKey {
  return typeof value === 'string' && byKey.has(value);
}
