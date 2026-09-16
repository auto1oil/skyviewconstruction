'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

// Set a new password. Used on first sign-in (temp password from an admin) and
// as the landing page for "forgot password" reset links.
export default function AccountPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [mustChange, setMustChange] = useState(false);
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      setEmail(user.email || '');
      const { data } = await supabase.from('profiles').select('must_change_password').eq('id', user.id).single();
      setMustChange(!!data?.must_change_password);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (pw1.length < 8) { setError('Use at least 8 characters.'); return; }
    if (pw1 !== pw2) { setError('Passwords don’t match.'); return; }
    setSaving(true);
    const { error: err } = await supabase.auth.updateUser({ password: pw1 });
    if (err) { setError(err.message); setSaving(false); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from('profiles').update({ must_change_password: false }).eq('id', user.id);
    setDone(true);
    setSaving(false);
    setTimeout(() => { router.push('/'); router.refresh(); }, 800);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-lg border border-gray-200 p-8">
        <div className="text-center mb-6">
          <div className="text-xl font-bold text-brand-900">Skyview Construction</div>
          <p className="text-sm text-gray-500 mt-1">{mustChange ? 'Set your password' : 'Change password'}</p>
          {email && <p className="text-xs text-gray-400 mt-1">{email}</p>}
        </div>
        {mustChange && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-4">
            You signed in with a temporary password. Choose a new one to continue.
          </p>
        )}
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">New password</label>
            <input type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} required autoComplete="new-password"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Confirm password</label>
            <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required autoComplete="new-password"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {done && <p className="text-sm text-green-700">Password saved. Taking you in…</p>}
          <button type="submit" disabled={saving || done}
            className="w-full py-2 bg-brand-700 text-white rounded-md hover:bg-brand-900 disabled:opacity-50 font-medium">
            {saving ? 'Saving…' : 'Save password'}
          </button>
          <button type="button" onClick={signOut} className="block w-full text-xs text-center text-gray-400 hover:underline">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
