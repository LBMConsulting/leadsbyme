interface BadgeProps {
  variant?: 'success' | 'error' | 'warning' | 'info' | 'neutral';
  children: React.ReactNode;
}

const variants = {
  success: 'bg-green-100 text-green-800',
  error: 'bg-red-100 text-red-800',
  warning: 'bg-yellow-100 text-yellow-800',
  info: 'bg-blue-100 text-blue-800',
  neutral: 'bg-gray-100 text-gray-800',
};

export default function Badge({ variant = 'neutral', children }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
}
