import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, errorMessage } from '../api/client.js';
import PageHeader from '../components/PageHeader.jsx';
import UsageModal from '../components/UsageModal.jsx';

export default function Cuisines() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [usageFor, setUsageFor] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['cuisines'],
    queryFn: async () => (await api.get('/cuisines')).data,
  });
  const products = useQuery({
    queryKey: ['products'],
    queryFn: async () => (await api.get('/products')).data,
  });

  const del = useMutation({
    mutationFn: (id) => api.delete(`/cuisines/${id}`),
    onSuccess: () => {
      toast.success('Deleted');
      qc.invalidateQueries({ queryKey: ['cuisines'] });
    },
    onError: (err) => toast.error(errorMessage(err, 'Delete failed')),
  });

  return (
    <>
      <PageHeader
        title="Cuisines"
        subtitle="Catering menu items priced per plate. Each cuisine has a recipe of products."
        actions={
          <button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
            className="bg-slate-900 text-white px-4 py-2 rounded text-sm"
          >
            + Add cuisine
          </button>
        }
      />
      <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        {isLoading && <div>Loading…</div>}
        {data?.cuisines?.map((c) => (
          <div key={c.id} className="bg-white rounded-lg border p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold">{c.name}</div>
                <div className="text-xs text-slate-500">
                  {c.category || '—'}
                  {!c.isActive && (
                    <span className="ml-2 px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px]">
                      INACTIVE
                    </span>
                  )}
                </div>
              </div>
              <div className="text-lg font-semibold whitespace-nowrap">
                ${Number(c.pricePerPlate).toFixed(2)}
                <span className="text-xs text-slate-500 font-normal"> /plate</span>
              </div>
            </div>
            {c.description && (
              <div className="text-xs text-slate-600 mt-2 line-clamp-2">{c.description}</div>
            )}
            <div className="text-xs text-slate-700 mt-3">
              <div className="font-semibold uppercase text-slate-500 text-[10px] mb-1">
                Recipe ({c.recipe?.length || 0})
              </div>
              {c.recipe?.length ? (
                <ul className="space-y-0.5 list-disc list-inside">
                  {c.recipe.map((r) => (
                    <li key={r.id}>
                      {r.product.name} — {Number(r.quantity)} {r.unit || 'unit'}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-slate-400">No ingredients yet</span>
              )}
            </div>
            <div className="flex gap-4 mt-3">
              <button
                onClick={() => {
                  setEditing(c);
                  setOpen(true);
                }}
                className="text-slate-700 hover:underline text-xs"
              >
                Edit
              </button>
              <button
                onClick={() => setUsageFor(c)}
                className="text-blue-600 hover:underline text-xs"
              >
                View orders
              </button>
              <button
                onClick={() => {
                  if (confirm(`Delete ${c.name}?`)) del.mutate(c.id);
                }}
                className="text-red-600 hover:underline text-xs"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {!isLoading && !data?.cuisines?.length && (
          <div className="text-slate-500 text-sm col-span-full">
            No cuisines yet. Click "Add cuisine" to create one.
          </div>
        )}
      </div>
      {open && (
        <CuisineForm
          editing={editing}
          products={products.data?.products || []}
          onClose={() => {
            setOpen(false);
            setEditing(null);
          }}
        />
      )}
      {usageFor && (
        <UsageModal
          title={`Orders using "${usageFor.name}"`}
          subtitle="Every order containing this cuisine, with plates, status, and assigned workers."
          url={`/cuisines/${usageFor.id}/usage`}
          onClose={() => setUsageFor(null)}
          render={(data, { StatusPill }) => (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
                <Stat label="Total orders" value={data.summary.totalOrders} />
                <Stat label="Total plates" value={data.summary.totalPlates} />
                <Stat
                  label="Active plates"
                  value={data.summary.activePlates}
                  hint="not delivered/cancelled"
                />
              </div>
              {data.orders.length ? (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Order</th>
                      <th className="px-3 py-2">Customer</th>
                      <th className="px-3 py-2">Scheduled</th>
                      <th className="px-3 py-2">Plates</th>
                      <th className="px-3 py-2">Line total</th>
                      <th className="px-3 py-2">Workers</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.orders.map((o) => (
                      <tr key={o.orderId} className="border-t align-top">
                        <td className="px-3 py-2 font-mono text-xs">{o.orderNumber}</td>
                        <td className="px-3 py-2">
                          <div>{o.customerName || '—'}</div>
                          {o.customerPhone && (
                            <div className="text-xs text-slate-500">{o.customerPhone}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {o.scheduledFor ? new Date(o.scheduledFor).toLocaleString() : '—'}
                          {o.location && (
                            <div className="text-xs text-slate-500">{o.location}</div>
                          )}
                        </td>
                        <td className="px-3 py-2">{o.plates}</td>
                        <td className="px-3 py-2">${Number(o.lineTotal).toFixed(2)}</td>
                        <td className="px-3 py-2 text-xs">
                          {o.workers.length ? o.workers.join(', ') : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-3 py-2">
                          <StatusPill status={o.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-sm text-slate-500">No orders use this cuisine yet.</div>
              )}
            </>
          )}
        />
      )}
    </>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div className="border rounded p-3 bg-slate-50">
      <div className="text-[10px] uppercase text-slate-500">{label}</div>
      <div className="font-semibold text-slate-800">{value}</div>
      {hint && <div className="text-[10px] text-slate-400 mt-0.5">{hint}</div>}
    </div>
  );
}

function CuisineForm({ editing, products, onClose }) {
  const qc = useQueryClient();
  const isEdit = !!editing;
  const [form, setForm] = useState(() => ({
    name: editing?.name || '',
    description: editing?.description || '',
    category: editing?.category || '',
    pricePerPlate: editing?.pricePerPlate ?? 0,
    isActive: editing?.isActive ?? true,
    recipe:
      editing?.recipe?.map((r) => ({
        productId: r.productId,
        quantity: Number(r.quantity),
        unit: r.unit || '',
      })) || [],
  }));

  const save = useMutation({
    mutationFn: (payload) =>
      isEdit ? api.patch(`/cuisines/${editing.id}`, payload) : api.post('/cuisines', payload),
    onSuccess: () => {
      toast.success(isEdit ? 'Cuisine updated' : 'Cuisine created');
      qc.invalidateQueries({ queryKey: ['cuisines'] });
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err, 'Save failed')),
  });

  function setRecipe(idx, patch) {
    setForm((f) => ({
      ...f,
      recipe: f.recipe.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    }));
  }
  function addRecipe() {
    setForm((f) => ({
      ...f,
      recipe: [...f.recipe, { productId: '', quantity: 1, unit: '' }],
    }));
  }
  function removeRecipe(idx) {
    setForm((f) => ({ ...f, recipe: f.recipe.filter((_, i) => i !== idx) }));
  }

  function submit(e) {
    e.preventDefault();
    save.mutate({
      name: form.name,
      description: form.description || undefined,
      category: form.category || undefined,
      pricePerPlate: Number(form.pricePerPlate) || 0,
      isActive: form.isActive,
      recipe: form.recipe
        .filter((r) => r.productId)
        .map((r) => ({
          productId: r.productId,
          quantity: Number(r.quantity) || 1,
          unit: r.unit || undefined,
        })),
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <form
        onSubmit={submit}
        className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <h3 className="text-lg font-semibold mb-4">
          {isEdit ? 'Edit cuisine' : 'New cuisine'}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div className="md:col-span-2">
            <label className="block text-xs uppercase text-slate-500 mb-1">Name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs uppercase text-slate-500 mb-1">Category</label>
            <input
              placeholder="Indian, Mughlai, Snacks…"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs uppercase text-slate-500 mb-1">Price per plate</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.pricePerPlate}
              onChange={(e) => setForm({ ...form, pricePerPlate: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mb-3">
          <label className="block text-xs uppercase text-slate-500 mb-1">Description</label>
          <textarea
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>

        <label className="flex items-center gap-2 text-sm mb-4">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          Active (available to add to orders)
        </label>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs uppercase text-slate-500">Recipe (products used per plate)</label>
            <button
              type="button"
              onClick={addRecipe}
              className="text-xs text-blue-600 hover:underline"
            >
              + Add ingredient
            </button>
          </div>
          <div className="space-y-2">
            {form.recipe.map((r, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <select
                  value={r.productId}
                  onChange={(e) => setRecipe(idx, { productId: e.target.value })}
                  className="col-span-6 border rounded px-2 py-1 text-sm"
                >
                  <option value="">Select product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={r.quantity}
                  onChange={(e) => setRecipe(idx, { quantity: e.target.value })}
                  className="col-span-2 border rounded px-2 py-1 text-sm"
                  placeholder="Qty"
                />
                <input
                  value={r.unit}
                  onChange={(e) => setRecipe(idx, { unit: e.target.value })}
                  placeholder="g, ml, pcs…"
                  className="col-span-3 border rounded px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeRecipe(idx)}
                  className="col-span-1 text-red-600 text-xs"
                >
                  ✕
                </button>
              </div>
            ))}
            {!form.recipe.length && (
              <div className="text-xs text-slate-500">
                Add ingredients so the kitchen knows what each plate needs.
              </div>
            )}
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
