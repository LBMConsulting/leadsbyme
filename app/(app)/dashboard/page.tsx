import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import SearchHistoryList from '@/components/dashboard/SearchHistoryList';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const searches = await prisma.search.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { leads: true } } },
  });

  // Fetch valid lead counts per search
  const validCounts = await Promise.all(
    searches.map((s) => prisma.lead.count({ where: { searchId: s.id, isValid: true } }))
  );

  const searchData = searches.map((s, i) => ({
    id: s.id,
    keyword: s.keyword,
    location: s.location,
    status: s.status,
    createdAt: s.createdAt.toISOString(),
    completedAt: s.completedAt?.toISOString() ?? null,
    totalLeads: s._count.leads,
    validLeads: validCounts[i],
    phaseDetail: s.phaseDetail,
    errorMessage: s.errorMessage,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Your search history and results</p>
        </div>
        <Link href="/search/new">
          <Button>New search</Button>
        </Link>
      </div>

      <Card>
        <SearchHistoryList searches={searchData} />
      </Card>
    </div>
  );
}
