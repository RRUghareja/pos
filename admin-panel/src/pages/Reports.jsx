import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client.js';
import PageHeader from '../components/PageHeader.jsx';

export default function Reports() {
  const salary = useQuery({
    queryKey: ['report-salary'],
    queryFn: async () => (await api.get('/reports/salary')).data,
  });
  const sales = useQuery({
    queryKey: ['report-sales'],
    queryFn: async () => (await api.get('/reports/sales')).data,
  });

  return (
    <>
      <PageHeader title="Reports" subtitle="Last 30 days" />
      <div className="p-8 space-y-8">
        <section>
          <h2 className="font-semibold mb-3">Sales</h2>
          <div className="bg-white rounded-lg border p-5 grid grid-cols-2 gap-6 max-w-md">
            <div>
              <div className="text-xs uppercase text-slate-500">Orders</div>
              <div className="text-2xl font-semibold">{sales.data?.orderCount ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-500">Revenue</div>
              <div className="text-2xl font-semibold">${sales.data?.totalRevenue?.toFixed(2) ?? '—'}</div>
            </div>
          </div>
        </section>
        <section>
          <h2 className="font-semibold mb-3">Salary (last 30 days)</h2>
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Worker</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Rate</th>
                  <th className="px-4 py-3">Hours</th>
                  <th className="px-4 py-3">Days</th>
                  <th className="px-4 py-3">Salary</th>
                </tr>
              </thead>
              <tbody>
                {salary.data?.rows?.map((r) => (
                  <tr key={r.workerId} className="border-t">
                    <td className="px-4 py-3 font-medium">{r.name}</td>
                    <td className="px-4 py-3">{r.salaryType}</td>
                    <td className="px-4 py-3">${r.salaryRate}</td>
                    <td className="px-4 py-3">{r.totalHours}</td>
                    <td className="px-4 py-3">{r.daysWorked}</td>
                    <td className="px-4 py-3 font-semibold">${r.salary.toFixed(2)}</td>
                  </tr>
                ))}
                {!salary.data?.rows?.length && (
                  <tr>
                    <td colSpan="6" className="px-4 py-6 text-center text-slate-500">
                      No data.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
