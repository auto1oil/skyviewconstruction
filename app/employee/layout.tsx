import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import NavBar from '@/components/NavBar';

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, email')
    .eq('id', user.id)
    .single();

  if (!profile) redirect('/login');

  // Admins live on the Time clock board, but may still use the employee view
  // to clock themselves in — so no bounce here.
  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar role={profile.role as 'admin' | 'master_admin' | 'employee'} email={profile.email} />
      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
