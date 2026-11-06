// NHL data labels wingers "L"/"R"; fantasy platforms (and our slots) use "LW"/"RW".
// Match positions through these helpers so both spellings count.

const ALIASES: Record<string, string> = { L: 'LW', R: 'RW' };

export const normalizePosition = (pos: string): string => ALIASES[pos.toUpperCase()] ?? pos.toUpperCase();

export function hasPosition(player: { positions?: string[]; isGoalie?: boolean }, pos: string): boolean {
  const want = normalizePosition(pos);
  if (want === 'G') return Boolean(player.isGoalie) || (player.positions ?? []).some((p) => normalizePosition(p) === 'G');
  return (player.positions ?? []).some((p) => normalizePosition(p) === want);
}

/** Positions for display, e.g. ['L'] -> ['LW']. */
export const displayPositions = (positions: string[] = []) => positions.map(normalizePosition);
