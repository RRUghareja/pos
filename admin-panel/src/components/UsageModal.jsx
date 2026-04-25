import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client.js';

function StatusPill({ status }) {
  const map = {
    PENDING: 'bg-amber-100 text-amber-800',
    IN_PROGRESS: 'bg-blue-100 text-blue-800',
    COMPLETED: 'bg-emerald-100 text-emerald-800',
    DELIVERED: 'bg-slate-200 text-slate-700',
    CANCELLED: 'bg-rose-100 text-rose-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${map[status] || 'bg-slate-100'}`}>
      {status}
    </span>
  );
}

export default function UsageModal({ title, subtitle, url, onClose, render }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['usage', url],
    queryFn: async () => (await api.get(url)).data,
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            {subtitle && <div className="text-xs text-slate-500 mt-1">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="text-slate-500 text-sm">
            ✕
          </button>
        </div>
        <div className="p-6">
          {isLoading && <div className="text-sm text-slate-500">Loading…</div>}
          {error && (
            <div className="text-sm text-rose-700">Failed to load usage.</div>
          )}
          {data && render(data, { StatusPill })}
        </div>
      </div>
    </div>
  );
}
