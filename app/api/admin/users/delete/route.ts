// POST /api/admin/users/delete — admin-only: remove a login entirely.
// Deleting the auth user cascades to their profile, clock sessions, hours,
// adjustment requests and location pings. Admins can't remove themselves.
//
// Body: { id: string }

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not signed in' }, { status: 401 });

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!me || (me.role !== 'admin' && me.role !== 'master_admin')) {
    return NextResponse.json({ ok: false, error: 'Admins only.' }, { status: 403 });
  }

  let body: { id?: string };
  try { body = await req.json(); } catch { body = {}; }
  const id = (body.id || '').trim();
  if (!id) return NextResponse.json({ ok: false, error: 'Missing user id.' }, { status: 400 });
  if (id === user.id) return NextResponse.json({ ok: false, error: "You can't remove your own login." }, { status: 400 });

  const admin = createAdminClient();

  // Don't let an admin remove the last remaining admin.
  const { data: target } = await admin.from('profiles').select('role').eq('id', id).maybeSingle();
  if (!target) return NextResponse.json({ ok: false, error: 'That user no longer exists.' }, { status: 404 });
  if (target.role === 'admin' || target.role === 'master_admin') {
    const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).in('role', ['admin', 'master_admin']);
    if ((count ?? 0) <= 1) {
      return NextResponse.json({ ok: false, error: 'This is the only admin. Make someone else an admin first.' }, { status: 400 });
    }
  }

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
