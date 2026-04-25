import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client.js';
import PageHeader from '../components/PageHeader.jsx';

function Stat({ label, value }) {
  return (
    <div className="bg-white rounded-lg p-5 shadow-sm border">
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className="text-3xl font-semibold mt-2">{value ?? '—'}</div>
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => (await api.get('/reports/dashboard')).data,
  });

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Overview of your business" />
      <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Stat label="Active workers" value={isLoading ? '…' : data?.workerCount} />
        <Stat label="Customers" value={isLoading ? '…' : data?.customerCount} />
        <Stat label="Active products" value={isLoading ? '…' : data?.productCount} />
        <Stat label="Pending orders" value={isLoading ? '…' : data?.pendingOrders} />
        <Stat label="Low stock items" value={isLoading ? '…' : data?.lowStockCount} />
      </div>
    </>
  );
}
