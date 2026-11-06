'use client';

import { useMemo, useState } from 'react';
import { ArrowLeftRight, RotateCcw } from 'lucide-react';
import { usePlayerCard } from '@/components/player/PlayerCardProvider';
import { BalanceBar, PlayerChip, PlayerSearch, ScoringNote, ToolHeader, useToolData, type ToolPlayer } from '@/components/tools/toolkit';
import { tradeVerdict } from '@/lib/toolVerdicts';

function Side({ title, ids, rows, pool, exclude, onAdd, onRemove, total, tone }: {
  title: string;
  ids: string[];
  rows: Map<string, ToolPlayer>;
  pool: ToolPlayer[];
  exclude: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  total: number;
  tone?: 'win' | 'loss';
}) {
  const { openPlayer } = usePlayerCard();
  return (
    <section className="tk-card" aria-label={title}>
      <div className="flex items-baseline justify-between gap-3">
        <h2>{title}</h2>
        <span className="text-sm text-muted"><strong className="text-ink tabular-nums">{total.toFixed(1)}</strong> pts / wk</span>
      </div>
      <div className="mt-4 space-y-2.5">
        {ids.map((id) => {
          const row = rows.get(id);
          return row ? <PlayerChip key={id} row={row} tone={tone} onOpen={() => openPlayer(id)} onRemove={() => onRemove(id)} /> : null;
        })}
        <PlayerSearch rows={pool} exclude={exclude} onPick={(row) => onAdd(row.player.id)} placeholder={ids.length ? 'Add another player' : 'Search for a player'} />
      </div>
    </section>
  );
}

export default function TradeAnalyzer() {
  const { byId, myTeam, scoring } = useToolData();
  const [receive, setReceive] = useState<string[]>([]);
  const [send, setSend] = useState<string[]>([]);

  const all = useMemo(() => [...byId.values()], [byId]);
  const mine = useMemo(() => new Set(myTeam.map((p) => p.id)), [myTeam]);
  // With a roster, I send my players and receive anyone else; without one, either side is open.
  const sendPool = useMemo(() => (mine.size ? all.filter((r) => mine.has(r.player.id)) : all), [all, mine]);
  const receivePool = useMemo(() => (mine.size ? all.filter((r) => !mine.has(r.player.id)) : all), [all, mine]);

  const total = (ids: string[]) => ids.reduce((sum, id) => sum + (byId.get(id)?.fpts ?? 0), 0);
  const inValue = total(receive);
  const outValue = total(send);
  const ready = receive.length > 0 && send.length > 0;
  const share = inValue + outValue > 0 ? inValue / (inValue + outValue) : 0.5;
  const verdict = tradeVerdict(share);
  const net = inValue - outValue;
  const taken = [...receive, ...send];

  return (
    <div className="bb-page">
      <ToolHeader accent="trade" eyebrow="Trade analyzer" title="Know before you send" blurb="Add the players on each side. The verdict updates as you build the deal, from each player's projected fantasy points." />

      <section className="tk-card tk-verdict mb-5" aria-live="polite">
        {ready ? (
          <>
            <p className={`tk-verdict-title is-${verdict.tone}`}>{verdict.title}</p>
            <p className="tk-verdict-sub">
              {Math.abs(net) < 0.05 ? 'Both sides project the same this week.' : `You ${net > 0 ? 'gain' : 'lose'} ${Math.abs(net).toFixed(1)} projected points per week.`}
            </p>
            <BalanceBar share={share} label="Share of the trade's projected value on your side" />
            <div className="mx-auto mt-2 flex max-w-[34rem] justify-between text-xs text-muted"><span>You get {Math.round(share * 100)}%</span><span>They get {100 - Math.round(share * 100)}%</span></div>
          </>
        ) : (
          <>
            <p className="tk-verdict-title"><ArrowLeftRight className="mr-2 inline h-7 w-7 align-[-4px] text-muted" aria-hidden="true" />Build a trade</p>
            <p className="tk-verdict-sub">Add at least one player to each side to see who wins.</p>
          </>
        )}
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <Side
          title="I receive"
          ids={receive}
          rows={byId}
          pool={receivePool}
          exclude={taken}
          onAdd={(id) => setReceive((ids) => [...ids, id])}
          onRemove={(id) => setReceive((ids) => ids.filter((x) => x !== id))}
          total={inValue}
          tone={ready ? (verdict.tone === 'win' ? 'win' : undefined) : undefined}
        />
        <Side
          title="They receive"
          ids={send}
          rows={byId}
          pool={sendPool}
          exclude={taken}
          onAdd={(id) => setSend((ids) => [...ids, id])}
          onRemove={(id) => setSend((ids) => ids.filter((x) => x !== id))}
          total={outValue}
          tone={ready ? (verdict.tone === 'loss' ? 'win' : undefined) : undefined}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className="bb-button-secondary inline-flex items-center gap-2" disabled={!taken.length} onClick={() => { setReceive(send); setSend(receive); }}>
          <ArrowLeftRight size={15} aria-hidden="true" /> Swap sides
        </button>
        <button type="button" className="bb-button-secondary inline-flex items-center gap-2" disabled={!taken.length} onClick={() => { setReceive([]); setSend([]); }}>
          <RotateCcw size={15} aria-hidden="true" /> Clear
        </button>
        {mine.size === 0 && <span className="text-xs text-muted">Tip: add your roster on My team and &ldquo;They receive&rdquo; will only show your players.</span>}
      </div>

      <ScoringNote label={scoring.label} />
    </div>
  );
}
