import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/searches/:id — single search details
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const search = await prisma.search.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: {
      _count: { select: { leads: true } },
    },
  });

  if (!search) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const validLeads = await prisma.lead.count({
    where: { searchId: search.id, isValid: true },
  });

  return NextResponse.json({
    id: search.id,
    keyword: search.keyword,
    location: search.location,
    status: search.status,
    currentPhase: search.currentPhase,
    phaseDetail: search.phaseDetail,
    errorMessage: search.errorMessage,
    createdAt: search.createdAt,
    startedAt: search.startedAt,
    completedAt: search.completedAt,
    totalLeads: search._count.leads,
    validLeads,
  });
}
