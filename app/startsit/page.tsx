'use client';

import { useMemo, useState } from 'react';
import { Crown, X } from 'lucide-react';
import { usePlayerCard } from '@/components/player/PlayerCardProvider';
import { Headshot, PlayerSearch, PosBadge, ScoringNote, ToolHeader, primaryPosition, useToolData, type ToolPlayer } from '@/components/tools/toolkit';
import { startSitCall } from '@/lib/toolVerdicts';
import './startsit.css';

const MAX_PLAYERS = 4;

function CompareCard({ row, verdict, scaleMax, onRemove }: {
  row: ToolPlayer;
  verdict: 'start' | 'sit' | null;
  scaleMax: number;
  onRemove: () => void;
}) {
  const { openPlayer } = usePlayerCard();
  const { player, projection, fpts, range, posRank } = row;
  const s = projection?.skaterStats;
  const g = projection?.goalieStats;
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / scaleMax) * 100))}%`;
  const opponents = projection?.context?.opponents ?? [];

  return (
    <article className={`ss-card${verdict ? ` is-${verdict}` : ''}`}>
      {verdict && <span className={`ss-flag ss-flag-${verdict}`}>{verdict === 'start' ? <><Crown size={13} aria-hidden="true" /> Start</> : 'Sit'}</span>}
      <button type="button" className="ss-remove" onClick={onRemove} aria-label={`Remove ${player.name}`}><X size={16} aria-hidden="true" /></button>

      <div className="ss-top">
        <Headshot player={player} size={88} />
        <button type="button" className="ss-name" onClick={() => openPlayer(player.id)}>{player.name}</button>
        <div className="ss-tags"><PosBadge position={primaryPosition(player)} rank={posRank} /><span className="tk-team">{player.nhlTeam}</span></div>
      </div>

      <div className="ss-points">
        <strong>{fpts === null ? '–' : fpts.toFixed(1)}</strong>
        <span>projected pts, next 7 days</span>
      </div>

      {range && fpts !== null && (
        <div className="ss-range" aria-label={`Likely range ${range.low.toFixed(1)} to ${range.high.toFixed(1)} points`}>
          <div className="ss-range-track">
            <span className="ss-range-band" style={{ left: pct(range.low), width: `calc(${pct(range.high)} - ${pct(range.low)})` }} />
            <span className="ss-range-dot" style={{ left: pct(fpts) }} />
          </div>
          <div className="ss-range-labels"><span>{range.low.toFixed(1)}</span><span>likely range</span><span>{range.high.toFixed(1)}</span></div>
        </div>
      )}

      <dl className="ss-stats">
        <div><dt>Games</dt><dd>{projection ? Math.round(projection.gamesPlayed) : '–'}</dd></div>
        {g ? (
          <>
            <div><dt>W</dt><dd>{g.W.toFixed(1)}</dd></div>
            <div><dt>SV</dt><dd>{g.SV.toFixed(0)}</dd></div>
            <div><dt>GA</dt><dd>{g.GA.toFixed(1)}</dd></div>
          </>
        ) : (
          <>
            <div><dt>G</dt><dd>{s ? s.G.toFixed(1) : '–'}</dd></div>
            <div><dt>A</dt><dd>{s ? s.A.toFixed(1) : '–'}</dd></div>
            <div><dt>SOG</dt><dd>{s ? s.SOG.toFixed(1) : '–'}</dd></div>
          </>
        )}
      </dl>

      {opponents.length > 0 && <p className="ss-opps"><span>Schedule</span> {opponents.join(' · ')}</p>}
    </article>
  );
}

export default function StartSit() {
  const { byId, scoring } = useToolData();
  const [ids, setIds] = useState<string[]>([]);
  const pool = useMemo(() => [...byId.values()], [byId]);

  const rows = ids.map((id) => byId.get(id)).filter((r): r is ToolPlayer => Boolean(r));
  const call = startSitCall(rows.map((r) => ({ id: r.player.id, fpts: r.fpts })));
  const winner = call ? byId.get(call.winnerId) : null;
  const scaleMax = Math.max(1, ...rows.map((r) => r.range?.high ?? r.fpts ?? 0)) * 1.05;

  return (
    <div className="bb-page">
      <ToolHeader accent="startsit" eyebrow="Start / sit" title="Who do I start?" blurb="Compare up to four players. We show each one's projected points, likely range and schedule, then make the call." />

      <section className="tk-card tk-verdict mb-5" aria-live="polite">
        {winner && call ? (
          <>
            <p className="tk-verdict-title is-win">Start {winner.player.name}</p>
            <p className="tk-verdict-sub">
              <span className={`ss-confidence ss-confidence-${call.confidence.replace(' ', '-').toLowerCase()}`}>{call.confidence}</span>
              {' '}Projects {call.gap.toFixed(1)} more points than the next option this week.
            </p>
          </>
        ) : (
          <>
            <p className="tk-verdict-title">Pick two players</p>
            <p className="tk-verdict-sub">Search below to add the players you&apos;re choosing between.</p>
          </>
        )}
      </section>

      {ids.length < MAX_PLAYERS && (
        <div className="mb-5 max-w-xl">
          <PlayerSearch rows={pool} exclude={ids} onPick={(row) => setIds((list) => [...list, row.player.id])} placeholder={ids.length ? 'Add another player to compare' : 'Search for a player'} />
        </div>
      )}

      {rows.length > 0 ? (
        <div className="ss-grid">
          {rows.map((row) => (
            <CompareCard
              key={row.player.id}
              row={row}
              verdict={call ? (row.player.id === call.winnerId ? 'start' : 'sit') : null}
              scaleMax={scaleMax}
              onRemove={() => setIds((list) => list.filter((id) => id !== row.player.id))}
            />
          ))}
        </div>
      ) : (
        <div className="tk-empty">No players yet. Try two forwards you&apos;re deciding between this week.</div>
      )}

      <ScoringNote label={scoring.label} />
    </div>
  );
}
