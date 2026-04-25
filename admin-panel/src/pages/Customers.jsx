import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, errorMessage } from '../api/client.js';
import PageHeader from '../components/PageHeader.jsx';

export default function Customers() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => (await api.get('/customers')).data,
  });
  const del = useMutation({
    mutationFn: (id) => api.delete(`/customers/${id}`),
    onSuccess: () => {
      toast.success('Deleted');
      qc.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle="Customer accounts (they can also self-register on mobile)"
        actions={
          <button onClick={() => setOpen(true)} className="bg-slate-900 text-white px-4 py-2 rounded text-sm">
            + Add customer
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
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan="5" className="px-4 py-6 text-center text-slate-500">Loading…</td>
                </tr>
              )}
              {data?.customers?.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{c.user.name}</td>
                  <td className="px-4 py-3">{c.user.email}</td>
                  <td className="px-4 py-3">{c.user.phone || '—'}</td>
                  <td className="px-4 py-3">{c.address || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => { if (confirm(`Delete ${c.user.name}?`)) del.mutate(c.id); }}
                      className="text-red-600 hover:underline text-xs"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!isLoading && !data?.customers?.length && (
                <tr>
                  <td colSpan="5" className="px-4 py-6 text-center text-slate-500">
                    No customers yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {open && <CustomerForm onClose={() => setOpen(false)} />}
    </>
  );
}

function CustomerForm({ onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', address: '' });
  const save = useMutation({
    mutationFn: (p) => api.post('/customers', p),
    onSuccess: () => {
      toast.success('Customer created');
      qc.invalidateQueries({ queryKey: ['customers'] });
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed')),
  });

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <form
        onSubmit={(e) => { e.preventDefault(); save.mutate(form); }}
        className="bg-white rounded-lg p-6 w-full max-w-md"
      >
        <h3 className="text-lg font-semibold mb-4">New customer</h3>
        {['name', 'email', 'phone', 'password', 'address'].map((f) => (
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
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm">Cancel</button>
          <button type="submit" disabled={save.isPending} className="bg-slate-900 text-white px-4 py-2 rounded text-sm">
            {save.isPending ? 'Saving…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}
