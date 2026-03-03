import SearchHistoryItem from './SearchHistoryItem';

interface Search {
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
}

interface SearchHistoryListProps {
  searches: Search[];
}

export default function SearchHistoryList({ searches }: SearchHistoryListProps) {
  if (searches.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No searches yet. Start your first lead generation search!
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {searches.map((search) => (
        <SearchHistoryItem key={search.id} search={search} />
      ))}
    </div>
  );
}
