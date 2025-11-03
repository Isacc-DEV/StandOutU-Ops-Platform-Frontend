import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

const classes = ({ isActive }) =>
  [
    'block rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-indigo-100 text-indigo-700'
      : 'text-slate-600 hover:bg-slate-100 hover:text-indigo-700'
  ].join(' ');

const initials = name =>
  name
    ?.split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

export default function Nav() {
  const { user } = useAuth();

  return (
    <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white/90 backdrop-blur sm:sticky sm:top-0 sm:flex sm:h-screen sm:flex-col sm:self-start">
      <div className="flex h-full flex-col justify-between p-6">
        <div className="space-y-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Ops Suite</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Operations</h1>
          </div>
          <nav className="space-y-1">
            <NavLink className={classes} to="/dashboard">Dashboard</NavLink>
            <NavLink className={classes} to="/applications">Applications</NavLink>
            <NavLink className={classes} to="/profiles">Profiles</NavLink>
            <NavLink className={classes} to="/resumes">Resumes</NavLink>
            <NavLink className={classes} to="/interviews">Interviews</NavLink>
            <NavLink className={classes} to="/schedules">Schedules</NavLink>
            {/* {console.log(user?.role)} */}
            {user?.role === 'admin' && (
              <NavLink className={classes} to="/accounts">Manage Accounts</NavLink>
            )}
          </nav>
        </div>
        {user && (
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white/60 px-3 py-3">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-600">
                {initials(user.name)}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800">{user.name}</p>
              <p className="truncate text-xs text-slate-500">
                {user.companyRole || user.email}
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
