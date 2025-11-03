import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import StatCard from '../components/StatCard.jsx';

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    (async () => {
      setData(await api.get('/dashboard/stats'));
    })();
  }, []);

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm text-slate-400">Loading dashboard...</span>
      </div>
    );
  }

  const {
    totalApps = 0,
    appsByBidder = [],
    interviewsUpcoming = 0,
    checkStatusCounts = [],
    stepAgg = []
  } = data;
  const checkStatusMap = Object.fromEntries(
    (checkStatusCounts || []).map(item => [item._id, item.count])
  );
  const pendingChecks =
    (checkStatusMap.pending || 0) + (checkStatusMap.in_review || 0);
  const checkedCount = checkStatusMap.reviewed || 0;

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-semibold text-slate-900">Operations Overview</h2>
        <p className="text-sm text-slate-500">Monitor bidder throughput, interview health, and check progress.</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Applications" value={totalApps} />
        <StatCard title="Upcoming Interviews" value={interviewsUpcoming} />
        <StatCard title="Checks Outstanding" value={pendingChecks} hint="check status" />
        <StatCard title="Reviewed" value={checkedCount} hint="check status" />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Applications by Bidder</h3>
            <span className="text-xs text-slate-400">last 30 days</span>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {appsByBidder.map(row => (
              <li key={row._id ? row._id.toString() : 'unassigned'} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2">
                <span>{row.name || 'Unassigned'}</span>
                <span className="font-semibold text-slate-800">{row.count}</span>
              </li>
            ))}
            {!appsByBidder.length && <li className="text-xs text-slate-400">No bidder activity yet.</li>}
          </ul>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Step Outcomes</h3>
            <span className="text-xs text-slate-400">lifetime</span>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {stepAgg.map(s => (
              <li key={s._id || 'none'} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2">
                <span className="capitalize">{s._id || 'none'}</span>
                <span className="font-semibold text-slate-800">{s.count}</span>
              </li>
            ))}
            {!stepAgg.length && <li className="text-xs text-slate-400">No interview steps recorded.</li>}
          </ul>
        </article>
      </section>
    </div>
  );
}
