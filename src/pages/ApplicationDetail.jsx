import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client.js';

export default function ApplicationDetail() {
  const { id } = useParams();
  const [application, setApplication] = useState(null);

  useEffect(() => {
    (async () => {
      setApplication(await api.get(`/applications/${id}`));
    })();
  }, [id]);

  if (!application) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm text-slate-400">Loading application...</span>
      </div>
    );
  }

  const a = application;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
            {a.status}
          </span>
          <span>Profile: <strong className="font-semibold text-slate-700">{a.profileId?.alias}</strong></span>
          <span>
            Resume:{' '}
            <strong className="font-semibold text-slate-700">
              {a.resumeId?.title || 'Untitled resume'}
            </strong>
            {a.resumeId?.note && (
              <em className="ml-2 text-xs text-slate-400">{a.resumeId.note}</em>
            )}
          </span>
          <span>Bidder: <strong className="font-semibold text-slate-700">{a.bidderId?.name || 'Unassigned'}</strong></span>
        </div>
        <h2 className="text-2xl font-semibold text-slate-900">{a.company}</h2>
        <p className="text-sm text-slate-500">{a.roleTitle}</p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Pipeline Steps</h3>
        <div className="mt-4 space-y-3">
          {(a.steps || []).map((s, i) => (
            <div key={i} className="flex flex-col rounded-xl border border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800 capitalize">{s.name}</p>
                {s.notes && <p className="text-xs text-slate-500">{s.notes}</p>}
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-600">
                  {s.status}
                </span>
                <span>{s.date ? new Date(s.date).toLocaleString() : 'Date TBD'}</span>
              </div>
            </div>
          ))}
          {!a.steps?.length && <p className="text-xs text-slate-400">No steps recorded yet.</p>}
        </div>
      </section>
    </div>
  );
}
