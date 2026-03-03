import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Card from '@/components/ui/Card';
import Link from 'next/link';
import SearchResultsView from './SearchResultsView';

export const dynamic = 'force-dynamic';

interface SearchPageProps {
  params: { id: string };
}

export default async function SearchPage({ params }: SearchPageProps) {
  const session = await auth();
  const userId = session!.user!.id!;

  const search = await prisma.search.findFirst({
    where: { id: params.id, userId },
    include: { _count: { select: { leads: true } } },
  });

  if (!search) notFound();

  const validLeads = await prisma.lead.count({
    where: { searchId: search.id, isValid: true },
  });

  const searchData = {
    id: search.id,
    keyword: search.keyword,
    location: search.location,
    status: search.status as 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED',
    currentPhase: search.currentPhase,
    phaseDetail: search.phaseDetail,
    errorMessage: search.errorMessage,
    totalLeads: search._count.leads,
    validLeads,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
          ← Dashboard
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          &ldquo;{search.keyword}&rdquo; in {search.location}
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          Search ID: {search.id}
        </p>
      </div>

      <Card className="p-6">
        <SearchResultsView search={searchData} />
      </Card>
    </div>
  );
}
