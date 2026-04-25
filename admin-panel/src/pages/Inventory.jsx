import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, errorMessage } from '../api/client.js';
import PageHeader from '../components/PageHeader.jsx';
import UsageModal from '../components/UsageModal.jsx';

const TYPES = [
  { value: 'RAW_MATERIAL', label: 'Raw material' },
  { value: 'KITCHEN_EQUIPMENT', label: 'Kitchen equipment' },
  { value: 'OTHER', label: 'Other' },
];

const TYPE_LABEL = Object.fromEntries(TYPES.map((t) => [t.value, t.label]));

export default function Inventory() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [usageFor, setUsageFor] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', filter],
    queryFn: async () =>
      (await api.get(`/inventory${filter ? `?type=${filter}` : ''}`)).data,
  });

  const del = useMutation({
    mutationFn: (id) => api.delete(`/inventory/${id}`),
    onSuccess: () => {
      toast.success('Deleted');
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err) => toast.error(errorMessage(err, 'Delete failed')),
  });

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="Raw materials, kitchen equipment, and stock levels"
        actions={
          <button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
            className="bg-slate-900 text-white px-4 py-2 rounded text-sm"
          >
            + Add item
          </button>
        }
      />
      <div className="p-8 space-y-4">
        {data?.lowStock?.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-900">
            ⚠️ {data.lowStock.length} item(s) at or below minimum stock level.
          </div>
        )}
        <div className="flex items-center gap-3">
          <label className="text-xs uppercase text-slate-500">Type</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="">All</option>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3">Min</th>
                <th className="px-4 py-3">Cost</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan="9" className="px-4 py-6 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              )}
              {data?.items?.map((i) => (
                <tr
                  key={i.id}
                  className={`border-t ${i.quantity <= i.minStockLevel ? 'bg-amber-50' : ''}`}
                >
                  <td className="px-4 py-3 font-medium">{i.name}</td>
                  <td className="px-4 py-3 text-xs">{TYPE_LABEL[i.type] || i.type}</td>
                  <td className="px-4 py-3">{i.category || '—'}</td>
                  <td className="px-4 py-3">{i.quantity}</td>
                  <td className="px-4 py-3">{i.unit}</td>
                  <td className="px-4 py-3">{i.minStockLevel}</td>
                  <td className="px-4 py-3">${Number(i.costPrice).toFixed(2)}</td>
                  <td className="px-4 py-3">{i.supplierName || '—'}</td>
                  <td className="px-4 py-3 text-right space-x-3 whitespace-nowrap">
                    <button
                      onClick={() => setUsageFor(i)}
                      className="text-blue-600 hover:underline text-xs"
                    >
                      Usage
                    </button>
                    <button
                      onClick={() => {
                        setEditing(i);
                        setOpen(true);
                      }}
                      className="text-slate-700 hover:underline text-xs"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete ${i.name}?`)) del.mutate(i.id);
                      }}
                      className="text-red-600 hover:underline text-xs"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!isLoading && !data?.items?.length && (
                <tr>
                  <td colSpan="9" className="px-4 py-6 text-center text-slate-500">
                    No inventory items.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {open && (
        <ItemForm
          editing={editing}
          onClose={() => {
            setOpen(false);
            setEditing(null);
          }}
        />
      )}
      {usageFor && (
        <UsageModal
          title={`Usage for "${usageFor.name}"`}
          subtitle="Orders that have this item booked. Active = not delivered or cancelled."
          url={`/inventory/${usageFor.id}/usage`}
          onClose={() => setUsageFor(null)}
          render={(data, { StatusPill }) => (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
                <Stat label="In stock" value={`${data.item.quantity} ${data.item.unit}`} />
                <Stat
                  label="Booked (active)"
                  value={`${data.summary.bookedActive} ${data.item.unit}`}
                  warn={data.summary.bookedActive > data.item.quantity}
                />
                <Stat
                  label="Available"
                  value={`${data.summary.available} ${data.item.unit}`}
                  warn={data.summary.available < 0}
                />
              </div>
              {data.orders.length ? (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Order</th>
                      <th className="px-3 py-2">Customer</th>
                      <th className="px-3 py-2">Scheduled</th>
                      <th className="px-3 py-2">Qty</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.orders.map((o) => (
                      <tr key={o.orderId} className="border-t">
                        <td className="px-3 py-2 font-mono text-xs">{o.orderNumber}</td>
                        <td className="px-3 py-2">{o.customerName || '—'}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {o.scheduledFor
                            ? new Date(o.scheduledFor).toLocaleString()
                            : '—'}
                        </td>
                        <td className="px-3 py-2">
                          {o.quantity} {data.item.unit}
                        </td>
                        <td className="px-3 py-2">
                          <StatusPill status={o.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-sm text-slate-500">Not used in any order yet.</div>
              )}
            </>
          )}
        />
      )}
    </>
  );
}

function Stat({ label, value, warn }) {
  return (
    <div className={`border rounded p-3 ${warn ? 'border-amber-300 bg-amber-50' : 'bg-slate-50'}`}>
      <div className="text-[10px] uppercase text-slate-500">{label}</div>
      <div className={`font-semibold ${warn ? 'text-amber-800' : 'text-slate-800'}`}>{value}</div>
    </div>
  );
}

function ItemForm({ editing, onClose }) {
  const qc = useQueryClient();
  const isEdit = !!editing;
  const [form, setForm] = useState(() => ({
    name: editing?.name || '',
    type: editing?.type || 'RAW_MATERIAL',
    category: editing?.category || '',
    quantity: editing?.quantity ?? 0,
    unit: editing?.unit || 'kg',
    minStockLevel: editing?.minStockLevel ?? 0,
    costPrice: editing?.costPrice ?? 0,
    sellingPrice: editing?.sellingPrice ?? 0,
    supplierName: editing?.supplierName || '',
  }));

  const save = useMutation({
    mutationFn: (payload) =>
      isEdit ? api.patch(`/inventory/${editing.id}`, payload) : api.post('/inventory', payload),
    onSuccess: () => {
      toast.success(isEdit ? 'Item updated' : 'Item created');
      qc.invalidateQueries({ queryKey: ['inventory'] });
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err, 'Save failed')),
  });

  function submit(e) {
    e.preventDefault();
    save.mutate({
      name: form.name,
      type: form.type,
      category: form.category || undefined,
      quantity: Number(form.quantity) || 0,
      unit: form.unit || 'piece',
      minStockLevel: Number(form.minStockLevel) || 0,
      costPrice: Number(form.costPrice) || 0,
      sellingPrice: Number(form.sellingPrice) || 0,
      supplierName: form.supplierName || undefined,
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <form
        onSubmit={submit}
        className="bg-white rounded-lg p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto"
      >
        <h3 className="text-lg font-semibold mb-4">
          {isEdit ? 'Edit inventory item' : 'New inventory item'}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div className="md:col-span-2">
            <label className="block text-xs uppercase text-slate-500 mb-1">Name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="Vegetables, Oil, Steel bowl…"
            />
          </div>
          <div>
            <label className="block text-xs uppercase text-slate-500 mb-1">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase text-slate-500 mb-1">Category</label>
            <input
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="Spices, Dairy, Utensils…"
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs uppercase text-slate-500 mb-1">Quantity</label>
            <input
              type="number"
              step="0.01"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs uppercase text-slate-500 mb-1">Unit</label>
            <input
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              placeholder="kg, L, pcs…"
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs uppercase text-slate-500 mb-1">Min stock</label>
            <input
              type="number"
              value={form.minStockLevel}
              onChange={(e) => setForm({ ...form, minStockLevel: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs uppercase text-slate-500 mb-1">Cost price</label>
            <input
              type="number"
              step="0.01"
              value={form.costPrice}
              onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs uppercase text-slate-500 mb-1">Selling price</label>
            <input
              type="number"
              step="0.01"
              value={form.sellingPrice}
              onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs uppercase text-slate-500 mb-1">Supplier</label>
            <input
              value={form.supplierName}
              onChange={(e) => setForm({ ...form, supplierName: e.target.value })}
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
