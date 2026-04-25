import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, errorMessage } from '../api/client.js';
import PageHeader from '../components/PageHeader.jsx';

function hoursBetween(a, b, breakMins = 0) {
  if (!b) return null;
  const ms = new Date(b) - new Date(a);
  const h = ms / 3600000 - breakMins / 60;
  return Math.max(0, h).toFixed(2);
}

function toLocalInput(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Attendance() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ workerId: '', from: '', to: '' });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const workers = useQuery({
    queryKey: ['workers'],
    queryFn: async () => (await api.get('/workers')).data,
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.workerId) params.set('workerId', filters.workerId);
    if (filters.from) params.set('from', new Date(filters.from).toISOString());
    if (filters.to) params.set('to', new Date(filters.to).toISOString());
    const s = params.toString();
    return s ? `?${s}` : '';
  }, [filters]);

  const { data, isLoading } = useQuery({
    queryKey: ['attendance', queryString],
    queryFn: async () => (await api.get(`/attendance${queryString}`)).data,
  });

  const del = useMutation({
    mutationFn: (id) => api.delete(`/attendance/${id}`),
    onSuccess: () => {
      toast.success('Attendance deleted');
      qc.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: (err) => toast.error(errorMessage(err, 'Delete failed')),
  });

  const checkOutNow = useMutation({
    mutationFn: (id) => api.patch(`/attendance/${id}`, { checkOut: new Date().toISOString() }),
    onSuccess: () => {
      toast.success('Checked out');
      qc.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: (err) => toast.error(errorMessage(err, 'Check-out failed')),
  });

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle="Mark and manage worker attendance"
        actions={
          <button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="bg-slate-900 text-white px-4 py-2 rounded text-sm"
          >
            + Mark attendance
          </button>
        }
      />
      <div className="p-8 space-y-4">
        <div className="bg-white border rounded-lg p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs uppercase text-slate-500 mb-1">Worker</label>
            <select
              value={filters.workerId}
              onChange={(e) => setFilters({ ...filters, workerId: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="">All workers</option>
              {workers.data?.workers?.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.user.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase text-slate-500 mb-1">From</label>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs uppercase text-slate-500 mb-1">To</label>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ workerId: '', from: '', to: '' })}
              className="text-sm text-slate-600 hover:underline"
            >
              Clear filters
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Worker</th>
                <th className="px-4 py-3">Check-in</th>
                <th className="px-4 py-3">Check-out</th>
                <th className="px-4 py-3">Hours</th>
                <th className="px-4 py-3">Break (min)</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan="7" className="px-4 py-6 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              )}
              {data?.attendances?.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{a.worker?.user?.name}</td>
                  <td className="px-4 py-3">{new Date(a.checkIn).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    {a.checkOut ? (
                      new Date(a.checkOut).toLocaleString()
                    ) : (
                      <em className="text-orange-600">open</em>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {hoursBetween(a.checkIn, a.checkOut, a.breakMins) ?? '—'}
                  </td>
                  <td className="px-4 py-3">{a.breakMins}</td>
                  <td className="px-4 py-3 text-slate-600">{a.notes || '—'}</td>
                  <td className="px-4 py-3 text-right space-x-3 whitespace-nowrap">
                    {!a.checkOut && (
                      <button
                        onClick={() => checkOutNow.mutate(a.id)}
                        className="text-blue-600 hover:underline text-xs"
                      >
                        Check out
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setEditing(a);
                        setFormOpen(true);
                      }}
                      className="text-slate-700 hover:underline text-xs"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Delete this attendance record?')) del.mutate(a.id);
                      }}
                      className="text-red-600 hover:underline text-xs"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!isLoading && !data?.attendances?.length && (
                <tr>
                  <td colSpan="7" className="px-4 py-6 text-center text-slate-500">
                    No attendance records.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {formOpen && (
        <AttendanceForm
          workers={workers.data?.workers || []}
          editing={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function AttendanceForm({ workers, editing, onClose }) {
  const qc = useQueryClient();
  const isEdit = !!editing;
  const [form, setForm] = useState(() => ({
    workerId: editing?.workerId || '',
    checkIn: editing ? toLocalInput(editing.checkIn) : toLocalInput(new Date()),
    checkOut: editing?.checkOut ? toLocalInput(editing.checkOut) : '',
    breakMins: editing?.breakMins ?? 0,
    notes: editing?.notes || '',
  }));

  const save = useMutation({
    mutationFn: (payload) =>
      isEdit ? api.patch(`/attendance/${editing.id}`, payload) : api.post('/attendance', payload),
    onSuccess: () => {
      toast.success(isEdit ? 'Attendance updated' : 'Attendance saved');
      qc.invalidateQueries({ queryKey: ['attendance'] });
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err, 'Save failed')),
  });

  function submit(e) {
    e.preventDefault();
    if (!isEdit && !form.workerId) {
      toast.error('Please pick a worker');
      return;
    }
    const payload = {
      checkIn: new Date(form.checkIn).toISOString(),
      checkOut: form.checkOut ? new Date(form.checkOut).toISOString() : null,
      breakMins: Number(form.breakMins) || 0,
      notes: form.notes || undefined,
    };
    if (!isEdit) payload.workerId = form.workerId;
    save.mutate(payload);
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <form onSubmit={submit} className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">
          {isEdit ? 'Edit attendance' : 'Mark attendance'}
        </h3>

        {!isEdit && (
          <div className="mb-3">
            <label className="block text-xs uppercase text-slate-500 mb-1">Worker</label>
            <select
              value={form.workerId}
              onChange={(e) => setForm({ ...form, workerId: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm"
              required
            >
              <option value="">Select worker</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.user.name} {w.department ? `· ${w.department}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs uppercase text-slate-500 mb-1">Check-in</label>
            <input
              type="datetime-local"
              required
              value={form.checkIn}
              onChange={(e) => setForm({ ...form, checkIn: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs uppercase text-slate-500 mb-1">
              Check-out <span className="text-slate-400">(optional)</span>
            </label>
            <input
              type="datetime-local"
              value={form.checkOut}
              onChange={(e) => setForm({ ...form, checkOut: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mb-3">
          <label className="block text-xs uppercase text-slate-500 mb-1">Break (minutes)</label>
          <input
            type="number"
            min="0"
            value={form.breakMins}
            onChange={(e) => setForm({ ...form, breakMins: e.target.value })}
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>

        <div className="mb-4">
          <label className="block text-xs uppercase text-slate-500 mb-1">Notes</label>
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            type="submit"
            disabled={save.isPending}
            className="bg-slate-900 text-white px-4 py-2 rounded text-sm"
          >
            {save.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
