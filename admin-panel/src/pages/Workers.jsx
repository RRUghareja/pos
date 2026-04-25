import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, errorMessage } from '../api/client.js';
import PageHeader from '../components/PageHeader.jsx';
import UsageModal from '../components/UsageModal.jsx';

export default function Workers() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [usageFor, setUsageFor] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['workers'],
    queryFn: async () => (await api.get('/workers')).data,
  });

  const del = useMutation({
    mutationFn: (id) => api.delete(`/workers/${id}`),
    onSuccess: () => {
      toast.success('Worker deleted');
      qc.invalidateQueries({ queryKey: ['workers'] });
    },
  });

  return (
    <>
      <PageHeader
        title="Workers"
        subtitle="Manage employees, salary rates, and status"
        actions={
          <button
            onClick={() => setOpen(true)}
            className="bg-slate-900 text-white px-4 py-2 rounded text-sm"
          >
            + Add worker
          </button>
        }
      />
      <div className="p-8">
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Salary</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan="6" className="px-4 py-6 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              )}
              {data?.workers?.map((w) => (
                <tr key={w.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{w.user.name}</td>
                  <td className="px-4 py-3">{w.user.email}</td>
                  <td className="px-4 py-3">{w.department || '—'}</td>
                  <td className="px-4 py-3">
                    {w.salaryType === 'HOURLY' ? `$${w.salaryRate}/hr` : `$${w.salaryRate}/day`}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        w.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {w.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-3 whitespace-nowrap">
                    <button
                      onClick={() => setUsageFor(w)}
                      className="text-blue-600 hover:underline text-xs"
                    >
                      Orders
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete ${w.user.name}?`)) del.mutate(w.id);
                      }}
                      className="text-red-600 hover:underline text-xs"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!isLoading && !data?.workers?.length && (
                <tr>
                  <td colSpan="6" className="px-4 py-6 text-center text-slate-500">
                    No workers yet. Click "Add worker".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {open && <WorkerForm onClose={() => setOpen(false)} />}
      {usageFor && (
        <UsageModal
          title={`Orders assigned to ${usageFor.user.name}`}
          subtitle="Use this to spot scheduling conflicts before assigning a new order."
          url={`/workers/${usageFor.id}/orders`}
          onClose={() => setUsageFor(null)}
          render={(data, { StatusPill }) => (
            data.orders?.length ? (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Order</th>
                    <th className="px-3 py-2">Customer</th>
                    <th className="px-3 py-2">Scheduled</th>
                    <th className="px-3 py-2">Plates</th>
                    <th className="px-3 py-2">Location</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.orders.map((o) => (
                    <tr key={o.orderId} className="border-t">
                      <td className="px-3 py-2 font-mono text-xs">{o.orderNumber}</td>
                      <td className="px-3 py-2">{o.customerName || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {o.scheduledFor ? new Date(o.scheduledFor).toLocaleString() : '—'}
                      </td>
                      <td className="px-3 py-2">{o.plates || '—'}</td>
                      <td className="px-3 py-2">{o.location || '—'}</td>
                      <td className="px-3 py-2">
                        <StatusPill status={o.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-sm text-slate-500">No orders assigned yet.</div>
            )
          )}
        />
      )}
    </>
  );
}

function WorkerForm({ onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    department: '',
    salaryType: 'HOURLY',
    salaryRate: 20,
  });

  const save = useMutation({
    mutationFn: (payload) => api.post('/workers', payload),
    onSuccess: () => {
      toast.success('Worker created');
      qc.invalidateQueries({ queryKey: ['workers'] });
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to create worker')),
  });

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(form);
        }}
        className="bg-white rounded-lg p-6 w-full max-w-md"
      >
        <h3 className="text-lg font-semibold mb-4">New worker</h3>
        {['name', 'email', 'phone', 'password', 'department'].map((f) => (
          <div key={f} className="mb-3">
            <label className="block text-xs uppercase text-slate-500 mb-1">{f}</label>
            <input
              type={f === 'password' ? 'password' : 'text'}
              required={['name', 'email', 'password'].includes(f)}
              value={form[f]}
              onChange={(e) => setForm({ ...form, [f]: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
        ))}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs uppercase text-slate-500 mb-1">Salary type</label>
            <select
              value={form.salaryType}
              onChange={(e) => setForm({ ...form, salaryType: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="HOURLY">Hourly</option>
              <option value="DAILY">Daily</option>
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase text-slate-500 mb-1">Rate</label>
            <input
              type="number"
              step="0.01"
              value={form.salaryRate}
              onChange={(e) => setForm({ ...form, salaryRate: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
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
            {save.isPending ? 'Saving…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}
