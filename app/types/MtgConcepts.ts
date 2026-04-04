import type { Modifier } from '~/types/PlayArea';

export const MODIFIERS: Array<Modifier> = [
  // Counters
  { name: '+1/+1', symbol: 'ms ms-counter-plus' },
  { name: '-1/-1', symbol: 'ms ms-counter-minus' },
  { name: 'Loyalty', symbol: 'ms ms-counter-loyalty' },
  { name: 'Charge', symbol: 'ms ms-counter-charge' },
  { name: 'Shield', symbol: 'ms ms-counter-shield' },
  { name: 'Poison', symbol: 'ms ms-counter-skull' },
  { name: 'Lore', symbol: 'ms ms-counter-lore' },
  { name: 'Stun', symbol: 'ms ms-counter-stun' },
  { name: 'Goad', symbol: 'ms ms-counter-goad' },

  // Keyword abilities
  { name: 'Flying', symbol: 'ms ms-ability-flying' },
  { name: 'Haste', symbol: 'ms ms-ability-haste' },
  { name: 'Trample', symbol: 'ms ms-ability-trample' },
  { name: 'Vigilance', symbol: 'ms ms-ability-vigilance' },
  { name: 'Deathtouch', symbol: 'ms ms-ability-deathtouch' },
  { name: 'Lifelink', symbol: 'ms ms-ability-lifelink' },
  { name: 'Hexproof', symbol: 'ms ms-ability-hexproof' },
  { name: 'Indestructible', symbol: 'ms ms-ability-indestructible' },
  { name: 'First Strike', symbol: 'ms ms-ability-first-strike' },
  { name: 'Double Strike', symbol: 'ms ms-ability-double-strike' },
  { name: 'Menace', symbol: 'ms ms-ability-menace' },
  { name: 'Reach', symbol: 'ms ms-ability-reach' },
  { name: 'Decayed', symbol: 'ms ms-ability-decayed' },
];
