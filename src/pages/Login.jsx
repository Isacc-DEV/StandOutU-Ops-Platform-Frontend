import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';

export default function Login() {
  const [email, setEmail] = useState('admin@ops.local');
  const [password, setPassword] = useState('password123');
  const nav = useNavigate();

  const onSubmit = async e => {
    e.preventDefault();
    const { token, error } = await api.post('/auth/login', { email, password });
    if (token) {
      localStorage.setItem('token', token);
      api.setToken(token);
      nav('/dashboard');
    } else if (error) {
      alert(error);
    }
  };

  return (
    <div className="flex items-center justify-center py-16">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-lg shadow-slate-200/60"
      >
        <div className="space-y-1 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Operations Portal</p>
          <h2 className="text-2xl font-semibold text-slate-900">Sign in</h2>
          <p className="text-xs text-slate-500">Use the seeded admin account to explore the dashboard.</p>
        </div>
        <label className="block space-y-1 text-left text-sm font-medium text-slate-600">
          Email
          <input
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none ring-offset-2 transition focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-200"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="email"
            type="email"
          />
        </label>
        <label className="block space-y-1 text-left text-sm font-medium text-slate-600">
          Password
          <input
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none ring-offset-2 transition focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-200"
            value={password}
            type="password"
            onChange={e => setPassword(e.target.value)}
            placeholder="password"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-xl bg-indigo-600 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:ring-offset-2"
        >
          Login
        </button>
      </form>
    </div>
  );
}
