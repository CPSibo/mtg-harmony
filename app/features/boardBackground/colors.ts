/** A colour the board background can show, in WUBRG order with colourless last (#246). */
export type BoardColor = 'W' | 'U' | 'B' | 'R' | 'G' | 'C';

/** Every board colour, in the order they're always shown. */
export const BOARD_COLORS: readonly BoardColor[] = Object.freeze([
  'W',
  'U',
  'B',
  'R',
  'G',
  'C',
]);

/** A motif key: a colour, or `N` for the blank slot shown when none is picked. */
export type MotifKey = BoardColor | 'N';

export const BOARD_COLOR_NAMES: Readonly<Record<BoardColor, string>> =
  Object.freeze({
    W: 'White',
    U: 'Blue',
    B: 'Black',
    R: 'Red',
    G: 'Green',
    C: 'Colourless',
  });

export const isBoardColor = (v: unknown): v is BoardColor =>
  typeof v === 'string' && (BOARD_COLORS as readonly string[]).includes(v);

/** The valid colours in `list`, once each, in board order. */
export function normalizeBoardColors(list: readonly unknown[]): BoardColor[] {
  return BOARD_COLORS.filter((c) => list.includes(c));
}

/**
 * The sum of the cards' colour identities, in board order: a colourless card
 * adds colourless. Cards saved before identities were kept add nothing.
 */
export function colorsOfCards(
  cards: Iterable<{ scryfallInfo: { color_identity?: readonly string[] } }>,
): BoardColor[] {
  const found = new Set<string>();
  for (const { scryfallInfo } of cards) {
    const identity = scryfallInfo.color_identity;
    if (!identity) continue;
    if (!identity.length) found.add('C');
    for (const c of identity) found.add(c);
  }
  return normalizeBoardColors([...found]);
}

/** The colours and strengths of one theme's background. */
export interface BoardPalette {
  /** The lattice lines and where each motif's ink fades to. */
  neutral: string;
  /** Each motif's ink at its centre. */
  ink: Readonly<Record<MotifKey, string>>;
  /** The main lattice lines' opacity. */
  lines: number;
  /** The motifs' opacity. */
  motifs: number;
}

/** The dark board, as tuned in the prototypes (#246). */
export const DARK_PALETTE: BoardPalette = Object.freeze({
  neutral: '#cfc8bb',
  ink: Object.freeze({
    W: '#fff1bf',
    U: '#6fb3f0',
    B: '#b48ee0',
    R: '#ff7a5c',
    G: '#78d08f',
    C: '#e4e0d8',
    N: '#e8e3d9',
  }),
  lines: 0.1,
  motifs: 0.2,
});

/** The light board: dark ink on the light background, a little stronger. */
export const LIGHT_PALETTE: BoardPalette = Object.freeze({
  neutral: '#5c5548',
  ink: Object.freeze({
    W: '#a8862a',
    U: '#2f6fae',
    B: '#6a4592',
    R: '#c0452f',
    G: '#2f7d48',
    C: '#6f6a62',
    N: '#4a443a',
  }),
  lines: 0.14,
  motifs: 0.35,
});

// The spotlight colours are CSS variables per theme, in Board.vue.
