import { AI_MODEL } from '@/lib/aiModel';
import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { Player, PlayerOutlook } from '@/lib/calculator';

const client = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

async function getVerifiedPlayerContext(player: Player) {
  const [gameLogResult, scheduleResult] = await Promise.allSettled([
    fetch(`https://api-web.nhle.com/v1/player/${player.id}/game-log/now`, { next: { revalidate: 900 } }).then(response => response.ok ? response.json() : null),
    fetch(`https://api-web.nhle.com/v1/club-schedule/${player.nhlTeam}/week/now`, { next: { revalidate: 900 } }).then(response => response.ok ? response.json() : null),
  ]);
  const gameLog = gameLogResult.status === 'fulfilled' ? gameLogResult.value?.gameLog || [] : [];
  const schedule = scheduleResult.status === 'fulfilled' ? scheduleResult.value?.games || [] : [];
  const recent = gameLog.slice(0, 10).map((game: any) => ({
    date: game.gameDate,
    opponent: game.opponentAbbrev,
    goals: game.goals || 0,
    assists: game.assists || 0,
    points: game.points ?? ((game.goals || 0) + (game.assists || 0)),
    shots: game.shots || 0,
    powerPlayPoints: game.powerPlayPoints || 0,
    toi: game.toi || null,
  }));
  const now = Date.now();
  const upcoming = schedule.filter((game: any) => new Date(`${game.gameDate}T23:59:59Z`).getTime() >= now).slice(0, 7).map((game: any) => ({
    date: game.gameDate,
    opponent: game.homeTeam?.abbrev === player.nhlTeam ? game.awayTeam?.abbrev : game.homeTeam?.abbrev,
    venue: game.homeTeam?.abbrev === player.nhlTeam ? 'home' : 'away',
  }));
  return { source: 'NHL API', fetchedAt: new Date().toISOString(), recent, upcoming };
}

export async function POST(request: Request) {
  try {
    const { player }: { player: Player } = await request.json();

    if (!player) {
      return NextResponse.json(
        { success: false, error: 'Player data required' },
        { status: 400 }
      );
    }

    console.log(`Generating AI outlook for ${player.name}...`);

    const verifiedContext = await getVerifiedPlayerContext(player);
    const prompt = `You are an expert fantasy hockey analyst. Analyze this player using only the verified data supplied below. Do not invent injuries, linemates, deployment, news, or role changes. Clearly say when a fact is unavailable.

**Player:** ${player.name}
**Team:** ${player.nhlTeam}
**Position:** ${player.positions.join('/')}
**Games Played:** ${player.gamesPlayed || 0}

**Season Stats:**
- Goals: ${player.seasonStats?.G || 0}
- Assists: ${player.seasonStats?.A || 0}
- Points: ${player.seasonStats?.PTS || 0}
- PPP: ${player.seasonStats?.PPP || 0}
- Shots: ${player.seasonStats?.SOG || 0}
- Hits: ${player.seasonStats?.HIT || 0}
- Blocks: ${player.seasonStats?.BLK || 0}
- +/-: ${player.seasonStats?.plusMinus || 0}

**Verified live context (${verifiedContext.source}, fetched ${verifiedContext.fetchedAt}):**
${JSON.stringify({ recentGames: verifiedContext.recent, upcomingGames: verifiedContext.upcoming }, null, 2)}

Provide a comprehensive fantasy hockey outlook in JSON format:

{
  "summary": "2-3 sentence overview of player's season and current form",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "trend": "Hot" | "Cold" | "Steady",
  "fantasyValue": "Must-Start" | "Start" | "Flex" | "Bench" | "Drop",
  "restOfSeasonProjection": "Prediction for rest of season performance",
  "injuryRisk": "Low" | "Moderate" | "High"
}

Consider:
- Per-game averages vs total stats
- Category contributions (multi-cat players are valuable)
- Recent performance trends from the supplied game log
- Exact team and upcoming opponents from the supplied schedule
- Ice time and power-play production only when present in the supplied data
- Schedule volume and home/away context

Never claim that you searched the web. The NHL API context above is the authoritative live source for this response.`;

    const completion = await client.chat.completions.create({
      model: AI_MODEL,
      messages: [{
        role: 'user',
        content: prompt
      }],
      temperature: 0.25,
      max_tokens: 1500,
    });

    const responseText = completion.choices[0]?.message?.content || '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const outlookData = JSON.parse(jsonMatch[0]);

      const outlook: PlayerOutlook = {
        ...outlookData,
        generatedAt: new Date()
      };

      return NextResponse.json({
        success: true,
        outlook
      });
    }

    throw new Error('Failed to parse AI response');
  } catch (error) {
    console.error('AI Outlook Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
