'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

export default function SearchForm() {
  const router = useRouter();
  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await fetch('/api/searches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword, location }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Failed to start search.');
      setLoading(false);
      return;
    }

    const { id } = await res.json();
    router.push(`/search/${id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <Input
        id="keyword"
        label="Search keyword"
        type="text"
        placeholder='e.g. "plumber" or "dentist"'
        required
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
      />
      <Input
        id="location"
        label="Location"
        type="text"
        placeholder='e.g. "Austin, TX" or "London, UK"'
        required
        value={location}
        onChange={(e) => setLocation(e.target.value)}
      />
      <Button type="submit" loading={loading} size="lg" className="w-full">
        {loading ? 'Starting search…' : 'Find leads'}
      </Button>
    </form>
  );
}
