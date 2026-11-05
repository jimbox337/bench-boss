'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useData } from '@/lib/DataContext';
import type { GameStarters, TeamStarter } from '@/lib/goalieStarters';

type Alert = { id: string; tone: 'warning' | 'success' | 'info'; title: string; body: string; href: string };

/** Pure: alerts for the user's goalies and players from today's starter data. */
export function buildAlerts(myTeam: { id: string; name: string; nhlTeam: string; isGoalie: boolean }[], starters: GameStarters[]): Alert[] {
  const alerts: Alert[] = [];
  const byTeam = new Map<string, { starter: TeamStarter; gameId: number }>();
  for (const game of starters) {
    byTeam.set(game.away.team, { starter: game.away.starter, gameId: game.gameId });
    byTeam.set(game.home.team, { starter: game.home.starter, gameId: game.gameId });
  }
  for (const goalie of myTeam.filter(p => p.isGoalie)) {
    const entry = byTeam.get(goalie.nhlTeam);
    if (!entry || entry.starter.status === 'unknown') continue;
    const { starter } = entry;
    const isHim = String(starter.playerId) === goalie.id;
    const confirmed = starter.status === 'confirmed';
    if (isHim) {
      alerts.push({ id: `g-${goalie.id}`, tone: 'success', title: `${goalie.name} ${confirmed ? 'is starting' : 'is the likely starter'}`, body: confirmed ? 'Confirmed from NHL game data.' : 'Not confirmed yet. Based on recent starts.', href: `/games/${entry.gameId}` });
    } else {
      alerts.push({ id: `g-${goalie.id}`, tone: 'warning', title: `${goalie.name} ${confirmed ? 'is not starting' : 'may not start'}`, body: `${starter.name} ${confirmed ? 'started' : 'is the likely starter'} for ${goalie.nhlTeam}.`, href: `/games/${entry.gameId}` });
    }
  }
  const playing = myTeam.filter(p => byTeam.has(p.nhlTeam)).length;
  if (playing) alerts.push({ id: 'playing', tone: 'info', title: `${playing} of your players play today`, body: 'See them on the scoreboard.', href: '/games' });
  return alerts;
}

export default function AlertsMenu() {
  const { myTeam } = useData();
  const [starters, setStarters] = useState<GameStarters[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const load = () => fetch('/api/goalie-starters').then(r => r.json()).then(data => { if (active && data.success) setStarters(data.starters); }).catch(() => {});
    void load();
    const timer = window.setInterval(() => void load(), 180_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const alerts = useMemo(() => buildAlerts(myTeam, starters), [myTeam, starters]);
  const urgent = alerts.filter(a => a.tone === 'warning').length;

  return (
    <div ref={ref} className="relative">
      <button type="button" className="bb-icon-button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-haspopup="true"
        aria-label={`Alerts${alerts.length ? `, ${alerts.length}` : ''}`}>
        <Bell className="h-5 w-5" aria-hidden />
        {alerts.length > 0 && <span className={`bb-badge ${urgent ? 'bb-badge-urgent' : ''}`}>{alerts.length}</span>}
      </button>
      {open && (
        <div className="bb-popover right-0 w-80" role="menu">
          <p className="bb-popover-title">Alerts</p>
          {alerts.length === 0 ? <p className="px-4 pb-4 text-sm text-muted">{myTeam.length ? 'Nothing needs your attention right now.' : 'Add players to your team to get goalie and lineup alerts.'}</p> : (
            <ul>{alerts.map(alert => (
              <li key={alert.id}>
                <Link href={alert.href} role="menuitem" onClick={() => setOpen(false)} className="bb-alert" data-tone={alert.tone}>
                  <span className="bb-alert-dot" aria-hidden />
                  <span><span className="block text-sm font-semibold text-ink">{alert.title}</span><span className="block text-xs text-muted">{alert.body}</span></span>
                </Link>
              </li>
            ))}</ul>
          )}
        </div>
      )}
    </div>
  );
}
