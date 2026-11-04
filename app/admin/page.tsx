'use client';

import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, ShieldCheck, Users } from 'lucide-react';

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
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [securingESPN, setSecuringESPN] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    fetch('/api/admin/users')
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load users');
        setUsers(data.users);
        setCurrentUserId(data.currentUserId);
      })
      .catch(caught => setError(caught instanceof Error ? caught.message : 'Unable to load users'))
      .finally(() => setLoading(false));
  }, []);

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return users;
    return users.filter(user =>
      [user.username, user.email, user.firstName, user.lastName].some(value => value?.toLowerCase().includes(needle)),
    );
  }, [query, users]);

  const updateUser = async (user: ManagedUser, updates: Pick<ManagedUser, 'role' | 'status'>) => {
    setSavingId(user.id);
    setError('');
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, ...updates }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to update user');
      setUsers(current => current.map(item => item.id === user.id ? data.user : item));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update user');
    } finally {
      setSavingId('');
    }
  };

  const syncLegacyUsers = async () => {
    setSyncing(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/users', { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || data.failed?.[0]?.error || 'Unable to sync users');
      setNotice(`${data.created} legacy ${data.created === 1 ? 'account' : 'accounts'} added to Supabase Auth.`);
      setUsers(current => current.map(user => ({ ...user, authLinked: true })));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to sync users');
    } finally {
      setSyncing(false);
    }
  };

  const secureESPNCredentials = async () => {
    setSecuringESPN(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/espn-credentials', { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Unable to secure ESPN credentials');
      setNotice(data.secured
        ? `${data.secured} legacy ESPN ${data.secured === 1 ? 'connection' : 'connections'} encrypted.`
        : 'All ESPN connections are already encrypted.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to secure ESPN credentials');
    } finally {
      setSecuringESPN(false);
    }
  };

  if (loading) return <div className="bb-page"><div className="bb-panel p-8 text-muted">Loading users…</div></div>;

  return (
    <div className="bb-page">
      <header className="bb-page-header">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-accent"><ShieldCheck className="h-4 w-4" /> Admin access</div>
          <h1>User management</h1>
          <p>Review accounts, control roles, and suspend access without opening Supabase.</p>
        </div>
      </header>

      {error && <div className="mb-5 border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">{error}</div>}
      {notice && <div className="mb-5 border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">{notice}</div>}

      <section className="mb-5 grid gap-4 sm:grid-cols-3">
        <div className="bb-panel p-5"><p className="text-xs font-medium text-muted">Total users</p><p className="mt-2 text-3xl font-semibold text-ink">{users.length}</p></div>
        <div className="bb-panel p-5"><p className="text-xs font-medium text-muted">Active</p><p className="mt-2 text-3xl font-semibold text-success">{users.filter(user => user.status === 'active').length}</p></div>
        <div className="bb-panel p-5"><p className="text-xs font-medium text-muted">Admins</p><p className="mt-2 text-3xl font-semibold text-accent">{users.filter(user => user.role === 'admin').length}</p></div>
      </section>

      <section className="bb-panel overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-rule p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2"><Users className="h-5 w-5 text-accent" /><h2 className="text-lg font-semibold">Accounts</h2></div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button type="button" onClick={() => void secureESPNCredentials()} disabled={securingESPN} className="fantasy-button inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-60"><ShieldCheck className="h-4 w-4" />{securingESPN ? 'Securing' : 'Secure ESPN data'}</button>
            {users.some(user => !user.authLinked) && <button type="button" onClick={() => void syncLegacyUsers()} disabled={syncing} className="fantasy-button inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />{syncing ? 'Syncing' : 'Sync legacy users'}</button>}
            <label className="relative block w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input value={query} onChange={event => setQuery(event.target.value)} className="bb-field w-full pl-9" placeholder="Search users" aria-label="Search users" />
            </label>
          </div>
        </div>

        <div className="divide-y divide-rule">
          {filteredUsers.map(user => {
            const isSelf = user.id === currentUserId;
            const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
            return (
              <article key={user.id} className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_110px_150px_150px] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-ink">{name}</h3>{isSelf && <span className="bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">You</span>}</div>
                  <p className="mt-1 truncate text-sm text-muted">{user.email} · @{user.username}</p>
                  <p className="mt-1 text-xs text-muted">{user._count.teams} teams · Joined {new Date(user.createdAt).toLocaleDateString()} · {user.emailVerified ? 'Verified' : 'Unverified'} · {user.authLinked ? 'Supabase linked' : 'Legacy login'}</p>
                </div>
                <span className={`w-fit px-2 py-1 text-xs font-medium ${user.status === 'active' ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>{user.status}</span>
                <label className="text-xs text-muted">Role<select className="bb-field mt-1 w-full" value={user.role} disabled={savingId === user.id || isSelf} onChange={event => void updateUser(user, { role: event.target.value as ManagedUser['role'], status: user.status })}><option value="user">User</option><option value="admin">Admin</option></select></label>
                <label className="text-xs text-muted">Access<select className="bb-field mt-1 w-full" value={user.status} disabled={savingId === user.id || isSelf} onChange={event => void updateUser(user, { role: user.role, status: event.target.value as ManagedUser['status'] })}><option value="active">Active</option><option value="suspended">Suspended</option></select></label>
              </article>
            );
          })}
          {!filteredUsers.length && <p className="p-8 text-center text-muted">No users match that search.</p>}
        </div>
      </section>
    </div>
  );
}
