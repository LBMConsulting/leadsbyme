import Link from 'next/link';
import Badge from '@/components/ui/Badge';

interface SearchHistoryItemProps {
  search: {
    id: string;
    keyword: string;
    location: string;
    status: string;
    createdAt: string;
    completedAt: string | null;
    totalLeads: number;
    validLeads: number;
    phaseDetail: string | null;
    errorMessage: string | null;
  };
}

function statusBadge(status: string) {
  switch (status) {
    case 'DONE': return <Badge variant="success">Done</Badge>;
    case 'RUNNING': return <Badge variant="info">Running</Badge>;
    case 'PENDING': return <Badge variant="neutral">Pending</Badge>;
    case 'FAILED': return <Badge variant="error">Failed</Badge>;
    default: return <Badge>{status}</Badge>;
  }
}

export default function SearchHistoryItem({ search }: SearchHistoryItemProps) {
  const date = new Date(search.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Link
      href={`/search/${search.id}`}
      className="block px-6 py-4 hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-900 truncate">{search.keyword}</span>
            <span className="text-gray-400">in</span>
            <span className="text-gray-700 truncate">{search.location}</span>
            {statusBadge(search.status)}
          </div>
          <div className="text-sm text-gray-500 mt-0.5">
            {date}
            {search.status === 'DONE' && (
              <> · <span className="text-green-700 font-medium">{search.validLeads} valid</span> / {search.totalLeads} total leads</>
            )}
            {search.status === 'RUNNING' && search.phaseDetail && (
              <> · {search.phaseDetail}</>
            )}
            {search.status === 'FAILED' && search.errorMessage && (
              <> · <span className="text-red-600">{search.errorMessage}</span></>
            )}
          </div>
        </div>
        <svg className="h-5 w-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}
