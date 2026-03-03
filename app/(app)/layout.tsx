import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import Link from 'next/link';
import SignOutButton from './SignOutButton';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-6">
              <Link href="/dashboard" className="text-lg font-bold text-gray-900">
                LeadsByMe
              </Link>
              <Link
                href="/dashboard"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/search/new"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                New search
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500 hidden sm:block">
                {session.user.name || session.user.email}
              </span>
              <SignOutButton />
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
