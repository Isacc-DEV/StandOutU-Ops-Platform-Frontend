import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../hooks/useAuth.js';

const EDITABLE_KEYS = ['company', 'roleTitle', 'jobUrl', 'bidderNote', 'profileId', 'bidderId', 'resumeId'];
const RELATION_KEYS = new Set(['profileId', 'bidderId', 'resumeId']);

const normalizeRow = doc => ({
  _id: doc._id,
  localId: doc._id,
  company: doc.company ?? '',
  roleTitle: doc.roleTitle ?? '',
  jobUrl: doc.jobUrl ?? '',
  bidderNote: doc.bidderNote ?? '',
  checkNote: doc.checkNote ?? '',
  checkResult: doc.checkResult ?? 'pending',
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
  manageAllApplications: false,
  manageApplications: [],
  checkApplications: [],
  checkAllApplications: false
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
      return {
        manageAllApplications: true,
        manageApplications: [],
        checkApplications: [],
        checkAllApplications: false
      };
    }
    return defaultAppPermissions();
  }
  if (typeof value === 'object') {
    return {
      manageAllApplications: !!(
        value.manageAllApplications ?? value.manageAll ?? value.viewAll
      ),
      manageApplications: toStringIdArray(
        value.manageApplications ?? value.manageProfiles ?? value.viewProfiles
      ),
      checkApplications: toStringIdArray(value.checkApplications ?? value.checkProfiles),
      checkAllApplications: !!(value.checkAllApplications ?? value.checkAll)
    };
  }
  return defaultAppPermissions();
};

const areArraysEqual = (a, b) => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

const isSameAppPermissions = (a, b) => {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.manageAllApplications !== b.manageAllApplications) return false;
  if (!areArraysEqual(a.manageApplications, b.manageApplications)) return false;
  if (!areArraysEqual(a.checkApplications, b.checkApplications)) return false;
  if (a.checkAllApplications !== b.checkAllApplications) return false;
  return true;
};

const formatCheckStatusLabel = status =>
  (status || '')
    .toString()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());

const formatCheckResultLabel = result => {
  if (!result) return '';
  if (result === 'ok') return 'OK';
  return result
    .toString()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
};

export default function Applications() {
  const { user, loading: authLoading } = useAuth();
  const userApplicationsPermissionSource = user?.permissions?.applications;
  const userAppPermissions = useMemo(
    () => normalizeAppPermissions(userApplicationsPermissionSource),
    [userApplicationsPermissionSource]
  );
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(() => ({
    checkStatuses: [],
    checkResults: [],
    profiles: [],
    bidders: [],
    resumesByProfile: {},
    access: userAppPermissions,
    capabilities: {}
  }));
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState(null);
  const [editingRowId, setEditingRowId] = useState(null);
  const [activeEditor, setActiveEditor] = useState(null); // { rowId, key }
  const [savingRows, setSavingRows] = useState({});

  const rowsRef = useRef(rows);
  const editSnapshotsRef = useRef(new Map());
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const appPermissions = useMemo(
    () => normalizeAppPermissions(meta.access || userAppPermissions),
    [meta.access, userAppPermissions]
  );
  const capabilities = meta.capabilities || {};
  const manageApplications = appPermissions.manageApplications;
  const checkApplications = appPermissions.checkApplications;
  const hasManageApplications = manageApplications.length > 0;
  const hasCheckApplications = checkApplications.length > 0;
  const isAdmin = user?.role === 'admin';
  const canManageApplications =
    isAdmin ||
    appPermissions.manageAllApplications ||
    appPermissions.checkAllApplications ||
    hasManageApplications ||
    hasCheckApplications;
  const canAddApplications = canManageApplications;
  const canEditApplications = canManageApplications;
  const canCheckApplications = appPermissions.checkAllApplications || hasCheckApplications;
  const canAssignOtherBidders =
    capabilities.canAssignOtherBidders ??
    (isAdmin || appPermissions.manageAllApplications || appPermissions.checkAllApplications);
  const canViewApplications =
    isAdmin ||
    appPermissions.manageAllApplications ||
    appPermissions.checkAllApplications ||
    hasManageApplications ||
    hasCheckApplications;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/applications');
      if (response.error) throw new Error(response.error);
      const freshRows = (response.items || []).map(normalizeRow);
      const currentRows = Array.isArray(rowsRef.current) ? rowsRef.current : [];

      const tempRows = currentRows.filter(row => row.isNew);
      const editedRowsById = new Map(
        currentRows
          .filter(
            row =>
              !row.isNew &&
              row._id &&
              row.__changes &&
              Object.keys(row.__changes).length > 0
          )
          .map(row => [row._id, row])
      );

      const mergedRows = freshRows.map(rowFromServer => {
        const edited = editedRowsById.get(rowFromServer._id);
        if (!edited) return rowFromServer;

        const changedKeys = Object.keys(edited.__changes || {});
        if (!changedKeys.length) return rowFromServer;

        const nextRow = { ...rowFromServer };
        changedKeys.forEach(key => {
          nextRow[key] = edited[key];
          if (key === 'profileId') {
            nextRow.profile = edited.profile;
            nextRow.resumeId = edited.resumeId;
            nextRow.resume = edited.resume;
          }
          if (key === 'bidderId') {
            nextRow.bidder = edited.bidder;
          }
          if (key === 'resumeId') {
            nextRow.resume = edited.resume;
          }
        });
        nextRow.__changes = edited.__changes;
        return nextRow;
      });

      const nextRows = [...mergedRows, ...tempRows];
      rowsRef.current = nextRows;
      setRows(nextRows);
      const accessFromServer = response.meta?.access ?? appPermissions;
      setMeta(prev => {
        const normalizedAccess = normalizeAppPermissions(accessFromServer);
        const access = isSameAppPermissions(prev.access, normalizedAccess)
          ? prev.access
          : normalizedAccess;
        const capabilitiesFromServer = response.meta?.capabilities || {};
        const sameCapabilities =
          prev.capabilities &&
          Object.keys(prev.capabilities).length === Object.keys(capabilitiesFromServer).length &&
          Object.entries(capabilitiesFromServer).every(
            ([key, value]) => prev.capabilities[key] === value
          );
        return {
          checkStatuses: response.meta?.checkStatuses || [],
          checkResults: response.meta?.checkResults || [],
          profiles: response.meta?.profiles || [],
          bidders: response.meta?.bidders || [],
          resumesByProfile: response.meta?.resumesByProfile || {},
          access,
          capabilities: sameCapabilities ? prev.capabilities : capabilitiesFromServer
        };
      });
    } catch (err) {
      setError(err.message || 'Failed to load applications');
      setMeta(prev => ({ ...prev, access: appPermissions }));
      rowsRef.current = [];
      setRows([]);
    } finally {
      setLoading(false);
      setHasLoadedOnce(true);
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
    const selectedBidder =
      meta.bidders.find(b => b._id === user?.id) ||
      (user ? { _id: user.id, name: user.name } : null);
    return {
      _id: null,
      localId: `temp-${Date.now()}`,
      company: '',
      roleTitle: '',
      jobUrl: '',
      bidderNote: '',
      checkNote: '',
      checkResult: 'pending',
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
  }, [meta.bidders, user, canAssignOtherBidders]);

  const placeholderRow = useMemo(
    () => ({
      localId: '__placeholder__',
      isPlaceholder: true
    }),
    []
  );

  const rowsWithPlaceholder = useMemo(
    () =>
      ((hasLoadedOnce || !loading) && canAddApplications
        ? [...rows, placeholderRow]
        : rows),
    [rows, placeholderRow, canAddApplications, loading, hasLoadedOnce]
  );

  const columns = useMemo(
    () => [
      { key: 'company', label: 'Company', type: 'text', required: true },
      { key: 'roleTitle', label: 'Position', type: 'text', required: true },
      { key: 'jobUrl', label: 'Job URL', type: 'text' },
      {
        key: 'profileId',
        label: 'Profile',
        type: 'select',
        optionsKey: 'profiles',
        required: true
      },
      { key: 'resumeId', label: 'Resume', type: 'select', optionsKey: 'resumes' },
      { key: 'bidderId', label: 'Bidder', type: 'select', optionsKey: 'bidders' },
      { key: 'appliedAt', label: 'Applied At', type: 'static' },
      { key: 'bidderNote', label: 'Bidder Note', type: 'textarea' },
      { key: 'checkStatus', label: 'Check Status', type: 'checkStatus' },
      { key: 'checkResult', label: 'Check Result', type: 'checkResult' },
      { key: 'checkedBy', label: 'Checked By', type: 'static' },
      { key: 'checkedAt', label: 'Checked At', type: 'static' },
      { key: 'checkNote', label: 'Check Note', type: 'checkNote' },
      { key: '_actions', label: 'Actions', type: 'actions' }
    ],
    []
  );

  const optionsByKey = useMemo(() => {
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
    const checkResultValues =
      (Array.isArray(meta.checkResults) && meta.checkResults.length
        ? meta.checkResults
        : ['pending', 'ok', 'bad', 'not_perfect']) || [];
    const checkResultOptions = checkResultValues.map(value => ({
      value,
      label: formatCheckResultLabel(value)
    }));
    return {
      profiles: profileOptions,
      bidders: bidderOptions,
      checkStatuses: checkStatusOptions,
      checkResults: checkResultOptions,
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

  const startCheck = useCallback(
    async row => {
      if (!row || !row._id || row.checkStatus !== 'pending') return;
      if (!canCheckApplications) return;
      setError(null);
      setRowSaving(row.localId, true);
      try {
        const updated = await api.patch(`/applications/${row._id}`, { checkStatus: 'in_review' });
        if (updated.error) throw new Error(updated.error);
        const normalized = normalizeRow(updated);
        setRowState(prev => prev.map(r => (r.localId === row.localId ? normalized : r)));
      } catch (err) {
        setError(err.message || 'Failed to start review');
        await fetchData();
      } finally {
        setRowSaving(row.localId, false);
      }
    },
    [canCheckApplications, fetchData, setRowSaving, setRowState]
  );

  const completeCheck = useCallback(
    async rowId => {
      const current = rowsRef.current.find(r => r.localId === rowId);
      if (!current || !current._id || current.checkStatus !== 'in_review') return;
      if (!canCheckApplications) return;
      if (current.checkedBy && current.checkedBy._id && current.checkedBy._id !== user?.id) {
        setError('Only the assigned checker can complete this review');
        return;
      }
      const result = current.checkResult || 'pending';
      if (result === 'pending') {
        setError('Select a check result before saving');
        return;
      }
      const note = (current.checkNote || '').trim();
      if (result !== 'ok' && !note) {
        setError('Check note is required before saving');
        return;
      }
      setError(null);
      setRowSaving(rowId, true);
      try {
        const payload = { checkStatus: 'reviewed', checkResult: result, checkNote: note };
        const updated = await api.patch(`/applications/${current._id}`, payload);
        if (updated.error) throw new Error(updated.error);
        const normalized = normalizeRow(updated);
        setRowState(prev => prev.map(row => (row.localId === rowId ? normalized : row)));
      } catch (err) {
        setError(err.message || 'Failed to complete review');
        await fetchData();
      } finally {
        setRowSaving(rowId, false);
      }
    },
    [canCheckApplications, fetchData, setRowSaving, setRowState, user?.id]
  );

  const cancelCheck = useCallback(
    async rowId => {
      const current = rowsRef.current.find(r => r.localId === rowId);
      if (!current || !current._id || current.checkStatus !== 'in_review') return;
      if (!canCheckApplications) return;
      if (current.checkedBy && current.checkedBy._id && current.checkedBy._id !== user?.id) {
        setError('Only the assigned checker can cancel this review');
        return;
      }
      setError(null);
      setRowSaving(rowId, true);
      try {
        const payload = { checkStatus: 'pending', checkNote: '' };
        const updated = await api.patch(`/applications/${current._id}`, payload);
        if (updated.error) throw new Error(updated.error);
        const normalized = normalizeRow(updated);
        setRowState(prev => prev.map(row => (row.localId === rowId ? normalized : row)));
      } catch (err) {
        setError(err.message || 'Failed to cancel review');
        await fetchData();
      } finally {
        setRowSaving(rowId, false);
      }
    },
    [canCheckApplications, fetchData, setRowSaving, setRowState, user?.id]
  );

  const persistRow = useCallback(
    async rowId => {
      const current = rowsRef.current.find(r => r.localId === rowId);
      if (!current || current.isPlaceholder) return false;

      let success = false;

      if (current.isNew) {
        if (!canAddApplications) return false;
        const hasRequired =
          current.company.trim() && current.roleTitle.trim() && current.profileId;
        if (!hasRequired) return false;

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
          success = true;
        } catch (err) {
          setError(err.message || 'Failed to create application');
          await fetchData();
        } finally {
          setRowSaving(rowId, false);
        }
      } else {
        const changedKeys = Object.keys(current.__changes || {});
        const allowedKeys = changedKeys.filter(
          key =>
            !['checkStatus', 'checkNote', 'checkResult', 'checkedBy', 'checkedAt'].includes(key)
        );
        if (!allowedKeys.length) return false;
        if (!canEditApplications) return false;

        setRowSaving(rowId, true);
        try {
          const payload = buildPayload(current, allowedKeys);
          const updated = await api.patch(`/applications/${current._id}`, payload);
          if (updated.error) throw new Error(updated.error);
          const normalized = normalizeRow(updated);
          setRowState(prev =>
            prev.map(row => (row.localId === rowId ? normalized : row))
          );
          success = true;
        } catch (err) {
          setError(err.message || 'Failed to update application');
          await fetchData();
        } finally {
          setRowSaving(rowId, false);
        }
      }

      return success;
    },
    [canAddApplications, canEditApplications, fetchData, setRowSaving, setRowState]
  );

  const exitEditMode = useCallback(
    rowId => {
      if (activeEditor?.rowId === rowId) {
        setActiveEditor(null);
      }
      if (editingRowId === rowId) {
        setEditingRowId(null);
      }
      editSnapshotsRef.current.delete(rowId);
    },
    [activeEditor, editingRowId]
  );

  const beginEditMode = useCallback(
    rowId => {
      if (!canEditApplications) return;
      const current = rowsRef.current.find(r => r.localId === rowId);
      if (current && !current.isNew && !editSnapshotsRef.current.has(rowId)) {
        editSnapshotsRef.current.set(rowId, JSON.parse(JSON.stringify(current)));
      }
      setEditingRowId(rowId);
      setActiveEditor(null);
    },
    [canEditApplications]
  );

  const handleSaveEdit = useCallback(
    async rowId => {
      const ok = await persistRow(rowId);
      if (ok) {
        exitEditMode(rowId);
      }
    },
    [exitEditMode, persistRow]
  );

  const resetEditRow = useCallback(
    rowId => {
      const snapshot = editSnapshotsRef.current.get(rowId);
      if (snapshot) {
        const restored = JSON.parse(JSON.stringify(snapshot));
        restored.__changes = {};
        setRowState(prev =>
          prev.map(row => (row.localId === rowId ? restored : row))
        );
        editSnapshotsRef.current.delete(rowId);
      }
      exitEditMode(rowId);
    },
    [exitEditMode, setRowState]
  );

  const startEditing = useCallback(
    (row, key) => {
      if (row.isPlaceholder) {
        if (!canAddApplications) return;
        const newRow = makeEmptyRow();
        setRowState(prev => [...prev, newRow]);
        setEditingRowId(newRow.localId);
        // Don't set active editor immediately for placeholder rows
        // Let user click on a field to start editing
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
      if (key === 'bidderId') return;
      setActiveEditor({ rowId: row.localId, key });
    },
    [
      canAddApplications,
      canEditApplications,
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

  const renderDisplayValue = useCallback((row, column) => {
    switch (column.key) {
      case 'profileId':
        return row.profile?.alias || '';
      case 'bidderId':
        return row.bidder?.name || '';
      case 'resumeId':
        return row.resume?.title || 'No resume';
      case 'checkStatus':
        return formatCheckStatusLabel(row.checkStatus);
      case 'checkResult':
        return formatCheckResultLabel(row.checkResult);
      case 'checkedBy':
        return row.checkedBy?.name || '';
      case 'checkedAt':
        return formatDate(row.checkedAt);
      case 'bidderNote':
        return row.bidderNote || '';
      case 'checkNote':
        return row.checkNote || '';
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
    const disableBidderField =
      column.key === 'bidderId' && (!row.isNew || !canAssignOtherBidders);
    const disabledBase = savingRows[row.localId] || disableBidderField;

    const handleBlur = () => {
      stopEditing();
    };

    const commonProps = {
      className:
        'w-full rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200',
      value,
      disabled: disabledBase,
      onBlur: handleBlur,
      onKeyDown: e => {
        if (e.key === 'Enter' && column.type !== 'textarea') {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          stopEditing();
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
    const status = row.checkStatus || 'pending';
    const label = formatCheckStatusLabel(status);
    const badgeStyles = {
      pending: 'bg-slate-100 text-slate-600',
      in_review: 'bg-indigo-100 text-indigo-700',
      reviewed: 'bg-emerald-100 text-emerald-700'
    };
    const className = badgeStyles[status] || 'bg-slate-100 text-slate-600';
    return (
      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${className}`}>
        {label}
      </span>
    );
  };

  const renderCheckResultCell = row => {
    const status = row.checkStatus || 'pending';
    const result = row.checkResult || 'pending';
    const options = optionsByKey.checkResults || [];
    const checkerId = row.checkedBy?._id || row.checkedBy?.id;
    const isReviewer = status === 'in_review' && (!checkerId || checkerId === user?.id);

    if (isReviewer) {
      return (
        <select
          className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          value={result}
          onChange={e => handleFieldChange(row.localId, 'checkResult', e.target.value)}
          disabled={savingRows[row.localId]}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }

    return <span>{formatCheckResultLabel(result)}</span>;
  };

  const renderCheckNoteCell = (row, isSaving) => {
    const status = row.checkStatus || 'pending';
    const checkerId = row.checkedBy?._id || row.checkedBy?.id;
    const isReviewer = status === 'in_review' && (!checkerId || checkerId === user?.id);
    const value = row.checkNote || '';

    if (isReviewer) {
      return (
        <textarea
          className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          rows={3}
          placeholder="Add check notes"
          value={value}
          onChange={e => handleFieldChange(row.localId, 'checkNote', e.target.value)}
          disabled={isSaving}
        />
      );
    }

    return value ? (
      <span className="whitespace-pre-wrap">{value}</span>
    ) : (
      <span className="text-slate-400">No note</span>
    );
  };





  const renderCheckAction = (row, isSaving) => {

    if (!row._id || row.isNew || row.isPlaceholder) {

      return null;

    }

    const status = row.checkStatus || 'pending';
    const checkerId = row.checkedBy?._id || row.checkedBy?.id;
    const isReviewer = status === 'in_review' && (!checkerId || checkerId === user?.id);



    if (status === 'pending') {

      if (!canCheckApplications) {

        return null;

      }

      return (

        <button
          type="button"
          onClick={() => startCheck(row)}
          disabled={isSaving}
          className="inline-flex h-8 min-w-[88px] items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? 'Starting...' : 'Check'}
        </button>

      );

    }



    if (status === 'in_review') {

      if (!isReviewer) {

        return (
          <span className="inline-flex h-8 min-w-[88px] items-center justify-center rounded-full bg-slate-100 px-3 text-xs font-medium text-slate-500">
            Assigned to {row.checkedBy?.name || 'checker'}
          </span>
        );

      }
      const trimmedNote = (row.checkNote || '').trim();
      const resultValue = row.checkResult || 'pending';
      const noteRequired = resultValue !== 'ok';
      const noteReady = noteRequired ? trimmedNote.length > 0 : true;
      const resultReady = resultValue !== 'pending';
      const canSave = noteReady && resultReady && !isSaving;

      const saveLabel = isSaving ? 'Saving...' : 'Save';

      return (

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => completeCheck(row.localId)}
            disabled={!canSave}
            className="inline-flex h-8 min-w-[88px] items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saveLabel}
          </button>
          <button
            type="button"
            onClick={() => cancelCheck(row.localId)}
            disabled={isSaving}
            className="inline-flex h-8 min-w-[88px] items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Reset
          </button>
        </div>

      );

    }



    if (status === 'reviewed') {
      return (
        <span className="inline-flex h-8 min-w-[88px] items-center justify-center rounded-full bg-emerald-50 px-3 text-xs font-semibold text-emerald-600">
          Checked
        </span>
      );
    }



    return null;

  };

  const renderActionsCell = (row, isSaving) => {

    if (row.isPlaceholder) {

      return null;

    }

    if (row.isNew) {

      const hasRequired =

        (row.company || '').trim() && (row.roleTitle || '').trim() && row.profileId && row.resumeId;

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
    const checkerId = row.checkedBy?._id || row.checkedBy?.id;
    const checkInProgressForUser =
      row.checkStatus === 'in_review' && (!checkerId || checkerId === user?.id);

    if (inEditMode) {
      const hasChanges = Object.keys(row.__changes || {}).length > 0;
      const editSaveLabel = isSaving ? 'Saving...' : 'Save';
      return (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleSaveEdit(row.localId)}
            disabled={isSaving || !hasChanges}
            className="inline-flex h-8 min-w-[88px] items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 px-3 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {editSaveLabel}
          </button>
          <button
            type="button"
            onClick={() => resetEditRow(row.localId)}
            disabled={isSaving}
            className="inline-flex h-8 min-w-[88px] items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Reset
          </button>
        </div>
      );
    }

    const checkAction = renderCheckAction(row, isSaving);

    if (!canEditApplications) {
      if (checkAction) {
        return <div className="flex flex-wrap items-center gap-2">{checkAction}</div>;
      }
      return <span className="text-xs text-slate-400">View only</span>;
    }

    const showEditButton = !checkInProgressForUser;
    const editButtonClass =
      'border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-60';

    return (
      <div className="flex flex-wrap items-center gap-2">
        {checkAction}
        {showEditButton ? (
          <button
            type="button"
            onClick={() => beginEditMode(row.localId)}
            disabled={isSaving}
            className={`inline-flex h-8 min-w-[88px] items-center justify-center rounded-full border px-3 text-xs font-semibold transition ${editButtonClass}`}
          >
            Edit
          </button>
        ) : null}
        {!checkAction && !showEditButton ? (
          <span className="text-xs text-slate-400">View only</span>
        ) : null}
      </div>
    );

  };

  const headerSection = (
    <header className="flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Applications</h2>
        <p className="text-sm text-slate-500">Manage job submissions, assignments, and review workflow.</p>
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
                    if (column.type === 'checkResult') {
                      return (
                        <td key={column.key} className="px-4 py-3 align-top">
                          {renderCheckResultCell(row)}
                        </td>
                      );
                    }
                    if (column.type === 'checkNote') {
                      return (
                        <td key={column.key} className="px-4 py-3 align-top">
                          {renderCheckNoteCell(row, isSaving)}
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
                      column.type !== 'checkResult' &&
                      column.type !== 'checkNote' &&
                      column.type !== 'actions' &&
                      (row.isNew ? canAddApplications : inEditMode && canEditApplications) &&
                      !(column.key === 'bidderId' && (!row.isNew || !canAssignOtherBidders));

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





