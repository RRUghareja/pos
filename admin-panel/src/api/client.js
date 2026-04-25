import axios from 'axios';
import { useAuth } from '../store/auth.js';

const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
export const api = axios.create({
  baseURL: `${apiBase}/api`,
});

api.interceptors.request.use((config) => {
  const token = useAuth.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      useAuth.getState().logout();
    }
    return Promise.reject(err);
  },
);

export function errorMessage(err, fallback = 'Something went wrong') {
  const data = err?.response?.data;
  if (!data) return err?.message || fallback;
  if (Array.isArray(data.details) && data.details.length) {
    return data.details
      .map((d) => {
        const field = Array.isArray(d.path) ? d.path.join('.') : d.path;
        return field ? `${field}: ${d.message}` : d.message;
      })
      .join('\n');
  }
  return data.error || data.message || fallback;
}
