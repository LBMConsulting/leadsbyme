import Card from '@/components/ui/Card';
import SearchForm from '@/components/search/SearchForm';

export default function NewSearchPage() {
  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New search</h1>
        <p className="text-gray-500 mt-1">
          Find businesses and extract verified email addresses
        </p>
      </div>
      <Card className="p-6">
        <SearchForm />
      </Card>
    </div>
  );
}
