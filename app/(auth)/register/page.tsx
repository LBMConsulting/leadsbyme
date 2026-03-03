import GoogleSignInButton from '@/components/auth/GoogleSignInButton';
import RegisterForm from '@/components/auth/RegisterForm';

export default function RegisterPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Create account</h2>
        <p className="text-sm text-gray-500 mt-1">Start finding leads today</p>
      </div>
      <GoogleSignInButton />
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-3 text-gray-400">or register with email</span>
        </div>
      </div>
      <RegisterForm />
    </div>
  );
}
