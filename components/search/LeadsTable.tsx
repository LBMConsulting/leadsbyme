'use client';

import { useCallback, useEffect, useState } from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import LeadsFilter from './LeadsFilter';

interface Lead {
  id: string;
  businessName: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  mapsUrl: string | null;
  email: string;
  isValid: boolean;
  validationStatus: string | null;
}

interface LeadsResponse {
  leads: Lead[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface LeadsTableProps {
  searchId: string;
  totalLeads: number;
  validLeads: number;
}

function statusBadge(status: string | null, isValid: boolean) {
  if (isValid) return <Badge variant="success">{status || 'valid'}</Badge>;
  if (status === 'catch_all') return <Badge variant="warning">catch_all</Badge>;
  if (status === 'unknown') return <Badge variant="neutral">unknown</Badge>;
  return <Badge variant="error">{status || 'invalid'}</Badge>;
}

export default function LeadsTable({ searchId, totalLeads, validLeads }: LeadsTableProps) {
  const [validOnly, setValidOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<LeadsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      ...(validOnly ? { valid: 'true' } : {}),
    });
    const res = await fetch(`/api/searches/${searchId}/leads?${params}`);
    if (res.ok) {
      setData(await res.json());
    }
    setLoading(false);
  }, [searchId, page, validOnly]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Reset to page 1 when filter changes
  const handleFilterChange = (value: boolean) => {
    setValidOnly(value);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <LeadsFilter
          validOnly={validOnly}
          onValidOnlyChange={handleFilterChange}
          totalLeads={totalLeads}
          validLeads={validLeads}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : !data || data.leads.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No leads found{validOnly ? ' with valid emails' : ''}.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Business</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Phone</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Website</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {data.leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{lead.businessName}</div>
                      {lead.address && (
                        <div className="text-xs text-gray-500 mt-0.5">{lead.address}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-900">{lead.email}</td>
                    <td className="px-4 py-3">
                      {statusBadge(lead.validationStatus, lead.isValid)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{lead.phone || '—'}</td>
                    <td className="px-4 py-3">
                      {lead.website ? (
                        <a
                          href={lead.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline truncate max-w-[160px] block"
                        >
                          {lead.website.replace(/^https?:\/\//, '')}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Showing {(page - 1) * data.pageSize + 1}–
                {Math.min(page * data.pageSize, data.total)} of {data.total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page === data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
