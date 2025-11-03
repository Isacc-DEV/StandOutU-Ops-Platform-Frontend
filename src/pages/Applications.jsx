import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../hooks/useAuth.js';

const EDITABLE_KEYS = ['company', 'roleTitle', 'jobUrl', 'status', 'notes', 'profileId', 'bidderId', 'resumeId'];
const RELATION_KEYS = new Set(['profileId', 'bidderId', 'resumeId']);

const normalizeRow = doc => ({
  _id: doc._id,
  localId: doc._id,
  company: doc.company ?? '',
  roleTitle: doc.roleTitle ?? '',
  jobUrl: doc.jobUrl ?? '',
  status: doc.status ?? 'applied',
  notes: doc.notes ?? '',
  resumeId:
    typeof doc.resumeId === 'object' && doc.resumeId !== null ? doc.resumeId._id : doc.resumeId ?? '',
  resume:
    typeof doc.resumeId === 'object' && doc.resumeId !== null
      ? { _id: doc.resumeId._id, title: doc.resumeId.title }
      : null,
  checkStatus: doc.checkStatus ?? 'pending',
  checkedBy:
    typeof doc.checkedBy === 'object' && doc.checkedBy !== null
      ? { _id: doc.checkedBy._id, name: doc.checkedBy.name }
      : null,
  checkedAt: doc.checkedAt,
  profileId:
    typeof doc.profileId === 'object' && doc.profileId !== null ? doc.profileId._id : doc.profileId ?? '',
  profile:
    typeof doc.profileId === 'object' && doc.profileId !== null
      ? { _id: doc.profileId._id, alias: doc.profileId.alias, personName: doc.profileId.personName }
      : null,
  bidderId:
    typeof doc.bidderId === 'object' && doc.bidderId !== null ? doc.bidderId._id : doc.bidderId ?? '',
  bidder:
    typeof doc.bidderId === 'object' && doc.bidderId !== null
      ? { _id: doc.bidderId._id, name: doc.bidderId.name }
      : null,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
  appliedAt: doc.appliedAt || doc.createdAt,
  isNew: false,
  __changes: {}
});

const buildPayload = (row, keys) => {
  const payload = {};
  keys.forEach(key => {
    if (!Object.prototype.hasOwnProperty.call(row, key)) return;
    if (RELATION_KEYS.has(key)) {
      payload[key] = row[key] || null;
    } else {
      payload[key] = row[key];
    }
  });
  return payload;
};

const formatDate = value => {
  if (!value) return '';
  const date = typeof value === 'string' || value instanceof Date ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
};

const defaultAppPermissions = () => ({
  manageAll: false,
  manageProfiles: [],
  checkProfiles: []
});

const toStringIdArray = value => {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map(item => {
          if (!item) return null;
          if (typeof item === 'string') return item.trim();
          if (item._id || item.id) return (item._id || item.id).toString();
          if (typeof item.toString === 'function') {
            const next = item.toString();
            return next && next !== '[object Object]' ? next : null;
          }
          return null;
        })
        .filter(Boolean)
    )
  );
};

const normalizeAppPermissions = value => {
  if (!value) return defaultAppPermissions();
  if (typeof value === 'string') {
    if (value === 'all') {
      return { manageAll: true, manageProfiles: [], checkProfiles: [] };
    }
    return defaultAppPermissions();
  }
  if (typeof value === 'object') {
    return {
      manageAll: !!(value.manageAll ?? value.viewAll),
      manageProfiles: toStringIdArray(value.manageProfiles ?? value.viewProfiles),
      checkProfiles: toStringIdArray(value.checkProfiles)
    };
  }
  return defaultAppPermissions();
};

const formatCheckStatusLabel = status =>
  (status || '')
    .toString()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());

export default function Applications() {
  const { user, loading: authLoading } = useAuth();
  const userAppPermissions = normalizeAppPermissions(user?.permissions?.applications);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(() => ({
    pipeline: [],
    checkStatuses: [],
    profiles: [],
    bidders: [],
    resumesByProfile: {},
    access: userAppPermissions,
    capabilities: {}
  }));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingRowId, setEditingRowId] = useState(null);
  const [activeEditor, setActiveEditor] = useState(null); // { rowId, key }
  const [savingRows, setSavingRows] = useState({});

  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const appPermissions = meta.access || userAppPermissions;
  const capabilities = meta.capabilities || {};
  const manageProfiles = appPermissions.manageProfiles || [];
  const checkProfiles = appPermissions.checkProfiles || [];
  const hasManageProfiles = manageProfiles.length > 0;
  const hasCheckProfiles = checkProfiles.length > 0;
  const isAdmin = user?.role === 'admin';
  const canManageApplications =
    isAdmin ||
    appPermissions.manageAll ||
    appPermissions.checkAll ||
    hasManageProfiles ||
    hasCheckProfiles;
  const canAddApplications = canManageApplications;
  const canEditApplications = canManageApplications;
  const canCheckApplications = canManageApplications;
  const canAssignOtherBidders =
    capabilities.canAssignOtherBidders ??
    (isAdmin || appPermissions.manageAll || appPermissions.checkAll);
  const canViewApplications =
    isAdmin ||
    appPermissions.manageAll ||
    appPermissions.checkAll ||
    hasManageProfiles ||
    hasCheckProfiles;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/applications');
      if (response.error) throw new Error(response.error);
      const items = (response.items || []).map(normalizeRow);
      rowsRef.current = items;
      setRows(items);
      const accessFromServer = response.meta?.access ?? appPermissions;
      setMeta({
        pipeline: response.meta?.pipeline || [],
        checkStatuses: response.meta?.checkStatuses || [],
        profiles: response.meta?.profiles || [],
        bidders: response.meta?.bidders || [],
        resumesByProfile: response.meta?.resumesByProfile || {},
        access: normalizeAppPermissions(accessFromServer),
        capabilities: response.meta?.capabilities || {}
      });
    } catch (err) {
      setError(err.message || 'Failed to load applications');
      setMeta(prev => ({ ...prev, access: appPermissions }));
      rowsRef.current = [];
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [appPermissions]);

  useEffect(() => {
    if (authLoading || !user) return;
    fetchData();
  }, [authLoading, user, fetchData]);

  const setRowState = useCallback(updater => {
    setRows(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      rowsRef.current = next;
      return next;
    });
  }, []);

  const makeEmptyRow = useCallback(() => {
    const defaultStatus = meta.pipeline?.[0] || 'applied';
    const selectedBidder =
      meta.bidders.find(b => b._id === user?.id) ||
      (!canAssignOtherBidders && user ? { _id: user.id, name: user.name } : null);
    return {
      _id: null,
      localId: `temp-${Date.now()}`,
      company: '',
      roleTitle: '',
      jobUrl: '',
      status: defaultStatus,
      notes: '',
      resumeId: '',
      resume: null,
      checkStatus: 'pending',
      checkedBy: null,
      checkedAt: null,
      profileId: '',
      profile: null,
      bidderId: selectedBidder?._id || '',
      bidder: selectedBidder || null,
      createdAt: null,
      updatedAt: null,
      appliedAt: null,
      isNew: true,
      __changes: {}
    };
  }, [meta.pipeline, meta.bidders, user, canAssignOtherBidders]);

  const placeholderRow = useMemo(
    () => ({
      localId: '__placeholder__',
      isPlaceholder: true
    }),
    []
  );

  const rowsWithPlaceholder = useMemo(
    () => (canAddApplications ? [...rows, placeholderRow] : rows),
    [rows, placeholderRow, canAddApplications]
  );

  const columns = useMemo(
    () => [
      { key: 'company', label: 'Company', type: 'text', required: true },
      { key: 'roleTitle', label: 'Position', type: 'text', required: true },
      { key: 'jobUrl', label: 'Job URL', type: 'text' },
      { key: 'profileId', label: 'Profile', type: 'select', optionsKey: 'profiles', required: true },
      { key: 'bidderId', label: 'Bidder', type: 'select', optionsKey: 'bidders' },
      { key: 'status', label: 'Status', type: 'select', optionsKey: 'pipeline' },
      { key: 'resumeId', label: 'Resume', type: 'select', optionsKey: 'resumes' },
      { key: 'checkStatus', label: 'Check Status', type: 'checkStatus' },
      { key: 'checkedBy', label: 'Checked By', type: 'static' },
      { key: 'checkedAt', label: 'Checked At', type: 'static' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
      { key: 'appliedAt', label: 'Applied', type: 'static' },
      { key: '_actions', label: '', type: 'actions' }
    ],
    []
  );

  const optionsByKey = useMemo(() => {
    const pipelineOptions = (meta.pipeline || []).map(value => ({ value, label: value }));
    const profileOptions = (meta.profiles || []).map(p => ({
      value: p._id,
      label: p.alias || p.personName || 'Unnamed'
    }));
    const bidderOptions = (meta.bidders || []).map(b => ({ value: b._id, label: b.name || 'Unknown' }));
    const checkStatusOptions = (meta.checkStatuses || []).map(value => ({
      value,
      label: value
        .replace(/_/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase())
    }));
    return {
      pipeline: pipelineOptions,
      profiles: profileOptions,
      bidders: bidderOptions,
      checkStatuses: checkStatusOptions,
      resumes: meta.resumesByProfile || {}
    };
  }, [meta]);

  const resumeLookup = useMemo(() => {
    const map = new Map();
    Object.values(meta.resumesByProfile || {}).forEach(list => {
      (list || []).forEach(resume => {
        if (!resume) return;
        const id = resume._id || resume.id;
        if (id) map.set(id, resume);
      });
    });
    return map;
  }, [meta.resumesByProfile]);

  const setRowSaving = useCallback((rowId, value) => {
    setSavingRows(prev => {
      const next = { ...prev };
      if (value) next[rowId] = true;
      else delete next[rowId];
      return next;
    });
  }, []);

  const handleFieldChange = useCallback(
    (rowId, key, value) => {
      setError(null);
      setRowState(prev =>
        prev.map(row => {
          if (row.localId !== rowId) return row;
          const next = {
            ...row,
            [key]: value,
            __changes: { ...(row.__changes || {}), [key]: true }
          };
          if (key === 'profileId') {
            next.profile = meta.profiles.find(p => p._id === value) || null;
            next.resumeId = '';
            next.resume = null;
            next.__changes.resumeId = true;
          }
          if (key === 'bidderId') {
            next.bidder = meta.bidders.find(b => b._id === value) || null;
          }
          if (key === 'resumeId') {
            next.resume = resumeLookup.get(value) || null;
          }
          return next;
        })
      );
    },
    [meta.profiles, meta.bidders, resumeLookup, setRowState]
  );

  const handleCheckStatusChange = useCallback(
    async (row, value) => {
      if (!row._id || !canCheckApplications || value === row.checkStatus) return;
      setRowSaving(row.localId, true);
      try {
        const updated = await api.patch(`/applications/${row._id}`, { checkStatus: value });
        if (updated.error) throw new Error(updated.error);
        const normalized = normalizeRow(updated);
        setRowState(prev => prev.map(r => (r.localId === row.localId ? normalized : r)));
      } catch (err) {
        setError(err.message || 'Failed to update check status');
        await fetchData();
      } finally {
        setRowSaving(row.localId, false);
      }
    },
    [canCheckApplications, fetchData, setRowSaving, setRowState]
  );

  const persistRow = useCallback(
    async rowId => {
      const current = rowsRef.current.find(r => r.localId === rowId);
      if (!current || current.isPlaceholder) return;

      if (current.isNew) {
        if (!canAddApplications) return;
        const hasRequired =
          current.company.trim() && current.roleTitle.trim() && current.profileId;
        if (!hasRequired) return;

        setRowSaving(rowId, true);
        try {
          const payload = buildPayload(current, EDITABLE_KEYS);
          const created = await api.post('/applications', payload);
          if (created.error) throw new Error(created.error);
          const normalized = normalizeRow(created);
          setRowState(prev =>
            prev.map(row => (row.localId === rowId ? normalized : row))
          );
          setEditingRowId(null);
          setActiveEditor(null);
        } catch (err) {
          setError(err.message || 'Failed to create application');
          await fetchData();
        } finally {
          setRowSaving(rowId, false);
        }
      } else {
        const changedKeys = Object.keys(current.__changes || {}).filter(
          key => key !== 'checkStatus'
        );
        if (!changedKeys.length) return;
        if (!canEditApplications) return;

        setRowSaving(rowId, true);
        try {
          const payload = buildPayload(current, changedKeys);
          const updated = await api.patch(`/applications/${current._id}`, payload);
          if (updated.error) throw new Error(updated.error);
          const normalized = normalizeRow(updated);
          setRowState(prev =>
            prev.map(row => (row.localId === rowId ? normalized : row))
          );
        } catch (err) {
          setError(err.message || 'Failed to update application');
          await fetchData();
        } finally {
          setRowSaving(rowId, false);
        }
      }
    },
    [canAddApplications, canEditApplications, fetchData, setRowSaving, setRowState]
  );

  const startEditing = useCallback(
    (row, key) => {
      if (row.isPlaceholder) {
        if (!canAddApplications) return;
        const newRow = makeEmptyRow();
        setRowState(prev => [...prev, newRow]);
        setEditingRowId(newRow.localId);
        setActiveEditor({ rowId: newRow.localId, key });
        return;
      }
      if (savingRows[row.localId]) return;
      if (row.isNew) {
        if (!canAddApplications) return;
        if (editingRowId !== row.localId) {
          setEditingRowId(row.localId);
        }
        setActiveEditor({ rowId: row.localId, key });
        return;
      }
      if (!canEditApplications) return;
      if (editingRowId !== row.localId) return;
      if (key === 'bidderId' && !canAssignOtherBidders) return;
      setActiveEditor({ rowId: row.localId, key });
    },
    [
      canAddApplications,
      canEditApplications,
      canAssignOtherBidders,
      makeEmptyRow,
      savingRows,
      editingRowId,
      setRowState
    ]
  );

  const stopEditing = useCallback(() => {
    setActiveEditor(null);
  }, []);

  const removeTemporaryRow = useCallback(
    rowId => {
      setRowState(prev => prev.filter(row => row.localId !== rowId));
      if (editingRowId === rowId) {
        setEditingRowId(null);
      }
      if (activeEditor?.rowId === rowId) {
        setActiveEditor(null);
      }
    },
    [activeEditor, editingRowId, setRowState]
  );

  const exitEditMode = useCallback(
    rowId => {
      if (activeEditor?.rowId === rowId) {
        setActiveEditor(null);
      }
      if (editingRowId === rowId) {
        setEditingRowId(null);
      }
    },
    [activeEditor, editingRowId]
  );

  const beginEditMode = useCallback(
    rowId => {
      if (!canEditApplications) return;
      setEditingRowId(rowId);
      setActiveEditor(null);
    },
    [canEditApplications]
  );

  const renderDisplayValue = useCallback((row, column) => {
    switch (column.key) {
      case 'profileId':
        return row.profile?.alias || '';
      case 'bidderId':
        return row.bidder?.name || '';
      case 'status':
        return row.status || '';
      case 'resumeId':
        return row.resume?.title || 'No resume';
      case 'checkStatus':
        return formatCheckStatusLabel(row.checkStatus);
      case 'checkedBy':
        return row.checkedBy?.name || '';
      case 'checkedAt':
        return formatDate(row.checkedAt);
      case 'notes':
        return row.notes || '';
      case 'jobUrl':
        return row.jobUrl ? (
          <a
            href={row.jobUrl}
            className="text-indigo-600 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            {row.jobUrl}
          </a>
        ) : (
          ''
        );
      case 'appliedAt':
        return formatDate(row.appliedAt);
      default:
        return row[column.key] || '';
    }
  }, []);

  const renderEditor = (row, column) => {
    const value =
      column.key === 'profileId'
        ? row.profileId || ''
        : column.key === 'bidderId'
        ? row.bidderId || ''
        : row[column.key] ?? '';
    const disableBidderField = column.key === 'bidderId' && !canAssignOtherBidders;
    const disabledBase = savingRows[row.localId] || disableBidderField;
    const commonProps = {
      autoFocus: true,
      className:
        'w-full rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200',
      value,
      disabled: disabledBase,
      onBlur: async () => {
        stopEditing();
        await persistRow(row.localId);
      },
      onKeyDown: async e => {
        if (e.key === 'Enter' && column.type !== 'textarea') {
          e.preventDefault();
          e.currentTarget.blur();
        }
      },
      onChange: e => handleFieldChange(row.localId, column.key, e.target.value)
    };

    if (column.type === 'textarea') {
      return (
        <textarea
          {...commonProps}
          rows={2}
        />
      );
    }

    if (column.type === 'select') {
      if (column.key === 'resumeId') {
        const resumeOptions = row.profileId
          ? (meta.resumesByProfile?.[row.profileId] || [])
          : [];
        const resumeDisabled = disabledBase || !row.profileId;
        return (
          <select
            {...commonProps}
            disabled={resumeDisabled}
          >
            <option value="">No resume</option>
            {resumeOptions.map(opt => (
              <option key={opt._id} value={opt._id}>
                {opt.title || 'Untitled resume'}
              </option>
            ))}
          </select>
        );
      }

      const options = optionsByKey[column.optionsKey] || [];
      const isDisabled =
        (column.key === 'profileId' && options.length === 0) ||
        (column.key === 'bidderId' && options.length === 0) ||
        disabledBase;
      return (
        <select
          {...commonProps}
          disabled={isDisabled}
        >
          <option value="">{column.required ? 'Select...' : 'Unassigned'}</option>
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }

    if (column.type === 'static') {
      return <span>{renderDisplayValue(row, column)}</span>;
    }

    return <input type="text" {...commonProps} />;
  };

  const renderCheckStatusCell = row => {
    const options = optionsByKey.checkStatuses || [];
    const disabled =
      !canCheckApplications || !row._id || savingRows[row.localId] || options.length === 0;
    if (disabled) {
      return <span>{formatCheckStatusLabel(row.checkStatus)}</span>;
    }
    return (
      <select
        className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        value={row.checkStatus || ''}
        onChange={e => handleCheckStatusChange(row, e.target.value)}
        disabled={savingRows[row.localId]}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  };

  const renderActionsCell = (row, isSaving) => {
    if (row.isPlaceholder) {
      return null;
    }
    if (row.isNew) {
      const hasRequired =
        (row.company || '').trim() && (row.roleTitle || '').trim() && row.profileId;
      return (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => persistRow(row.localId)}
            disabled={isSaving || !hasRequired}
            className="rounded-lg bg-indigo-600 px-3 py-1 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:bg-slate-300 hover:bg-indigo-500"
          >
            {isSaving ? 'Saving...' : 'Create'}
          </button>
          <button
            type="button"
            onClick={() => removeTemporaryRow(row.localId)}
            disabled={isSaving}
            className="rounded-lg border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600 transition disabled:cursor-not-allowed disabled:text-slate-300 hover:border-indigo-200 hover:text-indigo-600"
          >
            Cancel
          </button>
        </div>
      );
    }

    const inEditMode = editingRowId === row.localId;
    if (!canEditApplications) {
      return <span className="text-xs text-slate-400">View only</span>;
    }

    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => (inEditMode ? exitEditMode(row.localId) : beginEditMode(row.localId))}
          disabled={isSaving}
          className={`rounded-lg px-3 py-1 text-sm font-semibold shadow-sm transition ${
            inEditMode
              ? 'bg-emerald-600 text-white hover:bg-emerald-500 disabled:bg-slate-300'
              : 'bg-indigo-600 text-white hover:bg-indigo-500 disabled:bg-slate-300'
          }`}
        >
          {inEditMode ? 'Done' : 'Edit'}
        </button>
      </div>
    );
  };
  const headerSection = (
    <header className="flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Applications</h2>
        <p className="text-sm text-slate-500">
          Manage job submissions, assignments, and pipeline progress.
        </p>
      </div>
    </header>
  );

  if (authLoading) {
    return (
      <div className="space-y-4">
        {headerSection}
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
          Loading applications...
        </div>
      </div>
    );
  }

  if (!canViewApplications) {
    return (
      <div className="space-y-4">
        {headerSection}
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-700">
          You do not have permission to view applications. Ask an administrator for access.
        </div>
      </div>
    );
  }

  if (loading && !rows.length) {
    return (
      <div className="space-y-4">
        {headerSection}
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
          Loading applications...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {headerSection}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm text-slate-700">
          <thead className="bg-slate-50">
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rowsWithPlaceholder.map(row => {
              if (row.isPlaceholder) {
                return (
                  <tr key={row.localId} className="hover:bg-indigo-50/50">
                    <td
                      className="px-4 py-3 text-sm text-indigo-500"
                      colSpan={columns.length}
                    >
                      <button
                        type="button"
                        className="w-full text-left font-medium text-indigo-600 hover:text-indigo-500"
                        onClick={() => startEditing(row, columns[0].key)}
                      >
                        + Add new application
                      </button>
                    </td>
                  </tr>
                );
              }

              const isSaving = !!savingRows[row.localId];
              const inEditMode = row.isNew ? true : editingRowId === row.localId;
              return (
                <tr key={row.localId} className={isSaving ? 'bg-slate-50' : undefined}>
                  {columns.map(column => {
                    if (column.key === '_actions') {
                      return (
                        <td key={column.key} className="px-4 py-3 align-top">
                          {renderActionsCell(row, isSaving)}
                        </td>
                      );
                    }
                    if (column.type === 'checkStatus') {
                      return (
                        <td key={column.key} className="px-4 py-3 align-top">
                          {renderCheckStatusCell(row)}
                        </td>
                      );
                    }
                    const isEditingCell =
                      activeEditor?.rowId === row.localId &&
                      activeEditor?.key === column.key &&
                      column.type !== 'static';
                    const fieldEditable =
                      column.type !== 'static' &&
                      column.type !== 'checkStatus' &&
                      column.type !== 'actions' &&
                      (row.isNew ? canAddApplications : inEditMode && canEditApplications) &&
                      !(column.key === 'bidderId' && !canAssignOtherBidders);

                    return (
                      <td key={column.key} className="px-4 py-3 align-top">
                        {isEditingCell ? (
                          renderEditor(row, column)
                        ) : fieldEditable ? (
                          <button
                            type="button"
                            className="w-full text-left text-slate-700 transition hover:text-indigo-600 disabled:cursor-not-allowed disabled:text-slate-400"
                            onClick={() => startEditing(row, column.key)}
                            disabled={isSaving || (!row.isNew && !inEditMode)}
                          >
                            {renderDisplayValue(row, column) || (
                              <span className="text-slate-400">
                                {column.type === 'select' ? 'Select...' : 'Click to edit'}
                              </span>
                            )}
                          </button>
                        ) : (
                          <span>{renderDisplayValue(row, column)}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
