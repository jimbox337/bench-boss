import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { Player, PlayerOutlook } from '@/lib/calculator';

const client = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

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

    const prompt = `You are an expert fantasy hockey analyst. Analyze this player and provide a detailed outlook.

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
- Recent performance trends
- Team context and linemates
- Ice time and power play usage (infer from PPP)`;

    const completion = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile', // FREE Groq model (updated)
      messages: [{
        role: 'user',
        content: prompt
      }],
      temperature: 0.7,
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
