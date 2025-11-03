import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client.js';

const formatDate = value => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString();
};

const formatDateTime = value => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
};

const formatCheckStatus = status =>
  (status || '')
    .toString()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());

const formatCheckResult = result => {
  if (!result) return '';
  if (result === 'ok') return 'OK';
  return result
    .toString()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
};

export default function ApplicationDetail() {
  const { id } = useParams();
  const [application, setApplication] = useState(null);

  useEffect(() => {
    if (!id) return undefined;

    let ignore = false;
    setApplication(null);

    api
      .get(`/applications/${id}`)
      .then(data => {
        if (!ignore) {
          setApplication(data);
        }
      })
      .catch(error => {
        if (!ignore) {
          console.error('Failed to load application detail', error);
        }
      });

    return () => {
      ignore = true;
    };
  }, [id]);

  if (!application) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm text-slate-400">Loading application...</span>
      </div>
    );
  }

  const a = application;
  const appliedDate = formatDate(a.appliedAt || a.createdAt);
  const checkedAt = formatDateTime(a.checkedAt);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
          <span>
            Profile:{' '}
            <strong className="font-semibold text-slate-700">
              {a.profileId?.alias || 'Unknown'}
            </strong>
          </span>
          <span>
            Resume:{' '}
            <strong className="font-semibold text-slate-700">
              {a.resumeId?.title || 'Untitled resume'}
            </strong>
            {a.resumeId?.note && (
              <em className="ml-2 text-xs text-slate-400">{a.resumeId.note}</em>
            )}
          </span>
          <span>
            Bidder:{' '}
            <strong className="font-semibold text-slate-700">
              {a.bidderId?.name || 'Unassigned'}
            </strong>
          </span>
          <span>
            Applied At:{' '}
            <strong className="font-semibold text-slate-700">
              {appliedDate || 'N/A'}
            </strong>
          </span>
          <span>
            Check Status:{' '}
            <strong className="font-semibold text-slate-700">
              {formatCheckStatus(a.checkStatus) || 'Pending'}
            </strong>
          </span>
          <span className="flex items-center gap-2">
            <span>
              Check Result:{' '}
              <strong className="font-semibold text-slate-700">
                {formatCheckResult(a.checkResult) || 'Pending'}
              </strong>
            </span>
            <button
              type="button"
              title="Edit check details"
              aria-label="Edit check details"
              className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-transparent text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
            >
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
                className="h-4 w-4"
              >
                <path d="M17.414 2.586a2 2 0 0 0-2.828 0L6.75 10.422 6 13.5l3.078-.75 7.836-7.836a2 2 0 0 0 0-2.828zM4 15.5a1 1 0 0 1 1-1h2.086l7.4-7.4 1.414 1.414-7.4 7.4V18.5H5a1 1 0 0 1-1-1v-2z" />
              </svg>
            </button>
          </span>
          {a.checkedBy?.name && (
            <span>
              Checked By:{' '}
              <strong className="font-semibold text-slate-700">{a.checkedBy.name}</strong>
            </span>
          )}
          {checkedAt && (
            <span>
              Checked At:{' '}
              <strong className="font-semibold text-slate-700">{checkedAt}</strong>
            </span>
          )}
        </div>
        <h2 className="text-2xl font-semibold text-slate-900">{a.company}</h2>
        <p className="text-sm text-slate-500">{a.roleTitle}</p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Notes
        </h3>
        <dl className="mt-4 grid gap-4 text-sm text-slate-600 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Bidder Note
            </dt>
            <dd className="mt-1 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              {a.bidderNote ? (
                a.bidderNote
              ) : (
                <span className="text-xs text-slate-400">No bidder note yet.</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Check Note
            </dt>
            <dd className="mt-1 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              {a.checkNote ? (
                a.checkNote
              ) : (
                <span className="text-xs text-slate-400">No check note yet.</span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Pipeline Steps
        </h3>
        <div className="mt-4 space-y-3">
          {(a.steps || []).map((s, i) => (
            <div
              key={i}
              className="flex flex-col rounded-xl border border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-semibold text-slate-800 capitalize">
                  {s.name}
                </p>
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
          {!a.steps?.length && (
            <p className="text-xs text-slate-400">No steps recorded yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

