import { Suspense } from 'react';
import LoginForm from '@/components/auth/LoginForm';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Sign in</h2>
        <p className="text-sm text-gray-500 mt-1">Welcome back</p>
      </div>
      <GoogleSignInButton />
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-3 text-gray-400">or continue with email</span>
        </div>
      </div>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
