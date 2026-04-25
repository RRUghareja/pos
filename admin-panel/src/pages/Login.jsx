import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api, errorMessage } from '../api/client.js';
import { useAuth } from '../store/auth.js';

export default function Login() {
  const nav = useNavigate();
  const setAuth = useAuth((s) => s.setAuth);
  const [email, setEmail] = useState('admin@pos.local');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      if (data.user.role !== 'ADMIN') {
        toast.error('Only admin users can access this panel');
        return;
      }
      setAuth(data.token, data.user);
      nav('/');
    } catch (err) {
      toast.error(errorMessage(err, 'Login failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-full flex items-center justify-center bg-slate-100">
      <form onSubmit={submit} className="w-full max-w-sm bg-white p-8 rounded-xl shadow">
        <h1 className="text-xl font-semibold mb-6">POS Admin Login</h1>
        <label className="block text-sm mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded px-3 py-2 mb-4"
          required
        />
        <label className="block text-sm mb-1">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded px-3 py-2 mb-6"
          required
        />
        <button
          disabled={loading}
          className="w-full bg-slate-900 text-white rounded py-2 disabled:opacity-60"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
