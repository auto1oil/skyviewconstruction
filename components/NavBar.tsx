'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

type Role = 'admin' | 'master_admin' | 'employee';

const ADMIN_LINKS = [
  { href: '/admin/hours', label: 'Time clock' },
  { href: '/admin/employees', label: 'Employees' },
];
const EMPLOYEE_LINKS = [
  { href: '/employee/hours', label: 'My hours' },
];

export default function NavBar({ role, email }: { role: Role; email: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const links = role === 'employee' ? EMPLOYEE_LINKS : ADMIN_LINKS;

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="bg-brand-900 text-white">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/" className="font-bold whitespace-nowrap">Skyview Construction</Link>
          <nav className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {links.map((l) => {
              const active = pathname === l.href || pathname.startsWith(l.href + '/');
              return (
                <Link key={l.href} href={l.href}
                  className={`px-3 py-1.5 text-sm rounded-md whitespace-nowrap ${active ? 'bg-white/15 font-medium' : 'hover:bg-white/10 text-white/80'}`}>
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="hidden sm:inline text-xs text-white/70 truncate max-w-[180px]">{email}</span>
          <Link href="/account" className="text-xs text-white/80 hover:underline">Password</Link>
          <button onClick={signOut} className="text-xs px-2.5 py-1 rounded-md border border-white/30 hover:bg-white/10">Sign out</button>
        </div>
      </div>
    </header>
  );
}
