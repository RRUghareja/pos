import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './store/auth.js';
import Login from './pages/Login.jsx';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Workers from './pages/Workers.jsx';
import Customers from './pages/Customers.jsx';
import Attendance from './pages/Attendance.jsx';
import Products from './pages/Products.jsx';
import Cuisines from './pages/Cuisines.jsx';
import Orders from './pages/Orders.jsx';
import Inventory from './pages/Inventory.jsx';
import Reports from './pages/Reports.jsx';

function Private({ children }) {
  const { token, user } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (user?.role !== 'ADMIN') return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <Private>
            <Layout />
          </Private>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="workers" element={<Workers />} />
        <Route path="customers" element={<Customers />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="products" element={<Products />} />
        <Route path="cuisines" element={<Cuisines />} />
        <Route path="orders" element={<Orders />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="reports" element={<Reports />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
