import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

export default function Schedules() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    (async () => {
      setItems(await api.get('/interviews'));
    })();
  }, []);

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-slate-900">Meeting Schedule</h2>
        <p className="text-sm text-slate-500">Sync callers and supporters on all upcoming interviews.</p>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <ul className="divide-y divide-slate-200">
          {items.map(i => (
            <li key={i._id} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {i.applicationId?.roleTitle} · {i.applicationId?.company}
                </p>
                <p className="text-xs text-slate-500">
                  Caller: {i.callerId?.name || '—'} · Support: {i.supporterId?.name || '—'}
                </p>
              </div>
              <div className="text-sm font-medium text-indigo-600">
                {new Date(i.scheduledAt).toLocaleString()}
              </div>
            </li>
          ))}
          {!items.length && (
            <li className="px-5 py-8 text-center text-sm text-slate-400">
              No interviews scheduled yet.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
