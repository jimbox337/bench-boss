import { OUTLOOK_MODEL } from './outlookModel';
import Groq from 'groq-sdk';
import { Player, LeagueSettings } from './calculator';

const client = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

export interface AILineupSuggestion {
  suggestions: string[];
  reasoning: string;
  optimizedLineup: {
    position: string;
    player: Player;
    reason: string;
  }[];
}

export interface AIWaiverAnalysis {
  topTargets: {
    player: Player;
    reason: string;
    priority: 'high' | 'medium' | 'low';
  }[];
  dropCandidates: {
    player: Player;
    reason: string;
  }[];
  summary: string;
}

export interface HotPlayer {
  player: Player;
  trend: 'hot' | 'cold' | 'steady';
  recentStats: string;
  recommendation: string;
}

/** One player entry in the model's JSON reply; names are matched back to real players. */
type AIItem = { playerName: string; position: string; reason: string; priority: 'high' | 'medium' | 'low'; trend: HotPlayer['trend']; recentStats: string; recommendation: string };

/** Drops entries whose name did not match a known player, so generated output cannot add players. */
function withPlayer<T extends { player: Player | undefined }>(items: T[]): (T & { player: Player })[] {
  return items.filter((item): item is T & { player: Player } => Boolean(item.player));
}

/**
 * Analyze lineup and provide evidence-based suggestions.
 */
export async function analyzeLineup(
  roster: Player[],
  availablePlayers: Player[],
  leagueSettings: LeagueSettings
): Promise<AILineupSuggestion> {
  const prompt = `You are a fantasy hockey expert. Analyze this lineup and provide optimization suggestions.

**League Settings:**
- Scoring: ${leagueSettings.scoringType}
- Roster Slots: ${JSON.stringify(leagueSettings.rosterSlots)}
${leagueSettings.pointsPerStat ? `- Points per stat: ${JSON.stringify(leagueSettings.pointsPerStat)}` : ''}

**Current Roster:**
${roster.map(p => `- ${p.name} (${p.nhlTeam}, ${p.positions?.join('/') ?? ''}) - ${p.seasonStats?.PTS || 0} PTS, ${p.seasonStats?.G || 0} G, ${p.seasonStats?.A || 0} A`).join('\n')}

**Available Free Agents (Top 20):**
${availablePlayers.slice(0, 20).map(p => `- ${p.name} (${p.nhlTeam}, ${p.positions?.join('/') ?? ''}) - ${p.seasonStats?.PTS || 0} PTS, ${p.seasonStats?.G || 0} G, ${p.seasonStats?.A || 0} A`).join('\n')}

Provide:
1. Top 3 lineup optimization suggestions
2. Detailed reasoning for each
3. Recommended starting lineup

Format as JSON:
{
  "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"],
  "reasoning": "detailed explanation",
  "optimizedLineup": [{"position": "C", "playerName": "Connor McDavid", "reason": "explanation"}]
}`;

  try {
    const completion = await client.chat.completions.create({
      model: OUTLOOK_MODEL,
      messages: [{
        role: 'user',
        content: prompt
      }],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const responseText = completion.choices[0]?.message?.content || '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);

      // Map player names to actual Player objects
      const optimizedLineup = withPlayer((result.optimizedLineup as AIItem[]).map(item => ({
        position: item.position,
        player: roster.find(p => p.name === item.playerName) || availablePlayers.find(p => p.name === item.playerName),
        reason: item.reason
      })));

      return {
        suggestions: result.suggestions,
        reasoning: result.reasoning,
        optimizedLineup
      };
    }

    throw new Error('Failed to parse insight response');
  } catch (error) {
    console.error('Lineup Insight Error:', error);
    // Return fallback suggestion
    return {
      suggestions: ['Unable to generate lineup suggestions at this time'],
      reasoning: 'Insight service temporarily unavailable',
      optimizedLineup: []
    };
  }
}

/**
 * Analyze waiver wire and suggest pickups/drops
 */
export async function analyzeWaiverWire(
  myTeam: Player[],
  availablePlayers: Player[],
  leagueSettings: LeagueSettings
): Promise<AIWaiverAnalysis> {
  const prompt = `You are a fantasy hockey expert. Analyze waiver wire opportunities.

**My Team:**
${myTeam.map(p => `- ${p.name} (${p.nhlTeam}, ${p.positions?.join('/') ?? ''}) - ${p.seasonStats?.PTS || 0} PTS, ${p.seasonStats?.G || 0} G, ${p.seasonStats?.A || 0} A`).join('\n')}

**Top Available Players:**
${availablePlayers.slice(0, 30).map(p => `- ${p.name} (${p.nhlTeam}, ${p.positions?.join('/') ?? ''}) - ${p.seasonStats?.PTS || 0} PTS, ${p.seasonStats?.G || 0} G, ${p.seasonStats?.A || 0} A`).join('\n')}

**League Scoring:** ${leagueSettings.scoringType}

Identify:
1. Top 5 waiver targets (with priority: high/medium/low)
2. Players I should consider dropping
3. Overall strategy summary

Format as JSON:
{
  "topTargets": [{"playerName": "name", "reason": "why", "priority": "high"}],
  "dropCandidates": [{"playerName": "name", "reason": "why"}],
  "summary": "overall analysis"
}`;

  try {
    const completion = await client.chat.completions.create({
      model: OUTLOOK_MODEL,
      messages: [{
        role: 'user',
        content: prompt
      }],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const responseText = completion.choices[0]?.message?.content || '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);

      const topTargets = withPlayer((result.topTargets as AIItem[]).map(item => ({
        player: availablePlayers.find(p => p.name === item.playerName),
        reason: item.reason,
        priority: item.priority
      })));

      const dropCandidates = withPlayer((result.dropCandidates as AIItem[]).map(item => ({
        player: myTeam.find(p => p.name === item.playerName),
        reason: item.reason
      })));

      return {
        topTargets,
        dropCandidates,
        summary: result.summary
      };
    }

    throw new Error('Failed to parse insight response');
  } catch (error) {
    console.error('Waiver Insight Error:', error);
    return {
      topTargets: [],
      dropCandidates: [],
      summary: 'Player insights temporarily unavailable'
    };
  }
}

/**
 * Detect hot and cold players based on recent performance
 */
export async function detectHotPlayers(
  players: Player[]
): Promise<HotPlayer[]> {
  const prompt = `You are a fantasy hockey analyst. Identify hot, cold, and steady players based on their stats.

**Players:**
${players.slice(0, 50).map(p => `- ${p.name} (${p.nhlTeam}) - GP: ${p.gamesPlayed || 0}, PTS: ${p.seasonStats?.PTS || 0}, G: ${p.seasonStats?.G || 0}, A: ${p.seasonStats?.A || 0}`).join('\n')}

Categorize each player as:
- "hot" (performing above expectations, trending up)
- "cold" (slumping, trending down)
- "steady" (consistent performance)

Format as JSON array:
[
  {"playerName": "name", "trend": "hot", "recentStats": "description", "recommendation": "buy/hold/sell"}
]`;

  try {
    const completion = await client.chat.completions.create({
      model: OUTLOOK_MODEL,
      messages: [{
        role: 'user',
        content: prompt
      }],
      temperature: 0.7,
      max_tokens: 2500,
    });

    const responseText = completion.choices[0]?.message?.content || '';
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);

    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);

      return withPlayer((result as AIItem[]).map(item => ({
        player: players.find(p => p.name === item.playerName),
        trend: item.trend,
        recentStats: item.recentStats,
        recommendation: item.recommendation
      })));
    }

    throw new Error('Failed to parse insight response');
  } catch (error) {
    console.error('Hot Players Detection Error:', error);
    return [];
  }
}
