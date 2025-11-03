import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../hooks/useAuth.js';

const PROFILE_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'prestart', label: 'Pre-start' },
  { value: 'disabled', label: 'Disabled' }
];

const LINKEDIN_STATUS_OPTIONS = [
  { value: 'restricted', label: 'Restricted' },
  { value: 'live_stable', label: 'Live (stable)' },
  { value: 'live_good', label: 'Live (good)' },
  { value: 'live_early', label: 'Live (early)' },
  { value: 'appealing', label: 'Appealing' }
];

const PROFILE_STATUS_BADGES = {
  active: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  prestart: 'border-sky-200 bg-sky-50 text-sky-700',
  disabled: 'border-slate-200 bg-slate-100 text-slate-500',
  default: 'border-slate-200 bg-slate-50 text-slate-600'
};

const LINKEDIN_STATUS_BADGES = {
  restricted: 'border-red-200 bg-red-50 text-red-600',
  live_stable: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  live_good: 'border-lime-200 bg-lime-50 text-lime-700',
  live_early: 'border-sky-200 bg-sky-50 text-sky-700',
  appealing: 'border-amber-200 bg-amber-50 text-amber-700',
  default: 'border-slate-200 bg-slate-50 text-slate-600'
};

const optionLabel = (options, value) =>
  options.find(option => option.value === value)?.label || value || '';

const badgeClasses = (map, value) => map[value] || map.default;

const profileTimestamp = item => {
  const source = item?.updatedAt || item?.createdAt;
  const time = source ? new Date(source).getTime() : Date.now();
  return Number.isFinite(time) ? time : Date.now();
};

const ProfileListItem = ({ profile, selected, onSelect }) => {
  const fullName = `${profile.firstName} ${profile.lastName}`.trim() || profile.alias;
  const profileStatusLabel = optionLabel(PROFILE_STATUS_OPTIONS, profile.status);
  const profileStatusClass = badgeClasses(PROFILE_STATUS_BADGES, profile.status);
  const linkedinStatusLabel = optionLabel(LINKEDIN_STATUS_OPTIONS, profile.linkedinStatus);
  const linkedinStatusClass = badgeClasses(LINKEDIN_STATUS_BADGES, profile.linkedinStatus);
  const hasLinkedin = Boolean(profile.linkedinUrl);

  return (
    <button
      type="button"
      onClick={() => onSelect(profile)}
      className={[
        'w-full rounded-xl border px-4 py-3 text-left transition',
        selected
          ? 'border-indigo-400 bg-indigo-50/80 shadow-sm'
          : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/60'
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{fullName}</p>
          <p className="truncate text-xs text-slate-500">{profile.email || 'No email on file'}</p>
        </div>
        <span
          className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${profileStatusClass}`}
        >
          {profileStatusLabel}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="truncate text-xs text-slate-500">
          {hasLinkedin ? profile.linkedinUrl : 'No LinkedIn'}
        </p>
        <span
          className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${linkedinStatusClass}`}
        >
          {linkedinStatusLabel}
        </span>
      </div>
      <p className="mt-3 text-[11px] uppercase tracking-wide text-slate-400">
        Updated {new Date(profile.updatedAt).toLocaleDateString()}
      </p>
    </button>
  );
};

const SectionHeader = ({ title, action }) => (
  <div className="flex items-center justify-between">
    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
    {action}
  </div>
);

const FieldLabel = ({ label, children }) => (
  <label className="block space-y-1 text-sm text-slate-600">
    <span className="font-semibold">{label}</span>
    {children}
  </label>
);

export default function Profiles() {
  const { user, loading: authLoading } = useAuth();
  const canEditProfiles = user?.permissions?.profiles === 'edit' || user?.role === 'admin';
  const canViewProfiles = (user?.permissions?.profiles || 'view') !== 'none';

  const [profiles, setProfiles] = useState([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [profilesError, setProfilesError] = useState(null);

  const [selectedProfile, setSelectedProfile] = useState(null);
  const [profileDetail, setProfileDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  const [selectedResume, setSelectedResume] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [formMode, setFormMode] = useState(null);
  const [resumeForm, setResumeForm] = useState({ title: '', note: '' });
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeRequestError, setResumeRequestError] = useState(null);
  const [resumeRequestPending, setResumeRequestPending] = useState(false);
  const initialCreateForm = useMemo(
    () => ({
      alias: '',
      firstName: '',
      lastName: '',
      email: '',
      status: PROFILE_STATUS_OPTIONS[0].value,
      linkedinUrl: '',
      linkedinStatus: LINKEDIN_STATUS_OPTIONS[0].value
    }),
    []
  );
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState(() => ({ ...initialCreateForm }));
  const [creatingProfile, setCreatingProfile] = useState(false);
  const [createError, setCreateError] = useState(null);

  const handleCreateField = (field, value) => {
    setCreateForm(prev => ({ ...prev, [field]: value }));
  };

  const resetCreateForm = () => {
    setCreateForm({ ...initialCreateForm });
    setCreateError(null);
    setCreatingProfile(false);
  };

  const buildProfilePayload = form => ({
    alias: form.alias.trim(),
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    email: form.email.trim(),
    status: form.status,
    linkedinUrl: form.linkedinUrl.trim(),
    linkedinStatus: form.linkedinStatus
  });

  const createProfile = async e => {
    e.preventDefault();
    if (!canEditProfiles || creatingProfile) return;
    setCreateError(null);
    if (
      !createForm.alias.trim() ||
      !createForm.firstName.trim() ||
      !createForm.lastName.trim() ||
      !createForm.email.trim()
    ) {
      setCreateError('Alias, first name, last name, and email are required.');
      return;
    }

    setCreatingProfile(true);
    const payload = buildProfilePayload(createForm);
    const response = await api.post('/profiles', payload);
    if (response.error) {
      setCreateError(response.error);
      setCreatingProfile(false);
      return;
    }

    setProfiles(prev => {
      const next = [response, ...prev];
      return next.sort((a, b) => profileTimestamp(b) - profileTimestamp(a));
    });
    setSelectedProfile(response);
    resetCreateForm();
    setShowCreateForm(false);
  };

  useEffect(() => {
    if (authLoading || !canViewProfiles) return;
    const loadProfiles = async () => {
      setProfilesLoading(true);
      setProfilesError(null);
      const response = await api.get('/profiles');
      if (response.error) {
        setProfilesError(response.error);
        setProfiles([]);
      } else {
        setProfiles(response);
        if (response.length && !selectedProfile) {
          setSelectedProfile(response[0]);
        }
      }
      setProfilesLoading(false);
    };
    loadProfiles();
  }, [authLoading, canViewProfiles]);

  useEffect(() => {
    if (!selectedProfile) return;
    const loadDetail = async () => {
      setDetailLoading(true);
      setDetailError(null);
      const response = await api.get(`/profiles/${selectedProfile._id || selectedProfile.id}`);
      if (response.error) {
        setDetailError(response.error);
        setProfileDetail(null);
        setSelectedResume(null);
        setPreviewUrl('');
        setPreviewError(null);
      } else {
        const resumes = [...(response.resumes || [])].sort(
          (a, b) => profileTimestamp(b) - profileTimestamp(a)
        );
        setProfileDetail({ ...response.profile, resumes });
        setSelectedResume(resumes[0] || null);
        setPreviewUrl('');
        setPreviewError(null);
        setFormMode(null);
        setResumeForm({ title: '', note: '' });
        setResumeFile(null);
        setResumeRequestError(null);
      }
      setDetailLoading(false);
    };
    loadDetail();
  }, [selectedProfile]);

  useEffect(() => {
    let objectUrl = '';
    let cancelled = false;
    const resumeId = selectedResume?._id || selectedResume?.id;
    if (!resumeId) {
      setPreviewUrl('');
      setPreviewError(null);
      return undefined;
    }

    const loadPreview = async () => {
      setPreviewLoading(true);
      setPreviewError(null);
      const fallbackName = `${profileDetail?.fullName || 'resume'}.pdf`;
      const response = await api.download(`/resumes/${resumeId}/pdf`, {
        fallbackFilename: fallbackName,
        accept: 'application/pdf'
      });
      if (cancelled) return;
      if (response.error) {
        setPreviewError(response.error);
        setPreviewUrl('');
      } else {
        objectUrl = URL.createObjectURL(response.blob);
        setPreviewUrl(objectUrl);
      }
      setPreviewLoading(false);
    };

    loadPreview();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [selectedResume, profileDetail?.fullName]);

  const profileResumes = useMemo(() => {
    if (!profileDetail?.resumes) return [];
    return [...profileDetail.resumes].sort((a, b) => profileTimestamp(b) - profileTimestamp(a));
  }, [profileDetail]);

  const resetResumeFormState = () => {
    setFormMode(null);
    setResumeForm({ title: '', note: '' });
    setResumeFile(null);
    setResumeRequestError(null);
  };

  const handleResumeSelect = resume => {
    setSelectedResume(resume);
    setPreviewUrl('');
    setPreviewError(null);
    resetResumeFormState();
  };

  const openResumeForm = mode => {
    if (mode === 'update' && !selectedResume) return;
    setFormMode(mode);
    setResumeRequestError(null);
    if (mode === 'update' && selectedResume) {
      setResumeForm({
        title: selectedResume.title || '',
        note: selectedResume.note || ''
      });
    } else {
      setResumeForm({ title: '', note: '' });
    }
    setResumeFile(null);
  };

  const toggleResumeForm = mode => {
    if (formMode === mode) {
      resetResumeFormState();
    } else {
      openResumeForm(mode);
    }
  };

  const handleResumeFormField = (field, value) => {
    setResumeForm(prev => ({ ...prev, [field]: value }));
  };

  const handleResumeFileChange = event => {
    const file = event?.target?.files?.[0];
    setResumeFile(file || null);
  };

  const submitResumeForm = async event => {
    event.preventDefault();
    if (!profileDetail || !formMode || resumeRequestPending) return;

    if (formMode === 'create' && !resumeFile) {
      setResumeRequestError('Please attach a PDF resume.');
      return;
    }

    const formData = new FormData();
    formData.append('title', resumeForm.title.trim());
    formData.append('note', resumeForm.note.trim());

    if (formMode === 'create') {
      formData.append('profileId', profileDetail._id || profileDetail.id);
    }

    if (resumeFile) {
      formData.append('file', resumeFile);
    }

    setResumeRequestPending(true);
    setResumeRequestError(null);

    let response;
    if (formMode === 'create') {
      response = await api.postForm('/resumes', formData);
    } else {
      const resumeId = selectedResume?._id || selectedResume?.id;
      if (!resumeId) {
        setResumeRequestError('Select a resume to update.');
        setResumeRequestPending(false);
        return;
      }
      response = await api.patchForm(`/resumes/${resumeId}`, formData);
    }

    if (response?.error) {
      setResumeRequestError(response.error);
      setResumeRequestPending(false);
      return;
    }

    const updatedResume = response;
    setProfileDetail(prev => {
      if (!prev) return prev;
      const existing = prev.resumes || [];
      let next;
      if (formMode === 'create') {
        next = [updatedResume, ...existing];
      } else {
        next = existing.map(item =>
          (item._id || item.id) === (updatedResume._id || updatedResume.id) ? updatedResume : item
        );
      }
      return { ...prev, resumes: next.sort((a, b) => profileTimestamp(b) - profileTimestamp(a)) };
    });
    setSelectedResume(updatedResume);
    setPreviewUrl('');
    setPreviewError(null);
    setResumeRequestPending(false);
    resetResumeFormState();
  };

  const downloadResume = async () => {
    const resumeId = selectedResume?._id || selectedResume?.id;
    if (!resumeId) return;
    const fallbackName = `${profileDetail?.fullName || 'resume'}.pdf`;
    const response = await api.download(`/resumes/${resumeId}/pdf`, {
      fallbackFilename: fallbackName,
      accept: 'application/pdf'
    });
    if (response.error) {
      setPreviewError(response.error);
      return;
    }
    const url = URL.createObjectURL(response.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = response.filename || fallbackName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderResumeForm = () => {
    if (!formMode) return null;
    const isCreate = formMode === 'create';
    return (
      <form
        onSubmit={submitResumeForm}
        className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <FieldLabel label="Title">
            <input
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              value={resumeForm.title}
              onChange={e => handleResumeFormField('title', e.target.value)}
              placeholder="Resume title"
            />
          </FieldLabel>
          <FieldLabel label="Note">
            <textarea
              className="h-24 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              value={resumeForm.note}
              onChange={e => handleResumeFormField('note', e.target.value)}
              placeholder="Internal note about this resume"
            />
          </FieldLabel>
        </div>
        <div>
          <FieldLabel label={isCreate ? 'Upload Resume (PDF)' : 'Replace Resume (PDF)'}>
            <input
              type="file"
              accept="application/pdf"
              onChange={handleResumeFileChange}
              onClick={event => {
                event.target.value = '';
              }}
              className="w-full text-sm text-slate-600"
            />
          </FieldLabel>
          {!isCreate && selectedResume?.storageOriginalName && (
            <p className="mt-1 text-xs text-slate-500">
              Current file: {selectedResume.storageOriginalName}
            </p>
          )}
          {!isCreate && (
            <p className="mt-1 text-xs text-slate-500">Leave blank to keep the existing file.</p>
          )}
        </div>
        {resumeRequestError && <p className="text-sm text-red-600">{resumeRequestError}</p>}
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={resumeRequestPending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {resumeRequestPending ? 'Saving...' : isCreate ? 'Upload Resume' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={resetResumeFormState}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  };

  const renderResumeSection = () => {
    if (!profileDetail) {
      return (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
          Select a profile to view details.
        </div>
      );
    }

    if (!selectedResume) {
      return (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
          This profile does not have any resumes yet.
        </div>
      );
    }

    const updatedLabel = selectedResume.updatedAt
      ? new Date(selectedResume.updatedAt).toLocaleString()
      : null;
    const createdBy =
      selectedResume.createdBy?.name ||
      selectedResume.createdBy?.email ||
      selectedResume.createdBy ||
      '';

    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h4 className="text-lg font-semibold text-slate-900">
              {selectedResume.title || 'Untitled resume'}
            </h4>
            {selectedResume.note && (
              <p className="mt-1 text-sm text-slate-600">{selectedResume.note}</p>
            )}
            <p className="mt-2 text-xs uppercase tracking-wide text-slate-400">
              {updatedLabel ? `Updated ${updatedLabel}` : 'Recently uploaded'}
              {createdBy ? ` · ${createdBy}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadResume}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600"
            >
              Download PDF
            </button>
            {canEditProfiles && (
              <button
                type="button"
                onClick={() => toggleResumeForm('update')}
                className="rounded-lg border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50"
              >
                {formMode === 'update' ? 'Close Edit' : 'Update / Replace'}
              </button>
            )}
          </div>
        </div>
        {previewLoading ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-6 text-sm text-slate-500">
            Loading preview...
          </div>
        ) : previewError ? (
          <div className="rounded-xl border border-red-200 bg-red-50/70 p-6 text-sm text-red-600">
            {previewError}
          </div>
        ) : previewUrl ? (
          <div className="h-[600px] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
            <iframe title="Resume preview" src={previewUrl} className="h-full w-full" />
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-6 text-sm text-slate-500">
            Preview not available.
          </div>
        )}
      </div>
    );
  };

  if (!canViewProfiles && !authLoading) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-sm text-amber-700">
        You do not have permission to view profiles. Ask an administrator for access.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <aside className="w-full lg:w-72">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Profiles</h2>
            {canEditProfiles && (
              <button
                type="button"
                onClick={() => {
                  if (showCreateForm) {
                    resetCreateForm();
                    setShowCreateForm(false);
                  } else {
                    resetCreateForm();
                    setShowCreateForm(true);
                  }
                }}
                className="rounded-lg border border-indigo-200 px-2 py-1 text-xs font-semibold uppercase text-indigo-600 transition hover:bg-indigo-50"
              >
                {showCreateForm ? 'Close' : 'New'}
              </button>
            )}
          </div>
          {showCreateForm && canEditProfiles && (
            <form
              className="mt-4 space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4"
              onSubmit={createProfile}
            >
              <div className="grid grid-cols-1 gap-3">
              <FieldLabel label="Alias">
                <input
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  value={createForm.alias}
                  onChange={e => handleCreateField('alias', e.target.value)}
                  placeholder="Internal nickname (required)"
                />
              </FieldLabel>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <FieldLabel label="First name">
                  <input
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    value={createForm.firstName}
                    onChange={e => handleCreateField('firstName', e.target.value)}
                    placeholder="Required"
                  />
                </FieldLabel>
                <FieldLabel label="Last name">
                  <input
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    value={createForm.lastName}
                    onChange={e => handleCreateField('lastName', e.target.value)}
                    placeholder="Required"
                  />
                </FieldLabel>
              </div>
              <FieldLabel label="Email">
                <input
                  type="email"
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  value={createForm.email}
                  onChange={e => handleCreateField('email', e.target.value)}
                  placeholder="person@mail.com"
                />
              </FieldLabel>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <FieldLabel label="Profile status">
                  <select
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    value={createForm.status}
                    onChange={e => handleCreateField('status', e.target.value)}
                  >
                    {PROFILE_STATUS_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </FieldLabel>
                <FieldLabel label="LinkedIn status">
                  <select
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    value={createForm.linkedinStatus}
                    onChange={e => handleCreateField('linkedinStatus', e.target.value)}
                  >
                    {LINKEDIN_STATUS_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </FieldLabel>
              </div>
              <FieldLabel label="LinkedIn URL">
                <input
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  value={createForm.linkedinUrl}
                  onChange={e => handleCreateField('linkedinUrl', e.target.value)}
                  placeholder="https://linkedin.com/in/username (optional)"
                />
              </FieldLabel>
            </div>
            {createError && <p className="text-sm text-red-600">{createError}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={creatingProfile}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {creatingProfile ? 'Creating...' : 'Create Profile'}
              </button>
              <button
                type="button"
                onClick={() => {
                  resetCreateForm();
                  setShowCreateForm(false);
                }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600"
              >
                Cancel
              </button>
            </div>
            </form>
          )}
          {profilesLoading ? (
            <p className="mt-4 text-sm text-slate-500">Loading profiles...</p>
          ) : profilesError ? (
            <p className="mt-4 text-sm text-red-600">{profilesError}</p>
          ) : profiles.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No profiles available yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {profiles.map(profile => (
                <ProfileListItem
                  key={profile._id || profile.id}
                  profile={profile}
                  selected={(selectedProfile?._id || selectedProfile?.id) === (profile._id || profile.id)}
                  onSelect={setSelectedProfile}
                />
              ))}
            </div>
          )}
        </div>
      </aside>

      <section className="flex-1 space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          {detailLoading ? (
            <p className="text-sm text-slate-500">Loading profile...</p>
          ) : detailError ? (
            <p className="text-sm text-red-600">{detailError}</p>
          ) : profileDetail ? (
            <div className="space-y-6">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Profile</p>
                <h2 className="text-2xl font-semibold text-slate-900">
                  {`${profileDetail.firstName} ${profileDetail.lastName}`.trim() || profileDetail.alias}
                </h2>
                <p className="text-sm text-slate-500">{profileDetail.alias}</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <SectionHeader title="Basics" />
                  <div className="mt-3 space-y-3 text-sm text-slate-600">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">Email</p>
                      {profileDetail.email ? (
                        <a
                          href={`mailto:${profileDetail.email}`}
                          className="text-indigo-600 hover:underline"
                        >
                          {profileDetail.email}
                        </a>
                      ) : (
                        <p className="text-slate-500">No email on file</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">Profile status</p>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${badgeClasses(PROFILE_STATUS_BADGES, profileDetail.status)}`}
                      >
                        {optionLabel(PROFILE_STATUS_OPTIONS, profileDetail.status)}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">Updated</p>
                      <p>
                        {profileDetail.updatedAt
                          ? new Date(profileDetail.updatedAt).toLocaleString()
                          : 'Recently updated'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <SectionHeader title="LinkedIn" />
                  <div className="mt-3 space-y-3 text-sm text-slate-600">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">Status</p>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${badgeClasses(LINKEDIN_STATUS_BADGES, profileDetail.linkedinStatus)}`}
                      >
                        {optionLabel(LINKEDIN_STATUS_OPTIONS, profileDetail.linkedinStatus)}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">URL</p>
                      {profileDetail.linkedinUrl ? (
                        <a
                          href={profileDetail.linkedinUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-600 hover:underline"
                        >
                          {profileDetail.linkedinUrl}
                        </a>
                      ) : (
                        <p className="text-slate-500">No LinkedIn</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Select a profile to view details.</p>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-slate-900">Resumes</h3>
                {canEditProfiles && (
                  <button
                    type="button"
                    onClick={() => toggleResumeForm('create')}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                    disabled={!profileDetail}
                  >
                    {formMode === 'create' ? 'Close Upload' : 'Upload Resume'}
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {profileDetail ? (
                  profileResumes.length ? (
                    profileResumes.map(resume => {
                      const isActive =
                        (selectedResume?._id || selectedResume?.id) === (resume._id || resume.id);
                      return (
                        <button
                          type="button"
                          key={resume._id || resume.id || `resume-${resume.title || 'untitled'}`}
                          onClick={() => handleResumeSelect(resume)}
                          className={[
                            'w-full rounded-lg border px-3 py-2 text-left text-sm transition',
                            isActive
                              ? 'border-indigo-400 bg-indigo-50 text-indigo-700 shadow-sm'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-600'
                          ].join(' ')}
                        >
                          <span className="block font-semibold">
                            {resume.title || 'Untitled resume'}
                          </span>
                          {resume.note && (
                            <span className="mt-0.5 block truncate text-xs text-slate-500">
                              {resume.note}
                            </span>
                          )}
                        </button>
                      );
                    })
                  ) : (
                    <p className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-sm text-slate-500">
                      No resumes yet.
                    </p>
                  )
                ) : (
                  <p className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-sm text-slate-500">
                    Select a profile to view resumes.
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-4">
              {renderResumeForm()}
              {renderResumeSection()}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
