import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, errorMessage } from '../api/client.js';
import PageHeader from '../components/PageHeader.jsx';
import OrderDetailModal from '../components/OrderDetailModal.jsx';

const STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'DELIVERED', 'CANCELLED'];

function toLocalInput(date) {
  if (!date) return '';
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Orders() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [detailId, setDetailId] = useState(null);

  const orders = useQuery({
    queryKey: ['orders', status],
    queryFn: async () =>
      (await api.get(`/orders${status ? `?status=${status}` : ''}`)).data,
  });
  const workers = useQuery({
    queryKey: ['workers'],
    queryFn: async () => (await api.get('/workers')).data,
  });
  const customers = useQuery({
    queryKey: ['customers'],
    queryFn: async () => (await api.get('/customers')).data,
  });
  const cuisines = useQuery({
    queryKey: ['cuisines'],
    queryFn: async () => (await api.get('/cuisines?activeOnly=true')).data,
  });
  const inventory = useQuery({
    queryKey: ['inventory'],
    queryFn: async () => (await api.get('/inventory')).data,
  });

  const update = useMutation({
    mutationFn: ({ id, body }) => api.patch(`/orders/${id}`, body),
    onSuccess: () => {
      toast.success('Updated');
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err) => toast.error(errorMessage(err, 'Update failed')),
  });

  const del = useMutation({
    mutationFn: (id) => api.delete(`/orders/${id}`),
    onSuccess: () => {
      toast.success('Order deleted');
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err) => toast.error(errorMessage(err, 'Delete failed')),
  });

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle="Catering orders: cuisines, raw materials, kitchen inventory, workers"
        actions={
          <button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="bg-slate-900 text-white px-4 py-2 rounded text-sm"
          >
            + New order
          </button>
        }
      />
      <div className="p-8 space-y-4">
        <div className="flex items-center gap-3">
          <label className="text-xs uppercase text-slate-500">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3"></th>
                <th className="px-4 py-3">Order #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Scheduled</th>
                <th className="px-4 py-3">Workers</th>
                <th className="px-4 py-3">Plates</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.isLoading && (
                <tr>
                  <td colSpan="9" className="px-4 py-6 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              )}
              {orders.data?.orders?.map((o) => (
                <RowGroup
                  key={o.id}
                  order={o}
                  expanded={expanded === o.id}
                  onToggle={() => setExpanded(expanded === o.id ? null : o.id)}
                  onView={() => setDetailId(o.id)}
                  onEdit={() => {
                    setEditing(o);
                    setFormOpen(true);
                  }}
                  onDelete={() => {
                    if (confirm(`Delete order ${o.orderNumber}?`)) del.mutate(o.id);
                  }}
                  onStatus={(s) => update.mutate({ id: o.id, body: { status: s } })}
                />
              ))}
              {!orders.isLoading && !orders.data?.orders?.length && (
                <tr>
                  <td colSpan="9" className="px-4 py-6 text-center text-slate-500">
                    No orders yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {formOpen && (
        <OrderForm
          editing={editing}
          customers={customers.data?.customers || []}
          workers={workers.data?.workers || []}
          cuisines={cuisines.data?.cuisines || []}
          inventory={inventory.data?.items || []}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        />
      )}
      {detailId && (
        <OrderDetailModal
          orderId={detailId}
          onClose={() => setDetailId(null)}
          onEdit={(o) => {
            setEditing(o);
            setFormOpen(true);
            setDetailId(null);
          }}
        />
      )}
    </>
  );
}

function RowGroup({ order: o, expanded, onToggle, onView, onEdit, onDelete, onStatus }) {
  const totalPlates = (o.cuisines || []).reduce((s, c) => s + c.plates, 0);
  return (
    <>
      <tr className="border-t">
        <td className="px-4 py-3">
          <button onClick={onToggle} className="text-slate-500 text-xs">
            {expanded ? '▾' : '▸'}
          </button>
        </td>
        <td className="px-4 py-3 font-mono text-xs">
          <button onClick={onView} className="text-blue-600 hover:underline">
            {o.orderNumber}
          </button>
        </td>
        <td className="px-4 py-3">{o.customer?.user?.name || '—'}</td>
        <td className="px-4 py-3 whitespace-nowrap">
          {o.scheduledFor ? new Date(o.scheduledFor).toLocaleString() : '—'}
        </td>
        <td className="px-4 py-3">
          {o.workers?.length
            ? o.workers.map((w) => w.worker.user.name).join(', ')
            : <span className="text-slate-400">— Unassigned —</span>}
        </td>
        <td className="px-4 py-3">{totalPlates || '—'}</td>
        <td className="px-4 py-3">${Number(o.total).toFixed(2)}</td>
        <td className="px-4 py-3">
          <select
            value={o.status}
            onChange={(e) => onStatus(e.target.value)}
            className="border rounded px-2 py-1 text-xs"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </td>
        <td className="px-4 py-3 text-right space-x-3 whitespace-nowrap">
          <button onClick={onView} className="text-blue-600 hover:underline text-xs">
            View
          </button>
          <button onClick={onEdit} className="text-slate-700 hover:underline text-xs">
            Edit
          </button>
          <button onClick={onDelete} className="text-red-600 hover:underline text-xs">
            Delete
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-slate-50 border-t">
          <td></td>
          <td colSpan="8" className="px-4 py-4 text-xs text-slate-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="font-semibold uppercase text-slate-500 text-[10px] mb-1">
                  Cuisines
                </div>
                {o.cuisines?.length ? (
                  <ul className="space-y-1">
                    {o.cuisines.map((c) => (
                      <li key={c.id}>
                        {c.cuisine.name} × {c.plates} plates —{' '}
                        ${(Number(c.unitPrice) * c.plates).toFixed(2)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-slate-400">None</div>
                )}
                {o.items?.length > 0 && (
                  <>
                    <div className="font-semibold uppercase text-slate-500 text-[10px] mt-3 mb-1">
                      Legacy products
                    </div>
                    <ul className="space-y-1">
                      {o.items.map((i) => (
                        <li key={i.id}>
                          {i.product.name} × {i.quantity}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
              <div>
                <div className="font-semibold uppercase text-slate-500 text-[10px] mb-1">
                  Raw materials
                </div>
                {(() => {
                  const raws = (o.inventoryUsage || []).filter(
                    (u) => u.inventoryItem.type === 'RAW_MATERIAL',
                  );
                  return raws.length ? (
                    <ul className="space-y-1">
                      {raws.map((u) => (
                        <li key={u.id}>
                          {u.inventoryItem.name} — {u.quantity} {u.inventoryItem.unit}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-slate-400">None</div>
                  );
                })()}
                <div className="font-semibold uppercase text-slate-500 text-[10px] mt-3 mb-1">
                  Kitchen inventory
                </div>
                {(() => {
                  const kit = (o.inventoryUsage || []).filter(
                    (u) => u.inventoryItem.type !== 'RAW_MATERIAL',
                  );
                  return kit.length ? (
                    <ul className="space-y-1">
                      {kit.map((u) => (
                        <li key={u.id}>
                          {u.inventoryItem.name} — {u.quantity} {u.inventoryItem.unit}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-slate-400">None</div>
                  );
                })()}
              </div>
              <div>
                <div className="font-semibold uppercase text-slate-500 text-[10px] mb-1">
                  Location
                </div>
                <div>{o.location || <span className="text-slate-400">—</span>}</div>
              </div>
              <div>
                <div className="font-semibold uppercase text-slate-500 text-[10px] mb-1">
                  Notes
                </div>
                <div>{o.notes || <span className="text-slate-400">—</span>}</div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function OrderForm({ editing, customers, workers, cuisines, inventory, onClose }) {
  const qc = useQueryClient();
  const isEdit = !!editing;

  const rawMaterials = useMemo(
    () => inventory.filter((i) => i.type === 'RAW_MATERIAL'),
    [inventory],
  );
  const kitchenItems = useMemo(
    () => inventory.filter((i) => i.type !== 'RAW_MATERIAL'),
    [inventory],
  );

  const [form, setForm] = useState(() => ({
    customerId: editing?.customerId || '',
    scheduledFor: toLocalInput(editing?.scheduledFor),
    location: editing?.location || '',
    notes: editing?.notes || '',
    status: editing?.status || 'PENDING',
    workerIds: editing?.workers?.map((w) => w.workerId) || [],
    cuisineLines:
      editing?.cuisines?.map((c) => ({
        cuisineId: c.cuisineId,
        plates: c.plates,
      })) || [],
    rawMaterialLines:
      editing?.inventoryUsage
        ?.filter((u) => u.inventoryItem.type === 'RAW_MATERIAL')
        .map((u) => ({ inventoryItemId: u.inventoryItemId, quantity: u.quantity })) || [],
    kitchenLines:
      editing?.inventoryUsage
        ?.filter((u) => u.inventoryItem.type !== 'RAW_MATERIAL')
        .map((u) => ({ inventoryItemId: u.inventoryItemId, quantity: u.quantity })) || [],
  }));

  // Conflict check based on scheduledFor
  const [conflicts, setConflicts] = useState({ workerIds: [], inventoryUsage: {} });
  useEffect(() => {
    if (!form.scheduledFor) {
      setConflicts({ workerIds: [], inventoryUsage: {} });
      return;
    }
    const params = new URLSearchParams();
    params.set('scheduledFor', new Date(form.scheduledFor).toISOString());
    if (editing?.id) params.set('excludeOrderId', editing.id);
    let cancel = false;
    api
      .get(`/orders/conflicts/check?${params.toString()}`)
      .then((r) => {
        if (!cancel) setConflicts(r.data);
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, [form.scheduledFor, editing?.id]);

  const save = useMutation({
    mutationFn: (payload) =>
      isEdit ? api.patch(`/orders/${editing.id}`, payload) : api.post('/orders', payload),
    onSuccess: () => {
      toast.success(isEdit ? 'Order updated' : 'Order created');
      qc.invalidateQueries({ queryKey: ['orders'] });
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err, 'Save failed')),
  });

  const cuisineMap = useMemo(() => new Map(cuisines.map((c) => [c.id, c])), [cuisines]);
  const orderTotal = useMemo(
    () =>
      form.cuisineLines.reduce((sum, l) => {
        const c = cuisineMap.get(l.cuisineId);
        return sum + (c ? Number(c.pricePerPlate) * (Number(l.plates) || 0) : 0);
      }, 0),
    [form.cuisineLines, cuisineMap],
  );

  function toggleWorker(id) {
    setForm((f) => ({
      ...f,
      workerIds: f.workerIds.includes(id)
        ? f.workerIds.filter((x) => x !== id)
        : [...f.workerIds, id],
    }));
  }

  function setCuisineLine(idx, patch) {
    setForm((f) => ({
      ...f,
      cuisineLines: f.cuisineLines.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    }));
  }
  function addCuisineLine() {
    setForm((f) => ({ ...f, cuisineLines: [...f.cuisineLines, { cuisineId: '', plates: 1 }] }));
  }
  function removeCuisineLine(idx) {
    setForm((f) => ({ ...f, cuisineLines: f.cuisineLines.filter((_, i) => i !== idx) }));
  }

  function setInvLine(field, idx, patch) {
    setForm((f) => ({
      ...f,
      [field]: f[field].map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    }));
  }
  function addInvLine(field) {
    setForm((f) => ({
      ...f,
      [field]: [...f[field], { inventoryItemId: '', quantity: 1 }],
    }));
  }
  function removeInvLine(field, idx) {
    setForm((f) => ({ ...f, [field]: f[field].filter((_, i) => i !== idx) }));
  }

  function submit(e) {
    e.preventDefault();
    const cuisinesPayload = form.cuisineLines
      .filter((l) => l.cuisineId)
      .map((l) => ({ cuisineId: l.cuisineId, plates: Number(l.plates) || 1 }));

    if (!cuisinesPayload.length) {
      toast.error('Add at least one cuisine');
      return;
    }
    const inventoryItems = [
      ...form.rawMaterialLines,
      ...form.kitchenLines,
    ]
      .filter((l) => l.inventoryItemId)
      .map((l) => ({
        inventoryItemId: l.inventoryItemId,
        quantity: Number(l.quantity) || 1,
      }));

    save.mutate({
      customerId: form.customerId || null,
      scheduledFor: form.scheduledFor ? new Date(form.scheduledFor).toISOString() : null,
      location: form.location || null,
      notes: form.notes || null,
      status: form.status,
      workerIds: form.workerIds,
      cuisines: cuisinesPayload,
      items: [],
      inventoryItems,
    });
  }

  function invName(id) {
    const i = inventory.find((x) => x.id === id);
    return i ? `${i.name} (in stock: ${i.quantity} ${i.unit})` : '—';
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <form
        onSubmit={submit}
        className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto"
      >
        <h3 className="text-lg font-semibold mb-4">{isEdit ? 'Edit order' : 'New order'}</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs uppercase text-slate-500 mb-1">Customer</label>
            <select
              value={form.customerId}
              onChange={(e) => setForm({ ...form, customerId: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="">— No customer —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.user.name} ({c.user.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase text-slate-500 mb-1">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase text-slate-500 mb-1">Scheduled for</label>
            <input
              type="datetime-local"
              value={form.scheduledFor}
              onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs uppercase text-slate-500 mb-1">Location</label>
            <input
              type="text"
              placeholder="Address, hall, table…"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
        </div>

        <Section title="Cuisines (plates per dish)">
          <div className="flex justify-end mb-2">
            <button
              type="button"
              onClick={addCuisineLine}
              className="text-xs text-blue-600 hover:underline"
            >
              + Add cuisine
            </button>
          </div>
          <div className="space-y-2">
            {form.cuisineLines.map((l, idx) => {
              const c = cuisineMap.get(l.cuisineId);
              return (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <select
                    value={l.cuisineId}
                    onChange={(e) => setCuisineLine(idx, { cuisineId: e.target.value })}
                    className="col-span-7 border rounded px-2 py-1 text-sm"
                  >
                    <option value="">Select cuisine</option>
                    {cuisines.map((cu) => (
                      <option key={cu.id} value={cu.id}>
                        {cu.name} (${Number(cu.pricePerPlate).toFixed(2)}/plate)
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={l.plates}
                    onChange={(e) => setCuisineLine(idx, { plates: e.target.value })}
                    className="col-span-2 border rounded px-2 py-1 text-sm"
                    placeholder="Plates"
                  />
                  <div className="col-span-2 text-sm text-slate-600 text-right">
                    {c
                      ? `$${(Number(c.pricePerPlate) * (Number(l.plates) || 0)).toFixed(2)}`
                      : '—'}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCuisineLine(idx)}
                    className="col-span-1 text-red-600 text-xs"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
            {!form.cuisineLines.length && (
              <div className="text-xs text-slate-500">
                No cuisines yet. Add one above.
              </div>
            )}
          </div>
          <div className="text-right text-sm font-semibold mt-2">
            Total: ${orderTotal.toFixed(2)}
          </div>
        </Section>

        <Section title="Workers assigned">
          {workers.length ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 border rounded p-3 max-h-40 overflow-y-auto">
              {workers.map((w) => {
                const isBusy = conflicts.workerIds.includes(w.id) && !form.workerIds.includes(w.id);
                return (
                  <label key={w.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.workerIds.includes(w.id)}
                      onChange={() => toggleWorker(w.id)}
                    />
                    <span>
                      {w.user.name}
                      {w.department ? (
                        <span className="text-slate-400 text-xs"> · {w.department}</span>
                      ) : null}
                      {isBusy && (
                        <span className="text-amber-600 text-[11px] ml-1">
                          (busy ±2h)
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-slate-500">No workers yet.</div>
          )}
        </Section>

        <Section title="Raw materials (vegetables, oil, masala, flour…)">
          <div className="flex justify-end mb-2">
            <button
              type="button"
              onClick={() => addInvLine('rawMaterialLines')}
              className="text-xs text-blue-600 hover:underline"
            >
              + Add raw material
            </button>
          </div>
          <InvLines
            lines={form.rawMaterialLines}
            options={rawMaterials}
            onChange={(idx, patch) => setInvLine('rawMaterialLines', idx, patch)}
            onRemove={(idx) => removeInvLine('rawMaterialLines', idx)}
            invName={invName}
            conflicts={conflicts.inventoryUsage}
            inventory={inventory}
          />
          {!rawMaterials.length && (
            <div className="text-xs text-slate-500 mt-2">
              No raw materials yet. Add them in Inventory with type "Raw material".
            </div>
          )}
        </Section>

        <Section title="Kitchen inventory (bowls, utensils, equipment)">
          <div className="flex justify-end mb-2">
            <button
              type="button"
              onClick={() => addInvLine('kitchenLines')}
              className="text-xs text-blue-600 hover:underline"
            >
              + Add kitchen item
            </button>
          </div>
          <InvLines
            lines={form.kitchenLines}
            options={kitchenItems}
            onChange={(idx, patch) => setInvLine('kitchenLines', idx, patch)}
            onRemove={(idx) => removeInvLine('kitchenLines', idx)}
            invName={invName}
            conflicts={conflicts.inventoryUsage}
            inventory={inventory}
          />
        </Section>

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
            {save.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create order'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-5 border rounded-lg p-4 bg-slate-50/50">
      <div className="text-xs uppercase text-slate-600 font-semibold mb-2">{title}</div>
      {children}
    </div>
  );
}

function InvLines({ lines, options, onChange, onRemove, invName, conflicts, inventory }) {
  return (
    <div className="space-y-2">
      {lines.map((l, idx) => {
        const item = inventory.find((x) => x.id === l.inventoryItemId);
        const otherUse = conflicts[l.inventoryItemId] || 0;
        const wantedQty = Number(l.quantity) || 0;
        const overbooked =
          item && otherUse + wantedQty > item.quantity ? otherUse + wantedQty : 0;
        return (
          <div key={idx} className="grid grid-cols-12 gap-2 items-center">
            <select
              value={l.inventoryItemId}
              onChange={(e) => onChange(idx, { inventoryItemId: e.target.value })}
              className="col-span-7 border rounded px-2 py-1 text-sm"
            >
              <option value="">Select item</option>
              {options.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} (in stock: {i.quantity} {i.unit})
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              min="1"
              value={l.quantity}
              onChange={(e) => onChange(idx, { quantity: e.target.value })}
              className="col-span-2 border rounded px-2 py-1 text-sm"
            />
            <div className="col-span-2 text-xs text-slate-500">
              {item?.unit || ''}
              {overbooked ? (
                <div className="text-amber-600 text-[11px]">
                  +{otherUse} elsewhere
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => onRemove(idx)}
              className="col-span-1 text-red-600 text-xs"
            >
              ✕
            </button>
          </div>
        );
      })}
      {!lines.length && <div className="text-xs text-slate-500">None.</div>}
    </div>
  );
}
