import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../hooks/useAuth.js';

const PROFILE_OPTIONS = [
  { value: 'edit', label: 'View & edit' },
  { value: 'view', label: 'View only' },
  { value: 'none', label: 'No access' }
];

const clone = value => JSON.parse(JSON.stringify(value));

const defaultAppPermissions = () => ({
  manageAllApplications: false,
  manageApplications: [],
  checkApplications: [],
  checkAllApplications: false
});

const toStringIdArray = value => {
  if (!Array.isArray(value)) return [];
  const set = new Set();
  value.forEach(item => {
    if (!item) return;
    if (typeof item === 'string') {
      if (item.trim()) set.add(item.trim());
      return;
    }
    if (typeof item === 'object') {
      const id = item._id || item.id;
      if (typeof id === 'string' && id.trim()) {
        set.add(id.trim());
        return;
      }
    }
    if (typeof item.toString === 'function') {
      const next = item.toString();
      if (next && next !== '[object Object]') {
        set.add(next);
      }
    }
  });
  return Array.from(set).sort();
};

const normalizeAppPermissions = value => {
  if (!value) return defaultAppPermissions();
  if (typeof value === 'string') {
    if (value === 'all') {
      return {
        manageAllApplications: true,
        manageApplications: [],
        checkApplications: [],
        checkAllApplications: false
      };
    }
    return defaultAppPermissions();
  }
  const perms = defaultAppPermissions();
  if (typeof value === 'object' && value) {
    perms.manageAllApplications = !!(
      value.manageAllApplications ?? value.manageAll ?? value.viewAll
    );
    perms.manageApplications = toStringIdArray(
      value.manageApplications ?? value.manageProfiles ?? value.viewProfiles
    );
    perms.checkApplications = toStringIdArray(value.checkApplications ?? value.checkProfiles);
    perms.checkAllApplications = !!(value.checkAllApplications ?? value.checkAll);
  }
  return perms;
};

const arraysEqual = (a = [], b = []) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

const decorateAccount = account => {
  const normalizedApplications = normalizeAppPermissions(account.permissions?.applications);
  const profilesPermission = account.permissions?.profiles || 'view';
  const currentPermissions = {
    applications: {
      ...normalizedApplications,
      manageApplications: [...normalizedApplications.manageApplications],
      checkApplications: [...normalizedApplications.checkApplications]
    },
    profiles: profilesPermission
  };
  return {
    ...account,
    permissions: currentPermissions,
    __original: clone({
      ...account,
      permissions: currentPermissions
    }),
    __changes: {}
  };
};

const hasChanges = account => Object.keys(account.__changes || {}).length > 0;

const initials = name =>
  name
    ?.split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

export default function Accounts() {
  const { user, loading: authLoading } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rowErrors, setRowErrors] = useState({});
  const [saving, setSaving] = useState({});
  const [profiles, setProfiles] = useState([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [profilesError, setProfilesError] = useState(null);

  const isAdmin = user?.role === 'admin';

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/users');
      if (response.error) throw new Error(response.error);
      const items = (response || []).map(decorateAccount);
      setAccounts(items);
      setRowErrors({});
      setSaving({});
    } catch (err) {
      setError(err.message || 'Failed to load accounts');
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProfiles = useCallback(async () => {
    setProfilesLoading(true);
    setProfilesError(null);
    try {
      const response = await api.get('/profiles');
      if (response.error) throw new Error(response.error);
      setProfiles(response || []);
    } catch (err) {
      setProfiles([]);
      setProfilesError(err.message || 'Failed to load profiles');
    } finally {
      setProfilesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) return;
    fetchAccounts();
    fetchProfiles();
  }, [authLoading, isAdmin, fetchAccounts, fetchProfiles]);

  const setAccountState = updater => {
    setAccounts(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return next.map(acc => ({
        ...acc,
        permissions: (() => {
          const normalizedApplications = normalizeAppPermissions(acc.permissions?.applications);
          return {
            applications: {
              ...normalizedApplications,
              manageApplications: [...normalizedApplications.manageApplications],
              checkApplications: [...normalizedApplications.checkApplications]
            },
            profiles: acc.permissions?.profiles || 'view'
          };
        })()
      }));
    });
  };

  const profileOptions = useMemo(
    () =>
      (profiles || [])
        .map(profile => {
          const value = profile._id || profile.id;
          if (!value) return null;
          const fullName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
          const label = profile.alias || fullName || profile.contact?.email || 'Unnamed profile';
          return { value: value.toString(), label };
        })
        .filter(Boolean)
        .sort((a, b) => a.label.localeCompare(b.label)),
    [profiles]
  );

  const markSaving = (id, value) => {
    setSaving(prev => {
      const next = { ...prev };
      if (value) next[id] = true;
      else delete next[id];
      return next;
    });
  };

  const updateField = (id, field, value) => {
    setAccountState(prev =>
      prev.map(acc => {
        if (acc.id !== id) return acc;
        return {
          ...acc,
          [field]: value,
          __changes: { ...acc.__changes, [field]: true }
        };
      })
    );
  };

  const updateProfilePermission = (id, value) => {
    setAccountState(prev =>
      prev.map(acc => {
        if (acc.id !== id) return acc;
        return {
          ...acc,
          permissions: { ...acc.permissions, profiles: value },
          __changes: { ...acc.__changes, permissions: true }
        };
      })
    );
  };

  const updateApplicationPermissions = (id, updater) => {
    setAccountState(prev =>
      prev.map(acc => {
        if (acc.id !== id) return acc;
        const currentNormalized = normalizeAppPermissions(acc.permissions?.applications);
        const base = {
          ...currentNormalized,
          manageApplications: [...currentNormalized.manageApplications],
          checkApplications: [...currentNormalized.checkApplications]
        };
        const updated = updater(base);
        const normalized = normalizeAppPermissions(updated);
        return {
          ...acc,
          permissions: {
            ...acc.permissions,
            applications: {
              ...normalized,
              manageApplications: [...normalized.manageApplications],
              checkApplications: [...normalized.checkApplications]
            }
          },
          __changes: { ...acc.__changes, permissions: true }
        };
      })
    );
  };

  const toggleApplicationProfile = (id, field, profileId) => {
    updateApplicationPermissions(id, current => {
      const next = new Set(current[field] || []);
      if (next.has(profileId)) next.delete(profileId);
      else next.add(profileId);
      return {
        ...current,
        [field]: Array.from(next)
      };
    });
  };

  const clearApplicationProfiles = (id, field) => {
    updateApplicationPermissions(id, current => ({
      ...current,
      [field]: []
    }));
  };

  const setManageAll = (id, value) => {
    updateApplicationPermissions(id, current => ({
      ...current,
      manageAllApplications: !!value,
      ...(value ? { manageApplications: [] } : {})
    }));
  };

  const setCheckAll = (id, value) => {
    updateApplicationPermissions(id, current => ({
      ...current,
      checkAllApplications: !!value,
      ...(value ? { checkApplications: [] } : {})
    }));
  };

  const renderApplicationSelector = (account, field, disabled) => {
    const selected = new Set(account.permissions?.applications?.[field] || []);
    if (profileOptions.length === 0) {
      return (
        <p className="text-xs text-slate-500">
          {profilesLoading ? 'Loading application options...' : 'No application options available.'}
        </p>
      );
    }
    return (
      <div className="space-y-1">
        <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
          {profileOptions.map(option => {
            const isSelected = selected.has(option.value);
            return (
              <label
                key={option.value}
                className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-slate-600 transition hover:bg-indigo-50/70"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  checked={isSelected}
                  disabled={disabled}
                  onChange={() => toggleApplicationProfile(account.id, field, option.value)}
                />
                <span className="flex-1 truncate">{option.label}</span>
              </label>
            );
          })}
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            {selected.size} selected{disabled ? ' (disabled)' : ''}
          </span>
          <button
            type="button"
            onClick={() => clearApplicationProfiles(account.id, field)}
            disabled={disabled || selected.size === 0}
            className="text-indigo-600 hover:text-indigo-500 disabled:text-slate-300"
          >
            Clear
          </button>
        </div>
      </div>
    );
  };

  const computePatch = account => {
    const original = account.__original || {};
    const changes = {};
    if (account.__changes.name && account.name !== original.name) {
      changes.name = account.name;
    }
    if (account.__changes.email && account.email !== original.email) {
      changes.email = account.email;
    }
    if (account.__changes.companyRole && account.companyRole !== original.companyRole) {
      changes.companyRole = account.companyRole;
    }
    if (account.__changes.avatarUrl && account.avatarUrl !== original.avatarUrl) {
      changes.avatarUrl = account.avatarUrl;
    }
    const currentPermissions = account.permissions || {};
    const originalPermissions = original.permissions || {};
    const currentApps = normalizeAppPermissions(currentPermissions.applications);
    const originalApps = normalizeAppPermissions(originalPermissions.applications);
    const currentManageList = currentApps.manageApplications;
    const originalManageList = originalApps.manageApplications;
    const currentCheckList = currentApps.checkApplications;
    const originalCheckList = originalApps.checkApplications;
    const applicationsChanged =
      currentApps.manageAllApplications !== originalApps.manageAllApplications ||
      currentApps.checkAllApplications !== originalApps.checkAllApplications ||
      !arraysEqual(currentManageList, originalManageList) ||
      !arraysEqual(currentCheckList, originalCheckList);
    const profilePermissionChanged =
      currentPermissions.profiles !== originalPermissions.profiles;
    if (account.__changes.permissions && (applicationsChanged || profilePermissionChanged)) {
      changes.permissions = {
        ...(applicationsChanged
          ? {
              applications: {
                ...currentApps,
                manageAllApplications: currentApps.manageAllApplications,
                checkAllApplications: currentApps.checkAllApplications,
                manageApplications: [...currentManageList],
                checkApplications: [...currentCheckList]
              }
            }
          : {}),
        ...(profilePermissionChanged ? { profiles: currentPermissions.profiles } : {})
      };
    }
    return changes;
  };

  const handleSave = async id => {
    const account = accounts.find(acc => acc.id === id);
    if (!account) return;
    const patch = computePatch(account);
    if (!Object.keys(patch).length) return;

    markSaving(id, true);
    setRowErrors(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    try {
      const response = await api.patch(`/users/${id}`, patch);
      if (response.error) throw new Error(response.error);
      setAccountState(prev =>
        prev.map(acc => {
          if (acc.id !== id) return acc;
          return decorateAccount(response);
        })
      );
    } catch (err) {
      setRowErrors(prev => ({ ...prev, [id]: err.message || 'Failed to save changes' }));
    } finally {
      markSaving(id, false);
    }
  };

  const handleReset = id => {
    const account = accounts.find(acc => acc.id === id);
    if (!account) return;
    setAccountState(prev =>
      prev.map(acc => {
        if (acc.id !== id) return acc;
        return decorateAccount(acc.__original);
      })
    );
    setRowErrors(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const columns = useMemo(
    () => [
      'Person',
      'Email',
      'Company Role',
      'Application Access',
      'Check Access',
      'Profile Access',
      'Last Updated',
      'Actions'
    ],
    []
  );

  if (!authLoading && user && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Accounts</h2>
          <p className="text-sm text-slate-500">
            Manage member roles, profile access, and application visibility settings.
          </p>
        </div>
      </header>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}
      {profilesError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {profilesError}
        </div>
      )}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm text-slate-700">
          <thead className="bg-slate-50">
            <tr>
              {columns.map(col => (
                <th
                  key={col}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-center text-sm text-slate-500">
                  Loading accounts...
                </td>
              </tr>
            ) : accounts.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-center text-sm text-slate-500">
                  No accounts available.
                </td>
              </tr>
            ) : (
              accounts.map(account => {
                const isSaving = !!saving[account.id];
                const dirty = hasChanges(account);
                return (
                  <tr key={account.id} className={isSaving ? 'bg-slate-50' : undefined}>
                    <td className="px-4 py-4">
                      <div className="flex items-start gap-3">
                        {account.avatarUrl ? (
                          <img
                            src={account.avatarUrl}
                            alt={account.name}
                            className="h-12 w-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-base font-semibold text-indigo-600">
                            {initials(account.name)}
                          </div>
                        )}
                        <div className="min-w-0 space-y-2">
                          <input
                            className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm font-semibold text-slate-800 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            value={account.name || ''}
                            onChange={e => updateField(account.id, 'name', e.target.value)}
                            placeholder="Full name"
                          />
                          <input
                            className="w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-500 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            value={account.avatarUrl || ''}
                            onChange={e => updateField(account.id, 'avatarUrl', e.target.value)}
                            placeholder="Avatar image URL"
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <input
                        className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        value={account.email || ''}
                        onChange={e => updateField(account.id, 'email', e.target.value)}
                        placeholder="Email address"
                      />
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <input
                        className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        value={account.companyRole || ''}
                        onChange={e => updateField(account.id, 'companyRole', e.target.value)}
                        placeholder="Role in company"
                      />
                      <p className="mt-2 text-xs uppercase tracking-wide text-slate-400">
                        System role: {account.role}
                      </p>
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-slate-600">
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            checked={account.permissions.applications.manageAllApplications}
                            disabled={isSaving || profilesLoading}
                            onChange={event => setManageAll(account.id, event.target.checked)}
                          />
                          <span>Manage all applications</span>
                        </label>
                        {account.permissions.applications.manageAllApplications ? (
                          <p className="text-xs text-slate-500">
                            Has access to every application. Uncheck to choose specific applications.
                          </p>
                        ) : (
                          renderApplicationSelector(
                            account,
                            'manageApplications',
                            isSaving || profilesLoading
                          )
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-slate-600">
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            checked={account.permissions.applications.checkAllApplications}
                            disabled={isSaving || profilesLoading}
                            onChange={event => setCheckAll(account.id, event.target.checked)}
                          />
                          <span>Check all applications</span>
                        </label>
                        {account.permissions.applications.checkAllApplications ? (
                          <p className="text-xs text-slate-500">
                            Has check access to every application. Uncheck to choose specific applications.
                          </p>
                        ) : (
                          renderApplicationSelector(
                            account,
                            'checkApplications',
                            isSaving || profilesLoading
                          )
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <select
                        className="w-full rounded-md border border-slate-200 px-2 py-2 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        value={account.permissions.profiles}
                        onChange={e => updateProfilePermission(account.id, e.target.value)}
                      >
                        {PROFILE_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-4 align-middle text-sm text-slate-500">
                      {account.updatedAt ? new Date(account.updatedAt).toLocaleString() : '--'}
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => handleSave(account.id)}
                          disabled={!dirty || isSaving}
                          className="rounded-lg bg-indigo-600 px-3 py-1 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:bg-slate-300 hover:bg-indigo-500"
                        >
                          {isSaving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReset(account.id)}
                          disabled={isSaving || !dirty}
                          className="rounded-lg border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600 transition disabled:cursor-not-allowed disabled:text-slate-300 hover:border-indigo-200 hover:text-indigo-600"
                        >
                          Reset
                        </button>
                        {rowErrors[account.id] && (
                          <p className="text-xs text-red-600">{rowErrors[account.id]}</p>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
