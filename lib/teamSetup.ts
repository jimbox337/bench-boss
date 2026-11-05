import type { Player } from './calculator';

/** Yahoo (and some other platforms) use short or mixed-case team codes. */
const TEAM_ALIASES: Record<string, string> = {
  TB: 'TBL', NJ: 'NJD', LA: 'LAK', SJ: 'SJS', WAS: 'WSH', MON: 'MTL', CLS: 'CBJ', CBS: 'CBJ', NAS: 'NSH',
  CAL: 'CGY', VEG: 'VGK', WIN: 'WPG', ANH: 'ANA', ARI: 'UTA', UTAH: 'UTA', PHO: 'UTA',
};

export const normalizeTeam = (abbrev: string) => {
  const upper = abbrev.trim().toUpperCase();
  return TEAM_ALIASES[upper] || upper;
};

export const normalizeName = (name: string) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();

/** Match external roster entries to NHL players: exact normalized name, preferring same team. */
export function matchPlayers(entries: { name: string; nhlTeam?: string }[], nhlPlayers: Player[]): { matched: Player[]; unmatched: string[] } {
  const byName = new Map<string, Player[]>();
  for (const player of nhlPlayers) {
    const key = normalizeName(player.name);
    byName.set(key, [...(byName.get(key) || []), player]);
  }
  const matched: Player[] = [];
  const unmatched: string[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const candidates = byName.get(normalizeName(entry.name)) || [];
    const team = entry.nhlTeam ? normalizeTeam(entry.nhlTeam) : '';
    const player = candidates.find(p => p.nhlTeam === team) || (candidates.length === 1 ? candidates[0] : undefined);
    if (player && !seen.has(player.id)) { matched.push(player); seen.add(player.id); } else if (!player) unmatched.push(entry.name);
  }
  return { matched, unmatched };
}

/** Test mode roster: real NHL players, the top producers per position by season points (goalies by games). */
export function buildSampleRoster(players: Player[], slots = { C: 3, W: 5, D: 4, G: 2 }): Player[] {
  const skaterScore = (p: Player) => (p.seasonStats?.PTS || 0) + (p.gamesPlayed || 0) * 0.01;
  const byPosition = (codes: string[]) => players.filter(p => !p.isGoalie && p.positions.some(pos => codes.includes(pos)) && (p.gamesPlayed || 0) > 0);
  const pick = (pool: Player[], count: number, used: Set<string>, score: (p: Player) => number) => {
    const chosen = pool.filter(p => !used.has(p.id)).sort((a, b) => score(b) - score(a)).slice(0, count);
    chosen.forEach(p => used.add(p.id));
    return chosen;
  };
  const used = new Set<string>();
  return [
    ...pick(byPosition(['C']), slots.C, used, skaterScore),
    ...pick(byPosition(['L', 'R', 'LW', 'RW']), slots.W, used, skaterScore),
    ...pick(byPosition(['D']), slots.D, used, skaterScore),
    ...pick(players.filter(p => p.isGoalie), slots.G, used, p => p.gamesPlayed || 0),
  ];
}

export const TEST_MODE_PLATFORM = 'Test';
export const isTestPlatform = (platform?: string | null) => platform === TEST_MODE_PLATFORM || platform === 'Custom';
export const platformLabel = (platform?: string | null) => (isTestPlatform(platform) ? 'Test mode' : platform === 'yahoo' ? 'Yahoo' : platform || 'Test mode');
