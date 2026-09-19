'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

type Role = 'admin' | 'master_admin' | 'employee';

const ADMIN_LINKS = [
  { href: '/admin/hours', label: 'Time clock' },
  { href: '/admin/employees', label: 'Employees' },
  { href: '/employee/hours', label: 'My hours' },
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

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <header className="bg-brand-900 text-white">
      <div className="max-w-5xl mx-auto px-4">
        {/* Top row: brand, desktop tabs, account actions. */}
        <div className="h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/" className="font-bold whitespace-nowrap truncate">
              <span className="sm:hidden">Skyview</span>
              <span className="hidden sm:inline">Skyview Construction</span>
            </Link>
            <nav className="hidden sm:flex items-center gap-1">
              {links.map((l) => (
                <Link key={l.href} href={l.href}
                  className={`px-3 py-1.5 text-sm rounded-md whitespace-nowrap ${isActive(l.href) ? 'bg-white/15 font-medium' : 'hover:bg-white/10 text-white/80'}`}>
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <span className="hidden md:inline text-xs text-white/70 truncate max-w-[180px]">{email}</span>
            <Link href="/account" className="text-xs text-white/80 hover:underline whitespace-nowrap">Password</Link>
            <button onClick={signOut} className="text-xs px-2.5 py-1 rounded-md border border-white/30 hover:bg-white/10 whitespace-nowrap">Sign out</button>
          </div>
        </div>
        {/* Phone: tabs get their own full-width row so they never get squeezed out. */}
        <nav className="sm:hidden flex gap-1 pb-2 -mt-1">
          {links.map((l) => (
            <Link key={l.href} href={l.href}
              className={`flex-1 text-center px-2 py-2 text-sm rounded-md whitespace-nowrap ${isActive(l.href) ? 'bg-white/15 font-semibold' : 'bg-white/5 text-white/80'}`}>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
