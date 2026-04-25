import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, errorMessage } from '../api/client.js';
import PageHeader from '../components/PageHeader.jsx';
import UsageModal from '../components/UsageModal.jsx';

export default function Products() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [usageFor, setUsageFor] = useState(null);
  const { data, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => (await api.get('/products')).data,
  });
  const del = useMutation({
    mutationFn: (id) => api.delete(`/products/${id}`),
    onSuccess: () => {
      toast.success('Deleted');
      qc.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err) => toast.error(errorMessage(err, 'Delete failed')),
  });

  function closeForm() {
    setOpen(false);
    setEditing(null);
  }

  return (
    <>
      <PageHeader
        title="Products"
        actions={
          <button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
            className="bg-slate-900 text-white px-4 py-2 rounded text-sm"
          >
            + Add product
          </button>
        }
      />
      <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        {isLoading && <div>Loading…</div>}
        {data?.products?.map((p) => (
          <div key={p.id} className="bg-white rounded-lg border p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs text-slate-500">{p.category || '—'}</div>
              </div>
              <div className="text-lg font-semibold">${Number(p.price).toFixed(2)}</div>
            </div>
            {p.description && (
              <div className="text-xs text-slate-600 mt-2 line-clamp-2">{p.description}</div>
            )}
            <div className="text-xs text-slate-600 mt-2">Stock: {p.stock}</div>
            <div className="flex gap-4 mt-3">
              <button
                onClick={() => {
                  setEditing(p);
                  setOpen(true);
                }}
                className="text-slate-700 hover:underline text-xs"
              >
                Edit
              </button>
              <button
                onClick={() => setUsageFor(p)}
                className="text-blue-600 hover:underline text-xs"
              >
                View usage
              </button>
              <button
                onClick={() => {
                  if (confirm(`Delete ${p.name}?`)) del.mutate(p.id);
                }}
                className="text-red-600 hover:underline text-xs"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
      {open && <ProductForm editing={editing} onClose={closeForm} />}
      {usageFor && (
        <UsageModal
          title={`Cuisines using "${usageFor.name}"`}
          subtitle="This product is used in the following cuisines, with the recipe quantity per plate."
          url={`/products/${usageFor.id}/usage`}
          onClose={() => setUsageFor(null)}
          render={(data, { StatusPill }) => (
            <div className="space-y-5">
              <div>
                <div className="text-xs uppercase text-slate-500 font-semibold mb-2">
                  Cuisines that use this product
                </div>
                {data.cuisines?.length ? (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Cuisine</th>
                        <th className="px-3 py-2">Per plate</th>
                        <th className="px-3 py-2">Price/plate</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.cuisines.map((c) => (
                        <tr key={c.cuisineId} className="border-t">
                          <td className="px-3 py-2 font-medium">{c.name}</td>
                          <td className="px-3 py-2">
                            {Number(c.quantity)} {c.unit || ''}
                          </td>
                          <td className="px-3 py-2">${Number(c.pricePerPlate).toFixed(2)}</td>
                          <td className="px-3 py-2 text-xs">
                            {c.isActive ? 'Active' : <span className="text-slate-400">Inactive</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-sm text-slate-500">
                    Not used in any cuisine yet.
                  </div>
                )}
              </div>

              <div>
                <div className="text-xs uppercase text-slate-500 font-semibold mb-2">
                  Orders that need this product
                </div>
                {data.orders?.length ? (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Order</th>
                        <th className="px-3 py-2">Customer</th>
                        <th className="px-3 py-2">Scheduled</th>
                        <th className="px-3 py-2">Direct</th>
                        <th className="px-3 py-2">Via cuisines</th>
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
                          <td className="px-3 py-2">{o.directQty || '—'}</td>
                          <td className="px-3 py-2">
                            {o.viaCuisinesQty ? Number(o.viaCuisinesQty).toFixed(2) : '—'}
                          </td>
                          <td className="px-3 py-2">
                            <StatusPill status={o.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-sm text-slate-500">No orders need this product yet.</div>
                )}
              </div>
            </div>
          )}
        />
      )}
    </>
  );
}

function ProductForm({ editing, onClose }) {
  const qc = useQueryClient();
  const isEdit = !!editing;
  const [form, setForm] = useState({
    name: editing?.name || '',
    price: editing?.price ?? 0,
    category: editing?.category || '',
    stock: editing?.stock ?? 0,
    description: editing?.description || '',
  });

  const save = useMutation({
    mutationFn: (p) =>
      isEdit ? api.patch(`/products/${editing.id}`, p) : api.post('/products', p),
    onSuccess: () => {
      toast.success(isEdit ? 'Product updated' : 'Product created');
      qc.invalidateQueries({ queryKey: ['products'] });
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err, 'Save failed')),
  });

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate({ ...form, price: Number(form.price), stock: Number(form.stock) });
        }}
        className="bg-white rounded-lg p-6 w-full max-w-md"
      >
        <h3 className="text-lg font-semibold mb-4">{isEdit ? 'Edit product' : 'New product'}</h3>
        {['name', 'category', 'description'].map((f) => (
          <div key={f} className="mb-3">
            <label className="block text-xs uppercase text-slate-500 mb-1">{f}</label>
            <input
              value={form[f]}
              onChange={(e) => setForm({ ...form, [f]: e.target.value })}
              required={f === 'name'}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
        ))}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs uppercase text-slate-500 mb-1">Price</label>
            <input
              type="number"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs uppercase text-slate-500 mb-1">Stock</label>
            <input
              type="number"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
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
            {save.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}
