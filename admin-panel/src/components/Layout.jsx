import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth.js';

const items = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/workers', label: 'Workers' },
  { to: '/customers', label: 'Customers' },
  { to: '/attendance', label: 'Attendance' },
  { to: '/products', label: 'Products' },
  { to: '/cuisines', label: 'Cuisines' },
  { to: '/orders', label: 'Orders' },
  { to: '/inventory', label: 'Inventory' },
  { to: '/reports', label: 'Reports' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  return (
    <div className="flex h-full">
      <aside className="w-60 bg-slate-900 text-slate-100 flex flex-col">
        <div className="px-5 py-4 text-lg font-semibold border-b border-slate-800">POS Admin</div>
        <nav className="flex-1 py-3">
          {items.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.end}
              className={({ isActive }) =>
                `block px-5 py-2 text-sm ${isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800'}`
              }
            >
              {i.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800 text-xs">
          <div className="mb-2">{user?.name} · {user?.email}</div>
          <button
            onClick={() => {
              logout();
              nav('/login');
            }}
            className="text-slate-300 hover:text-white"
          >
            Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
