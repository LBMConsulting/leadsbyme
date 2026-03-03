'use client';

interface LeadsFilterProps {
  validOnly: boolean;
  onValidOnlyChange: (value: boolean) => void;
  totalLeads: number;
  validLeads: number;
}

export default function LeadsFilter({
  validOnly,
  onValidOnlyChange,
  totalLeads,
  validLeads,
}: LeadsFilterProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-gray-200 p-1 bg-gray-50 w-fit">
      <button
        onClick={() => onValidOnlyChange(false)}
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          !validOnly
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        All leads ({totalLeads})
      </button>
      <button
        onClick={() => onValidOnlyChange(true)}
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          validOnly
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        Valid only ({validLeads})
      </button>
    </div>
  );
}
