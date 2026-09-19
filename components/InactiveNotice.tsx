'use client';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

// Shown instead of the app when an admin has switched this login to inactive.
export default function InactiveNotice({ email }: { email: string }) {
  const router = useRouter();
  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-lg border border-gray-200 p-8 text-center">
        <div className="text-xl font-bold text-brand-900 mb-2">Skyview Construction</div>
        <p className="text-sm text-gray-700">This login is currently inactive.</p>
        <p className="text-xs text-gray-500 mt-1">{email}</p>
        <p className="text-xs text-gray-500 mt-3">Talk to your supervisor if you think this is a mistake.</p>
        <button onClick={signOut} className="mt-5 px-4 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50">Sign out</button>
      </div>
    </div>
  );
}
