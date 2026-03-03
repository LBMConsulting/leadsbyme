import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const PAGE_SIZE = 50;

// GET /api/searches/:id/leads — paginated leads
// Query params: ?valid=true&page=1
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify search ownership
  const search = await prisma.search.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: { id: true },
  });

  if (!search) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const validOnly = searchParams.get('valid') === 'true';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));

  const where = {
    searchId: params.id,
    ...(validOnly ? { isValid: true } : {}),
  };

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: [{ isValid: 'desc' }, { businessName: 'asc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        businessName: true,
        address: true,
        phone: true,
        website: true,
        mapsUrl: true,
        email: true,
        isValid: true,
        validationStatus: true,
      },
    }),
    prisma.lead.count({ where }),
  ]);

  return NextResponse.json({
    leads,
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.ceil(total / PAGE_SIZE),
  });
}
