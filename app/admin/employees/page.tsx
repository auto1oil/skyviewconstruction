'use client';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

// Admin: list everyone with a login, add a new employee or admin, and change
// roles. New logins get a temporary password shown once here — hand it to the
// person; they'll be asked to pick their own on first sign-in.

type Person = {
  id: string;
  full_name: string | null;
  email: string;
  role: 'employee' | 'admin' | 'master_admin';
  remote_clock: boolean;
  created_at: string;
};

export default function EmployeesPage() {
  const supabase = createClient();
  const [people, setPeople] = useState<Person[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'employee' | 'admin'>('employee');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setMeId(user?.id ?? null);
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, remote_clock, created_at')
      .order('role')
      .order('full_name');
    setPeople((data as Person[]) || []);
    setLoading(false);
  }, [supabase]);
  useEffect(() => { void load(); }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setCreated(null);
    setBusy(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, full_name: name, role }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) { setErr(j.error || 'Could not add the user.'); }
      else {
        setCreated({ email: j.email, password: j.password });
        setName(''); setEmail(''); setRole('employee');
        await load();
      }
    } catch { setErr('Network error.'); }
    setBusy(false);
  }

  async function changeRole(p: Person, newRole: 'employee' | 'admin') {
    if (p.id === meId && newRole !== 'admin') {
      alert("You can't remove your own admin access.");
      return;
    }
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', p.id);
    if (error) { alert('Could not change role: ' + error.message); return; }
    await load();
  }

  async function toggleRemote(p: Person, remote: boolean) {
    setPeople((prev) => prev.map((x) => (x.id === p.id ? { ...x, remote_clock: remote } : x)));
    await supabase.from('profiles').update({ remote_clock: remote }).eq('id', p.id);
  }

  return (
    <div>
      <h1 className="text-lg font-semibold mb-4">Employees</h1>

      <form onSubmit={add} className="bg-white border border-gray-200 rounded-lg p-4 mb-4 space-y-3">
        <h2 className="font-semibold text-sm">Add a login</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="text-xs text-gray-600 flex flex-col">Full name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe"
              className="mt-0.5 border border-gray-300 rounded-md px-3 py-2 text-sm" />
          </label>
          <label className="text-xs text-gray-600 flex flex-col">Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="jane@example.com"
              className="mt-0.5 border border-gray-300 rounded-md px-3 py-2 text-sm" />
          </label>
          <label className="text-xs text-gray-600 flex flex-col">Role
            <select value={role} onChange={(e) => setRole(e.target.value as 'employee' | 'admin')}
              className="mt-0.5 border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
              <option value="employee">Employee</option>
              <option value="admin">Admin</option>
            </select>
          </label>
        </div>
        {err && <p className="text-xs text-red-600">{err}</p>}
        {created && (
          <div className="text-xs bg-green-50 border border-green-200 text-green-900 rounded-md px-3 py-2">
            Login created for <span className="font-medium">{created.email}</span>. Temporary password:{' '}
            <code className="font-mono bg-white border border-green-200 rounded px-1.5 py-0.5">{created.password}</code>
            <span className="block text-green-800 mt-1">Give this to them now — it isn&apos;t shown again. They&apos;ll set their own password when they first sign in.</span>
          </div>
        )}
        <button type="submit" disabled={busy}
          className="px-3 py-1.5 text-sm rounded-md bg-brand-700 text-white hover:bg-brand-900 disabled:opacity-50 font-medium">
          {busy ? 'Adding…' : 'Add login'}
        </button>
      </form>

      {loading ? (
        <p className="text-xs text-gray-500">Loading…</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-left px-3 py-2">Email</th>
                <th className="text-left px-3 py-2">Role</th>
                <th className="text-left px-3 py-2" title="Skip the geofence — may clock in from anywhere">Remote</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-medium">{p.full_name || <span className="text-gray-400">—</span>}</td>
                  <td className="px-3 py-2 text-gray-600 break-all">{p.email}</td>
                  <td className="px-3 py-2">
                    {p.role === 'master_admin' ? (
                      <span className="text-xs">Master admin</span>
                    ) : (
                      <select value={p.role} onChange={(e) => changeRole(p, e.target.value as 'employee' | 'admin')}
                        className="border border-gray-300 rounded-md px-2 py-1 text-xs bg-white">
                        <option value="employee">Employee</option>
                        <option value="admin">Admin</option>
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={!!p.remote_clock} onChange={(e) => toggleRemote(p, e.target.checked)} />
                  </td>
                </tr>
              ))}
              {people.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-xs text-gray-400">No logins yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-gray-400 mt-3">
        To remove someone or reset a password, use the Supabase dashboard (Authentication → Users). Deleting a user also deletes their hours history.
      </p>
    </div>
  );
}
