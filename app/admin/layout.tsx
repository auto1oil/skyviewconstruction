import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import NavBar from '@/components/NavBar';
import InactiveNotice from '@/components/InactiveNotice';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profile && profile.active === false) return <InactiveNotice email={profile.email} />;

  if (!profile || (profile.role !== 'admin' && profile.role !== 'master_admin')) {
    redirect('/employee/hours');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar role={profile.role as 'admin' | 'master_admin'} email={profile.email} />
      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
