/** Resolve the active season from the NHL, including offseason rollover. */
export async function getCurrentNHLSeason(): Promise<string> {
  const response = await fetch('https://api-web.nhle.com/v1/standings/now', {
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`NHL season lookup failed: ${response.status}`);
  const data = await response.json();
  const season = String(data.standings?.[0]?.seasonId ?? '');
  if (!/^\d{8}$/.test(season)) throw new Error('NHL returned an invalid season');
  return season;
}
