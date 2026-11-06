'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Copy, KeyRound, LogOut, RefreshCw, ShieldCheck, UserCog, Users, X } from 'lucide-react';

type AuthFacts = {
  authId: string;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
  providers: string[];
};

type ManagedUser = {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string | null;
  role: 'user' | 'admin';
  status: 'active' | 'suspended';
  emailVerified: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { teams: number };
  authLinked: boolean;
  auth?: AuthFacts | null;
};

type LogLine = { id: number; at: Date; level: 'ok' | 'err' | 'info'; msg: string };

type Pending =
  | { kind: 'update'; user: ManagedUser; role: ManagedUser['role']; status: ManagedUser['status']; title: string; detail: string; risky: boolean }
  | { kind: 'espn'; title: string; detail: string; risky: false }
  | { kind: 'sync'; title: string; detail: string; risky: false };

type SortKey = 'createdAt' | 'lastSignInAt' | 'email';
type Sort = { key: SortKey; dir: 'asc' | 'desc' };

const pad = (value: number) => String(value).padStart(2, '0');

function formatTs(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function relative(value?: string | null) {
  if (!value) return 'never';
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 60) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}

const shortId = (id: string) => (id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id);
const fullName = (user: ManagedUser) => [user.firstName, user.lastName].filter(Boolean).join(' ');

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="adm-copy"
      data-copied={copied}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      title={copied ? 'copied' : `copy ${label}`}
      onClick={event => {
        event.stopPropagation();
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        });
      }}
      onKeyDown={event => event.stopPropagation()}
    >
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
    </button>
  );
}

function StatusPill({ user }: { user: ManagedUser }) {
  if (user.status === 'suspended') return <span className="adm-pill adm-pill-bad">suspended</span>;
  if (!user.emailVerified) return <span className="adm-pill adm-pill-warn">unverified</span>;
  return <span className="adm-pill adm-pill-ok">active</span>;
}

function RolePill({ role }: { role: ManagedUser['role'] }) {
  return <span className={`adm-pill ${role === 'admin' ? 'adm-pill-admin' : 'adm-pill-muted'}`}>{role}</span>;
}

function SortHead({ k, sort, onSort, children, className }: { k: SortKey; sort: Sort; onSort: (key: SortKey) => void; children: React.ReactNode; className?: string }) {
  const active = sort.key === k;
  return (
    <th className={className} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => onSort(k)}>
        {children}
        {active && (sort.dir === 'asc' ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />)}
      </button>
    </th>
  );
}

function commandFor(p: Pending) {
  if (p.kind === 'update') return `bb users update ${p.user.id} --role ${p.role} --status ${p.status}`;
  if (p.kind === 'espn') return 'bb ops espn-credentials --encrypt-legacy';
  return 'bb ops auth-sync --legacy-users';
}

export default function AdminConsolePage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [authWarning, setAuthWarning] = useState('');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | ManagedUser['role']>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended' | 'unverified' | 'legacy'>('all');
  const [sort, setSort] = useState<Sort>({ key: 'createdAt', dir: 'desc' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<LogLine[]>([]);
  const logId = useRef(0);
  const logEnd = useRef<HTMLLIElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const pushLog = useCallback((level: LogLine['level'], msg: string) => {
    logId.current += 1;
    const line = { id: logId.current, at: new Date(), level, msg };
    setLog(current => [...current.slice(-79), line]);
  }, []);

  useEffect(() => { logEnd.current?.scrollIntoView({ block: 'nearest' }); }, [log]);

  const load = useCallback(async (initial = false) => {
    if (!initial) setRefreshing(true);
    try {
      const response = await fetch('/api/admin/users', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setUsers(data.users);
      setCurrentUserId(data.currentUserId);
      setLoadError('');
      setAuthWarning(data.authAvailable === false ? (data.authError || 'Supabase Auth is unavailable') : '');
      if (data.authAvailable === false) pushLog('err', `supabase auth unavailable: ${data.authError || 'unknown error'} (showing database rows only)`);
      pushLog('info', `GET /api/admin/users → ${response.status} (${data.users.length} rows)`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Unable to load users';
      setLoadError(message);
      pushLog('err', `GET /api/admin/users failed: ${message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [pushLog]);

  useEffect(() => {
    const timer = setTimeout(() => void load(true), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const selected = users.find(user => user.id === selectedId) ?? null;
  const me = users.find(user => user.id === currentUserId);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = !!target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName);
      if (event.key === 'Escape') {
        if (pending) { if (!running) setPending(null); }
        else if (selectedId) setSelectedId(null);
        else if (typing) target.blur();
      } else if (event.key === '/' && !typing && !pending) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending, running, selectedId]);

  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter(user => user.status === 'active').length,
    suspended: users.filter(user => user.status === 'suspended').length,
    admins: users.filter(user => user.role === 'admin').length,
    unverified: users.filter(user => !user.emailVerified).length,
    legacy: users.filter(user => !user.authLinked).length,
  }), [users]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = users.filter(user => {
      if (roleFilter !== 'all' && user.role !== roleFilter) return false;
      if (statusFilter === 'active' && user.status !== 'active') return false;
      if (statusFilter === 'suspended' && user.status !== 'suspended') return false;
      if (statusFilter === 'unverified' && user.emailVerified) return false;
      if (statusFilter === 'legacy' && user.authLinked) return false;
      if (!needle) return true;
      return [user.id, user.auth?.authId, user.username, user.email, user.firstName, user.lastName]
        .some(value => value?.toLowerCase().includes(needle));
    });
    const value = (user: ManagedUser) =>
      sort.key === 'email' ? user.email.toLowerCase()
        : sort.key === 'lastSignInAt' ? (user.auth?.lastSignInAt ?? '')
          : user.createdAt;
    return [...filtered].sort((a, b) => {
      const left = value(a);
      const right = value(b);
      const cmp = left < right ? -1 : left > right ? 1 : 0;
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [query, roleFilter, statusFilter, sort, users]);

  const toggleSort = (key: SortKey) =>
    setSort(current => current.key === key
      ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: key === 'email' ? 'asc' : 'desc' });

  const askUpdate = (user: ManagedUser, role: ManagedUser['role'], status: ManagedUser['status']) => {
    const roleChange = role !== user.role;
    setPending({
      kind: 'update', user, role, status,
      title: roleChange ? (role === 'admin' ? 'Grant admin role' : 'Revoke admin role') : (status === 'suspended' ? 'Suspend user' : 'Reactivate user'),
      detail: `${user.email}: ${roleChange ? `role ${user.role} → ${role}` : `status ${user.status} → ${status}`}`,
      risky: status === 'suspended' || (roleChange && role === 'user'),
    });
  };

  const askEspn = () => setPending({
    kind: 'espn',
    title: 'Encrypt legacy ESPN credentials',
    detail: 'Encrypts any ESPN cookies (espn_s2 / SWID) still stored as plain text. Rows that are already encrypted are skipped.',
    risky: false,
  });

  const askSync = () => setPending({
    kind: 'sync',
    title: 'Sync legacy users to Supabase Auth',
    detail: `Creates Supabase Auth accounts for ${stats.legacy} legacy ${stats.legacy === 1 ? 'user' : 'users'} from their existing password hash.`,
    risky: false,
  });

  const runPending = async () => {
    if (!pending) return;
    setRunning(true);
    try {
      if (pending.kind === 'update') {
        const { user, role, status } = pending;
        const response = await fetch('/api/admin/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, role, status }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
        setUsers(current => current.map(item => item.id === user.id
          ? { ...item, ...data.user, authLinked: item.authLinked, auth: item.auth }
          : item));
        pushLog('ok', `PATCH users/${shortId(user.id)} → role=${data.user.role} status=${data.user.status}`);
      } else if (pending.kind === 'espn') {
        const response = await fetch('/api/admin/espn-credentials', { method: 'POST' });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || `HTTP ${response.status}`);
        pushLog('ok', data.secured
          ? `espn-credentials: encrypted ${data.secured} legacy ${data.secured === 1 ? 'connection' : 'connections'}`
          : 'espn-credentials: nothing to do, all connections already encrypted');
      } else {
        const response = await fetch('/api/admin/users', { method: 'POST' });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || data.failed?.[0]?.error || `HTTP ${response.status}`);
        pushLog('ok', `auth-sync: created=${data.created} existing=${data.existing} failed=${data.failed?.length ?? 0}`);
        await load();
      }
    } catch (caught) {
      pushLog('err', `${pending.title.toLowerCase()} failed: ${caught instanceof Error ? caught.message : 'unknown error'}`);
    } finally {
      setPending(null);
      setRunning(false);
    }
  };

  const clearFilters = () => { setQuery(''); setRoleFilter('all'); setStatusFilter('all'); };
  const isSelf = selected?.id === currentUserId;

  return (
    <>
      <header className="adm-top">
        <div className="adm-crumbs">
          <span className="adm-prompt">~/</span>
          <span>bench-boss</span><span className="sep">/</span>
          <span className="adm-dim adm-hide-sm">auth</span><span className="sep adm-hide-sm">/</span>
          <span>users</span>
          <span className="adm-env">admin</span>
        </div>
        <div className="adm-top-right">
          {me && <span className="adm-whoami">whoami: {me.email}</span>}
          <Link href="/" className="adm-btn" aria-label="Exit console and go back to Bench Boss"><LogOut aria-hidden /> <span>exit</span></Link>
        </div>
      </header>

      <div className="adm-frame">
        <nav className="adm-side" aria-label="Admin console">
          <h2>Authentication</h2>
          <a href="#users" aria-current="page"><Users size={14} aria-hidden /> Users</a>
          <h2>Ops</h2>
          <button type="button" onClick={askEspn} disabled={loading}><KeyRound size={14} aria-hidden /> ESPN credentials</button>
          <button type="button" onClick={askSync} disabled={loading || stats.legacy === 0} title={stats.legacy === 0 ? 'All users are linked to Supabase Auth' : undefined}>
            <UserCog size={14} aria-hidden /> Legacy auth sync{stats.legacy > 0 && <span className="adm-green"> ({stats.legacy})</span>}
          </button>
          <h2>Session</h2>
          <Link href="/"><LogOut size={14} aria-hidden /> Back to app</Link>
        </nav>

        <main className="adm-main" id="users">
          <div className="adm-head">
            <h1>Users</h1>
            <p>Accounts in the Bench Boss database, matched to Supabase Auth.</p>
            {authWarning && <p className="adm-warn" role="status">! auth data unavailable: {authWarning}. Showing database rows only; sign-in times, providers and legacy sync are hidden.</p>}
            <div className="adm-stats" aria-label="User totals">
              <span>total=<b>{stats.total}</b></span>
              <span>active=<b className="adm-green">{stats.active}</b></span>
              <span>suspended=<b className={stats.suspended ? 'adm-err' : undefined}>{stats.suspended}</b></span>
              <span>admins=<b>{stats.admins}</b></span>
              <span>unverified=<b>{stats.unverified}</b></span>
              <span>legacy=<b>{stats.legacy}</b></span>
            </div>
          </div>

          <div className="adm-toolbar">
            <label className="adm-search">
              <span aria-hidden>&gt;</span>
              <input
                ref={searchRef}
                className="adm-input"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="search email, username, uid…  [/]"
                aria-label="Search users by email, username, name or ID"
                spellCheck={false}
                autoComplete="off"
              />
            </label>
            <select className="adm-select" value={roleFilter} onChange={event => setRoleFilter(event.target.value as typeof roleFilter)} aria-label="Filter by role">
              <option value="all">role: all</option>
              <option value="admin">role: admin</option>
              <option value="user">role: user</option>
            </select>
            <select className="adm-select" value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)} aria-label="Filter by status">
              <option value="all">status: all</option>
              <option value="active">status: active</option>
              <option value="suspended">status: suspended</option>
              <option value="unverified">status: unverified</option>
              <option value="legacy">auth: legacy only</option>
            </select>
            <button type="button" className="adm-btn adm-btn-icon" onClick={() => void load()} disabled={refreshing || loading} aria-label="Reload users" title="reload">
              <RefreshCw className={refreshing ? 'adm-spin' : undefined} aria-hidden />
            </button>
            <button type="button" className="adm-btn adm-ops-inline" onClick={askEspn} disabled={loading}><KeyRound aria-hidden /> espn</button>
            {stats.legacy > 0 && <button type="button" className="adm-btn adm-ops-inline" onClick={askSync}><UserCog aria-hidden /> sync ({stats.legacy})</button>}
            <span className="adm-count" aria-live="polite">{rows.length} of {users.length} rows</span>
          </div>

          <div className="adm-tablewrap">
            {loading ? (
              <div className="adm-loading"><span className="adm-dim adm-cursor">fetching users </span></div>
            ) : loadError && !users.length ? (
              <div className="adm-loading" role="alert">
                <span className="adm-err">error: {loadError}</span>
                <button type="button" className="adm-btn" onClick={() => void load()}>retry</button>
              </div>
            ) : (
              <table className="adm-table">
                <thead>
                  <tr>
                    <th className="col-md">uid</th>
                    <SortHead k="email" sort={sort} onSort={toggleSort}>email</SortHead>
                    <th className="col-lg">username</th>
                    <th className="col-md">role</th>
                    <th>status</th>
                    <th className="col-lg">auth</th>
                    <th className="col-lg">teams</th>
                    <SortHead k="createdAt" sort={sort} onSort={toggleSort} className="col-md">created</SortHead>
                    <SortHead k="lastSignInAt" sort={sort} onSort={toggleSort} className="col-lg">last sign-in</SortHead>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(user => (
                    <tr
                      key={user.id}
                      aria-selected={user.id === selectedId}
                      tabIndex={0}
                      onClick={() => setSelectedId(user.id)}
                      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedId(user.id); } }}
                    >
                      <td className="col-md"><span className="adm-uid" title={user.id}>{shortId(user.id)}<CopyButton value={user.id} label="user ID" /></span></td>
                      <td className="email" title={user.email}>{user.email}{user.id === currentUserId && <span className="adm-you">(you)</span>}</td>
                      <td className="col-lg adm-dim">@{user.username}</td>
                      <td className="col-md"><RolePill role={user.role} /></td>
                      <td><StatusPill user={user} /></td>
                      <td className="col-lg">{authWarning ? <span className="adm-faint">n/a</span> : user.authLinked
                        ? <span className="adm-dim">{user.auth?.providers.length ? user.auth.providers.join(',') : 'linked'}</span>
                        : <span className="adm-pill adm-pill-warn">legacy</span>}</td>
                      <td className="col-lg adm-dim">{user._count.teams}</td>
                      <td className="col-md ts" title={user.createdAt}>{formatTs(user.createdAt)}</td>
                      <td className="col-lg ts" title={user.auth?.lastSignInAt ?? 'never'}>{formatTs(user.auth?.lastSignInAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!loading && users.length > 0 && rows.length === 0 && (
              <div className="adm-empty">0 rows match. <button type="button" className="adm-btn" onClick={clearFilters}>clear filters</button></div>
            )}
          </div>

          <section className="adm-log" aria-label="Console log">
            <div className="adm-log-title">console</div>
            <ol aria-live="polite">
              {log.map(line => (
                <li key={line.id} data-level={line.level}>
                  <time dateTime={line.at.toISOString()}>{pad(line.at.getHours())}:{pad(line.at.getMinutes())}:{pad(line.at.getSeconds())}</time>
                  <span className="msg">{line.msg}</span>
                </li>
              ))}
              <li ref={logEnd}><span className="adm-faint adm-cursor">ready </span></li>
            </ol>
          </section>

          {selected && (
            <aside className="adm-panel" aria-label={`User details for ${selected.email}`}>
              <div className="adm-panel-head">
                <div style={{ minWidth: 0 }}>
                  <h2>{selected.email}</h2>
                  <p>{fullName(selected) || '—'} · @{selected.username}</p>
                </div>
                <button type="button" className="adm-btn adm-btn-icon" onClick={() => setSelectedId(null)} aria-label="Close user details"><X aria-hidden /></button>
              </div>
              <div className="adm-panel-body">
                <h3>Overview</h3>
                <dl className="adm-kv">
                  <div><dt>user id</dt><dd><span>{selected.id}</span><CopyButton value={selected.id} label="user ID" /></dd></div>
                  <div><dt>auth uid</dt><dd>{selected.auth ? <><span>{selected.auth.authId}</span><CopyButton value={selected.auth.authId} label="auth UID" /></> : <span className="adm-faint">not linked</span>}</dd></div>
                  <div><dt>email</dt><dd><span>{selected.email}</span><CopyButton value={selected.email} label="email" /></dd></div>
                  <div><dt>username</dt><dd>@{selected.username}</dd></div>
                  <div><dt>name</dt><dd>{fullName(selected) || '—'}</dd></div>
                  <div><dt>role</dt><dd><RolePill role={selected.role} /></dd></div>
                  <div><dt>status</dt><dd><StatusPill user={selected} /></dd></div>
                  <div><dt>providers</dt><dd>{selected.auth?.providers.length ? selected.auth.providers.join(', ') : '—'}</dd></div>
                  <div><dt>teams</dt><dd>{selected._count.teams}</dd></div>
                </dl>

                <h3>Timestamps</h3>
                <dl className="adm-kv">
                  <div><dt>created</dt><dd>{formatTs(selected.createdAt)} <span className="adm-faint">{relative(selected.createdAt)}</span></dd></div>
                  <div><dt>updated</dt><dd>{formatTs(selected.updatedAt)} <span className="adm-faint">{relative(selected.updatedAt)}</span></dd></div>
                  <div><dt>email verified</dt><dd>{selected.emailVerified ? formatTs(selected.emailVerified) : <span className="adm-pill adm-pill-warn">no</span>}</dd></div>
                  <div><dt>last sign-in</dt><dd>{selected.auth?.lastSignInAt ? <>{formatTs(selected.auth.lastSignInAt)} <span className="adm-faint">{relative(selected.auth.lastSignInAt)}</span></> : 'never'}</dd></div>
                </dl>

                <h3>Actions</h3>
                {isSelf && <p className="adm-dim" style={{ margin: '0 0 8px' }}>You can&apos;t change your own role or status.</p>}
                <div className="adm-action">
                  <div className="adm-action-row">
                    <div>
                      <strong>{selected.role === 'admin' ? 'Revoke admin' : 'Grant admin'}</strong>
                      <p>{selected.role === 'admin' ? 'Return this account to the standard user role.' : 'Give this account full access to this console.'}</p>
                    </div>
                    <button
                      type="button"
                      className={`adm-btn ${selected.role === 'admin' ? 'adm-btn-warn' : 'adm-btn-go'}`}
                      disabled={isSelf}
                      onClick={() => askUpdate(selected, selected.role === 'admin' ? 'user' : 'admin', selected.status)}
                    >
                      <ShieldCheck aria-hidden /> {selected.role === 'admin' ? 'set user' : 'set admin'}
                    </button>
                  </div>
                  <code>--role {selected.role === 'admin' ? 'user' : 'admin'}</code>
                </div>
                <div className={`adm-action ${selected.status === 'active' ? 'adm-danger' : ''}`}>
                  <div className="adm-action-row">
                    <div>
                      <strong>{selected.status === 'active' ? 'Suspend user' : 'Reactivate user'}</strong>
                      <p>{selected.status === 'active' ? 'Blocks sign-in and API access. Data is kept, and this can be undone.' : 'Restores sign-in and API access.'}</p>
                    </div>
                    <button
                      type="button"
                      className={`adm-btn ${selected.status === 'active' ? 'adm-btn-warn' : 'adm-btn-go'}`}
                      disabled={isSelf}
                      onClick={() => askUpdate(selected, selected.role, selected.status === 'active' ? 'suspended' : 'active')}
                    >
                      {selected.status === 'active' ? 'suspend' : 'activate'}
                    </button>
                  </div>
                  <code>--status {selected.status === 'active' ? 'suspended' : 'active'}</code>
                </div>
              </div>
            </aside>
          )}
        </main>
      </div>

      {pending && (
        <div className="adm-dialog-scrim" onClick={() => { if (!running) setPending(null); }}>
          <div className="adm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="adm-dialog-title" aria-describedby="adm-dialog-detail" onClick={event => event.stopPropagation()}>
            <div className="adm-dialog-head" id="adm-dialog-title">{pending.title}</div>
            <div className="adm-dialog-body">
              <p id="adm-dialog-detail">{pending.detail}</p>
              <pre className="adm-cmd">{commandFor(pending)}</pre>
              <p className="adm-faint">Run this command?</p>
            </div>
            <div className="adm-dialog-foot">
              <button type="button" className="adm-btn" onClick={() => setPending(null)} disabled={running} autoFocus>cancel</button>
              <button type="button" className={`adm-btn ${pending.risky ? 'adm-btn-warn' : 'adm-btn-go'}`} onClick={() => void runPending()} disabled={running}>
                {running ? <><RefreshCw className="adm-spin" aria-hidden /> running</> : 'confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
