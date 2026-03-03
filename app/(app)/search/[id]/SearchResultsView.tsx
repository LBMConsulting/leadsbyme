'use client';

import { useState } from 'react';
import SearchProgressBar from '@/components/search/SearchProgressBar';
import LeadsTable from '@/components/search/LeadsTable';
import Link from 'next/link';

interface SearchData {
  id: string;
  keyword: string;
  location: string;
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';
  currentPhase: number | null;
  phaseDetail: string | null;
  errorMessage: string | null;
  totalLeads: number;
  validLeads: number;
}

interface SearchResultsViewProps {
  search: SearchData;
}

export default function SearchResultsView({ search }: SearchResultsViewProps) {
  const [status, setStatus] = useState(search.status);
  const [leadsKey, setLeadsKey] = useState(0);

  const handleComplete = () => {
    setStatus('DONE');
    // Increment key to force LeadsTable remount/refetch
    setLeadsKey((k) => k + 1);
  };

  if (status === 'PENDING' || status === 'RUNNING') {
    return (
      <SearchProgressBar
        searchId={search.id}
        onComplete={handleComplete}
      />
    );
  }

  if (status === 'FAILED') {
    return (
      <div className="space-y-4">
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-sm font-medium text-red-800">Search failed</p>
          {search.errorMessage && (
            <p className="text-sm text-red-700 mt-1">{search.errorMessage}</p>
          )}
        </div>
        <Link
          href="/search/new"
          className="text-sm text-blue-600 hover:underline"
        >
          Try a new search →
        </Link>
      </div>
    );
  }

  // DONE
  return (
    <LeadsTable
      key={leadsKey}
      searchId={search.id}
      totalLeads={search.totalLeads}
      validLeads={search.validLeads}
    />
  );
}
