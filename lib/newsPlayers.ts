// Find NHL players named in a headline or summary. Full names only: last names
// alone ("Hughes", "Tkachuk") are too ambiguous to tag a story with.

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function playersInText<T extends { name: string }>(text: string, players: T[], limit = 6): T[] {
  const haystack = ` ${fold(text).replace(/[^a-z0-9'.-]+/g, ' ')} `;
  const found: { player: T; at: number }[] = [];
  const seen = new Set<string>();
  for (const player of players) {
    const name = fold(player.name).replace(/[^a-z0-9'.-]+/g, ' ').trim();
    if (!name.includes(' ') || seen.has(name)) continue;
    // Possessives ("McDavid's") still count as a mention.
    const at = haystack.search(new RegExp(` ${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:'s)? `));
    if (at >= 0) {
      seen.add(name);
      found.push({ player, at });
    }
  }
  return found.sort((a, b) => a.at - b.at).slice(0, limit).map(({ player }) => player);
}
