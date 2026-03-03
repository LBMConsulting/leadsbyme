import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const POLL_INTERVAL_MS = 2000;
const HEARTBEAT_INTERVAL_MS = 30000;

// GET /api/searches/:id/progress — SSE stream of search progress
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Verify ownership
  const search = await prisma.search.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: { id: true },
  });

  if (!search) {
    return new Response('Not found', { status: 404 });
  }

  const encoder = new TextEncoder();
  const { signal } = request;

  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        if (signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Controller already closed
        }
      };

      const sendHeartbeat = () => {
        if (signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          // Controller already closed
        }
      };

      const close = () => {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      };

      // Start 30s heartbeat to prevent Railway nginx 60s idle timeout
      heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

      // Poll DB every 2s until done, failed, or client disconnects
      while (!signal.aborted) {
        try {
          const current = await prisma.search.findUnique({
            where: { id: params.id },
            select: {
              status: true,
              currentPhase: true,
              phaseDetail: true,
              errorMessage: true,
            },
          });

          if (!current) {
            close();
            break;
          }

          send({
            status: current.status,
            currentPhase: current.currentPhase,
            phaseDetail: current.phaseDetail,
            errorMessage: current.errorMessage,
          });

          if (current.status === 'DONE' || current.status === 'FAILED') {
            close();
            break;
          }
        } catch (err) {
          console.error('SSE poll error:', err);
          close();
          break;
        }

        // Wait before next poll, but stop early if client disconnects
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, POLL_INTERVAL_MS);
          signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
        });
      }

      if (signal.aborted && heartbeatTimer) clearInterval(heartbeatTimer);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
