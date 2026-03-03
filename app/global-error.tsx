'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="bg-gray-50 text-gray-900 antialiased">
        <div className="max-w-lg mx-auto mt-16 p-8 space-y-4">
          <h2 className="text-xl font-bold text-red-700">Application error</h2>
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800 font-mono break-all">
            {error.message || 'Unknown error'}
            {error.digest && <div className="mt-1 text-xs text-red-600">Digest: {error.digest}</div>}
          </div>
          <button
            onClick={reset}
            className="text-sm text-blue-600 hover:underline"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
