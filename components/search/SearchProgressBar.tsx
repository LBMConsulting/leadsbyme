'use client';

import { useEffect, useRef, useState } from 'react';
import Spinner from '@/components/ui/Spinner';

interface ProgressData {
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';
  currentPhase: number | null;
  phaseDetail: string | null;
  errorMessage: string | null;
}

interface SearchProgressBarProps {
  searchId: string;
  onComplete: () => void;
}

const PHASE_LABELS = [
  '',
  'Setup',
  'Inputs',
  'Searching Google Places',
  'Extracting emails from websites',
  'Deduplicating emails',
  'Validating emails',
  'Saving results',
];

const TOTAL_PHASES = 7;

export default function SearchProgressBar({ searchId, onComplete }: SearchProgressBarProps) {
  const [progress, setProgress] = useState<ProgressData>({
    status: 'PENDING',
    currentPhase: null,
    phaseDetail: 'Waiting for worker…',
    errorMessage: null,
  });

  const esRef = useRef<EventSource | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const es = new EventSource(`/api/searches/${searchId}/progress`);
    esRef.current = es;

    es.onmessage = (event) => {
      const data: ProgressData = JSON.parse(event.data);
      setProgress(data);

      if (data.status === 'DONE' || data.status === 'FAILED') {
        es.close();
        if (data.status === 'DONE') {
          onCompleteRef.current();
        }
      }
    };

    es.onerror = () => {
      es.close();
    };

    return () => {
      es.close();
    };
  }, [searchId]);

  const phase = progress.currentPhase ?? 0;
  const pct = TOTAL_PHASES > 0 ? Math.round((phase / TOTAL_PHASES) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {(progress.status === 'PENDING' || progress.status === 'RUNNING') && (
          <Spinner size="sm" />
        )}
        <div>
          <p className="font-medium text-gray-900">
            {progress.status === 'PENDING' && 'Queued — waiting for worker…'}
            {progress.status === 'RUNNING' && `Phase ${phase} of ${TOTAL_PHASES} — ${PHASE_LABELS[phase] || ''}`}
            {progress.status === 'DONE' && 'Search complete!'}
            {progress.status === 'FAILED' && 'Search failed'}
          </p>
          {progress.phaseDetail && (
            <p className="text-sm text-gray-500 mt-0.5">{progress.phaseDetail}</p>
          )}
        </div>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className={`h-2.5 rounded-full transition-all duration-500 ${
            progress.status === 'FAILED' ? 'bg-red-500' : 'bg-blue-600'
          }`}
          style={{ width: `${progress.status === 'DONE' ? 100 : pct}%` }}
        />
      </div>

      {progress.status === 'FAILED' && progress.errorMessage && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <strong>Error:</strong> {progress.errorMessage}
        </div>
      )}
    </div>
  );
}
