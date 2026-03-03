'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError('Invalid email or password.');
    } else {
      router.push(callbackUrl);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <Input
        id="email"
        label="Email address"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        id="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Button type="submit" loading={loading} className="w-full">
        Sign in
      </Button>
      <p className="text-center text-sm text-gray-600">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="text-blue-600 hover:underline font-medium">
          Create one
        </Link>
      </p>
    </form>
  );
}
