'use client';

import { signOut } from 'next-auth/react';

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
    >
      Sign out
    </button>
  );
}
