import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { searchSchema } from '@/lib/validations';

// GET /api/searches — list user's searches with lead counts
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searches = await prisma.search.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { leads: true } },
    },
  });

  const validLeadCounts = await Promise.all(
    searches.map((s) =>
      prisma.lead.count({ where: { searchId: s.id, isValid: true } })
    )
  );

  const data = searches.map((s, i) => ({
    id: s.id,
    keyword: s.keyword,
    location: s.location,
    status: s.status,
    currentPhase: s.currentPhase,
    phaseDetail: s.phaseDetail,
    errorMessage: s.errorMessage,
    createdAt: s.createdAt,
    completedAt: s.completedAt,
    totalLeads: s._count.leads,
    validLeads: validLeadCounts[i],
  }));

  return NextResponse.json(data);
}

// POST /api/searches — create new search job
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = searchSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      );
    }

    const { keyword, location } = result.data;

    const search = await prisma.search.create({
      data: {
        userId: session.user.id,
        keyword,
        location,
        status: 'PENDING',
      },
    });

    return NextResponse.json({ id: search.id }, { status: 201 });
  } catch (error) {
    console.error('Create search error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
