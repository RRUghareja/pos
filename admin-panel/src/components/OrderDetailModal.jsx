import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client.js';

const STATUS_STYLE = {
  PENDING: 'bg-amber-100 text-amber-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  DELIVERED: 'bg-slate-200 text-slate-700',
  CANCELLED: 'bg-rose-100 text-rose-700',
};

export default function OrderDetailModal({ orderId, onClose, onEdit }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => (await api.get(`/orders/${orderId}`)).data,
    enabled: !!orderId,
  });

  const o = data?.order;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b flex items-start justify-between sticky top-0 bg-white z-10">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold font-mono">
                {o?.orderNumber || 'Order'}
              </h3>
              {o && (
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_STYLE[o.status] || 'bg-slate-100'}`}
                >
                  {o.status}
                </span>
              )}
            </div>
            {o && (
              <div className="text-xs text-slate-500 mt-1">
                Created {new Date(o.createdAt).toLocaleString()} · Total $
                {Number(o.total).toFixed(2)}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {onEdit && o && (
              <button
                onClick={() => onEdit(o)}
                className="text-sm text-slate-700 hover:underline"
              >
                Edit
              </button>
            )}
            <button onClick={onClose} className="text-slate-500 text-sm">
              ✕
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {isLoading && <div className="text-sm text-slate-500">Loading…</div>}
          {error && <div className="text-sm text-rose-700">Failed to load order.</div>}
          {o && (
            <>
              <Section title="Schedule & location">
                <Grid>
                  <Field label="Scheduled for">
                    {o.scheduledFor ? new Date(o.scheduledFor).toLocaleString() : '—'}
                  </Field>
                  <Field label="Location">{o.location || '—'}</Field>
                </Grid>
              </Section>

              <Section title="Customer">
                {o.customer ? (
                  <Grid>
                    <Field label="Name">{o.customer.user.name}</Field>
                    <Field label="Email">{o.customer.user.email}</Field>
                    <Field label="Phone">{o.customer.user.phone || '—'}</Field>
                  </Grid>
                ) : (
                  <div className="text-sm text-slate-500">No customer linked.</div>
                )}
              </Section>

              <Section title={`Workers assigned (${o.workers?.length || 0})`}>
                {o.workers?.length ? (
                  <ul className="text-sm space-y-1">
                    {o.workers.map((w) => (
                      <li key={w.workerId} className="flex justify-between border-b py-1">
                        <span>{w.worker.user.name}</span>
                        <span className="text-xs text-slate-500">
                          assigned {new Date(w.assignedAt).toLocaleDateString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-slate-500">No workers assigned.</div>
                )}
              </Section>

              <Section
                title={`Cuisines (${o.cuisines?.length || 0} · ${(o.cuisines || []).reduce((s, c) => s + c.plates, 0)} plates)`}
              >
                {o.cuisines?.length ? (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Cuisine</th>
                        <th className="px-3 py-2">Plates</th>
                        <th className="px-3 py-2">Price/plate</th>
                        <th className="px-3 py-2 text-right">Line total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {o.cuisines.map((c) => (
                        <tr key={c.id} className="border-t">
                          <td className="px-3 py-2">{c.cuisine.name}</td>
                          <td className="px-3 py-2">{c.plates}</td>
                          <td className="px-3 py-2">${Number(c.unitPrice).toFixed(2)}</td>
                          <td className="px-3 py-2 text-right">
                            ${(Number(c.unitPrice) * c.plates).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-sm text-slate-500">No cuisines on this order.</div>
                )}
              </Section>

              {o.items?.length > 0 && (
                <Section title="Legacy products">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Product</th>
                        <th className="px-3 py-2">Qty</th>
                        <th className="px-3 py-2">Unit price</th>
                        <th className="px-3 py-2 text-right">Line total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {o.items.map((i) => (
                        <tr key={i.id} className="border-t">
                          <td className="px-3 py-2">{i.product.name}</td>
                          <td className="px-3 py-2">{i.quantity}</td>
                          <td className="px-3 py-2">${Number(i.unitPrice).toFixed(2)}</td>
                          <td className="px-3 py-2 text-right">
                            ${(Number(i.unitPrice) * i.quantity).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Section>
              )}

              <InventorySection
                title="Raw materials"
                items={(o.inventoryUsage || []).filter((u) => u.inventoryItem.type === 'RAW_MATERIAL')}
              />
              <InventorySection
                title="Kitchen inventory"
                items={(o.inventoryUsage || []).filter((u) => u.inventoryItem.type !== 'RAW_MATERIAL')}
              />

              {o.notes && (
                <Section title="Notes">
                  <div className="text-sm whitespace-pre-line">{o.notes}</div>
                </Section>
              )}

              <div className="flex justify-end items-center pt-4 border-t">
                <div className="text-sm text-slate-500 mr-4">Order total</div>
                <div className="text-xl font-semibold">${Number(o.total).toFixed(2)}</div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div className="text-xs uppercase text-slate-500 font-semibold mb-2">{title}</div>
      {children}
    </div>
  );
}

function Grid({ children }) {
  return <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">{children}</div>;
}

function Field({ label, children }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-slate-400">{label}</div>
      <div>{children}</div>
    </div>
  );
}

function InventorySection({ title, items }) {
  if (!items.length) return null;
  return (
    <Section title={title}>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2">Item</th>
            <th className="px-3 py-2">Quantity</th>
            <th className="px-3 py-2">Unit</th>
            <th className="px-3 py-2">In stock</th>
          </tr>
        </thead>
        <tbody>
          {items.map((u) => (
            <tr key={u.id} className="border-t">
              <td className="px-3 py-2">{u.inventoryItem.name}</td>
              <td className="px-3 py-2">{u.quantity}</td>
              <td className="px-3 py-2">{u.inventoryItem.unit}</td>
              <td className="px-3 py-2">
                {u.inventoryItem.quantity} {u.inventoryItem.unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}
