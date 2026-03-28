import { NextResponse } from 'next/server';

const NHL_WEB_API = 'https://api-web.nhle.com/v1';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const playerId = searchParams.get('playerId');

  if (!playerId) {
    return NextResponse.json({ success: false, error: 'playerId required' }, { status: 400 });
  }

  try {
    const [gameLogRes, landingRes] = await Promise.all([
      fetch(`${NHL_WEB_API}/player/${playerId}/game-log/20252026/2`),
      fetch(`${NHL_WEB_API}/player/${playerId}/landing`),
    ]);

    const gameLogs: any[] = [];
    if (gameLogRes.ok) {
      const data = await gameLogRes.json();
      const raw = data.gameLog || [];
      raw.slice(0, 15).forEach((g: any) => {
        gameLogs.push({
          gameDate: g.gameDate,
          opponentAbbrev: g.opponentAbbrev,
          homeRoadFlag: g.homeRoadFlag,
          goals: g.goals ?? 0,
          assists: g.assists ?? 0,
          points: (g.goals ?? 0) + (g.assists ?? 0),
          plusMinus: g.plusMinus ?? 0,
          powerPlayPoints: g.powerPlayPoints ?? 0,
          shots: g.shots ?? 0,
          hits: g.hits ?? 0,
          blockedShots: g.blockedShots ?? 0,
          penaltyMinutes: g.penaltyMinutes ?? 0,
          toi: g.toi ?? null,
          wins: g.wins,
          savePctg: g.savePctg,
          goalsAgainst: g.goalsAgainst,
        });
      });
    }

    let injury: { status: string | null; description: string | null } = {
      status: null,
      description: null,
    };

    if (landingRes.ok) {
      const landing = await landingRes.json();
      injury.status = landing.currentTeamRoster?.injuryStatus ?? null;
      injury.description = landing.currentTeamRoster?.injuryDescription ?? null;
    }

    return NextResponse.json({ success: true, gameLogs, injury });
  } catch (error) {
    console.error('Game log error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch game log' }, { status: 500 });
  }
}
