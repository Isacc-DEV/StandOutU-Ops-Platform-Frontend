import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../hooks/useAuth.js';

const formatContactLine = (contact = {}) =>
  [
    [contact.addressLine1, contact.addressLine2].filter(Boolean).join(', '),
    [contact.city, contact.state, contact.postalCode].filter(Boolean).join(', '),
    contact.country
  ]
    .filter(Boolean)
    .join(' • ');

const profileTimestamp = item => {
  const source = item?.updatedAt || item?.createdAt;
  const time = source ? new Date(source).getTime() : Date.now();
  return Number.isFinite(time) ? time : Date.now();
};

const ProfileListItem = ({ profile, selected, onSelect }) => {
  const fullName = `${profile.firstName} ${profile.lastName}`.trim();
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
      <p className="text-sm font-semibold text-slate-900">{fullName || profile.alias}</p>
      <p className="text-xs text-slate-500">{profile.contact?.email || 'No email on file'}</p>
      {profile.tags?.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {profile.tags.map(tag => (
            <span
              key={tag}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-500"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
      <p className="mt-2 text-[11px] uppercase tracking-wide text-slate-400">
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
      summary: '',
      tags: '',
      links: '',
      email: '',
      secondaryEmail: '',
      phone: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      postalCode: '',
      country: ''
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
    summary: form.summary.trim(),
    tags: form.tags
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean),
    links: form.links
      .split('\n')
      .map(link => link.trim())
      .filter(Boolean),
    contact: {
      email: form.email.trim(),
      secondaryEmail: form.secondaryEmail.trim(),
      phone: form.phone.trim(),
      addressLine1: form.addressLine1.trim(),
      addressLine2: form.addressLine2.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      postalCode: form.postalCode.trim(),
      country: form.country.trim()
    }
  });

  const createProfile = async e => {
    e.preventDefault();
    if (!canEditProfiles || creatingProfile) return;
    setCreateError(null);
    if (!createForm.alias.trim() || !createForm.firstName.trim() || !createForm.lastName.trim()) {
      setCreateError('Alias, first name, and last name are required.');
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
            <form className="mt-4 space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4" onSubmit={createProfile}>
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
                <FieldLabel label="Summary">
                  <textarea
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    value={createForm.summary}
                    onChange={e => handleCreateField('summary', e.target.value)}
                    placeholder="One or two sentences about the profile"
                    rows={2}
                  />
                </FieldLabel>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <FieldLabel label="Primary email">
                    <input
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      value={createForm.email}
                      onChange={e => handleCreateField('email', e.target.value)}
                      placeholder="person@mail.com"
                    />
                  </FieldLabel>
                  <FieldLabel label="Secondary email">
                    <input
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      value={createForm.secondaryEmail}
                      onChange={e => handleCreateField('secondaryEmail', e.target.value)}
                      placeholder="Optional"
                    />
                  </FieldLabel>
                </div>
                <FieldLabel label="Phone">
                  <input
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    value={createForm.phone}
                    onChange={e => handleCreateField('phone', e.target.value)}
                    placeholder="+1 (555) 123-4567"
                  />
                </FieldLabel>
                <FieldLabel label="Tags (comma separated)">
                  <input
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    value={createForm.tags}
                    onChange={e => handleCreateField('tags', e.target.value)}
                    placeholder="frontend, react, contract"
                  />
                </FieldLabel>
                <FieldLabel label="Links (one per line)">
                  <textarea
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    value={createForm.links}
                    onChange={e => handleCreateField('links', e.target.value)}
                    placeholder="https://linkedin.com/in/example"
                    rows={2}
                  />
                </FieldLabel>
                <FieldLabel label="Address">
                  <div className="space-y-2">
                    <input
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      value={createForm.addressLine1}
                      onChange={e => handleCreateField('addressLine1', e.target.value)}
                      placeholder="Address line 1"
                    />
                    <input
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      value={createForm.addressLine2}
                      onChange={e => handleCreateField('addressLine2', e.target.value)}
                      placeholder="Address line 2"
                    />
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <input
                        className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        value={createForm.city}
                        onChange={e => handleCreateField('city', e.target.value)}
                        placeholder="City"
                      />
                      <input
                        className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        value={createForm.state}
                        onChange={e => handleCreateField('state', e.target.value)}
                        placeholder="State"
                      />
                      <input
                        className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        value={createForm.postalCode}
                        onChange={e => handleCreateField('postalCode', e.target.value)}
                        placeholder="Postal code"
                      />
                    </div>
                    <input
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      value={createForm.country}
                      onChange={e => handleCreateField('country', e.target.value)}
                      placeholder="Country"
                    />
                  </div>
                </FieldLabel>
              </div>
              {createError && <p className="text-sm text-red-600">{createError}</p>}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  disabled={creatingProfile}
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:bg-slate-300 hover:bg-indigo-500"
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
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Profile</p>
                <h2 className="text-2xl font-semibold text-slate-900">
                  {`${profileDetail.firstName} ${profileDetail.lastName}`.trim() || profileDetail.alias}
                </h2>
                <p className="text-sm text-slate-500">{profileDetail.alias}</p>
              </div>
              {profileDetail.summary && (
                <p className="text-sm text-slate-600">{profileDetail.summary}</p>
              )}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <SectionHeader title="Contact" />
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    {profileDetail.contact?.email && <p>{profileDetail.contact.email}</p>}
                    {profileDetail.contact?.secondaryEmail && <p>{profileDetail.contact.secondaryEmail}</p>}
                    {profileDetail.contact?.phone && <p>{profileDetail.contact.phone}</p>}
                    {formatContactLine(profileDetail.contact) && (
                      <p>{formatContactLine(profileDetail.contact)}</p>
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <SectionHeader title="Links" />
                  <div className="mt-3 space-y-2 text-sm text-indigo-600">
                    {profileDetail.links?.length ? (
                      profileDetail.links.map(link => (
                        <a
                          key={link}
                          href={link}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate hover:underline"
                        >
                          {link}
                        </a>
                      ))
                    ) : (
                      <p className="text-slate-500">No links added.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Select a profile to view details.</p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-900">Resumes</h3>
            <div className="flex flex-wrap items-center gap-2">
              {profileResumes.map(resume => {
                const isActive =
                  (selectedResume?._id || selectedResume?.id) === (resume._id || resume.id);
                return (
                  <button
                    type="button"
                    key={resume._id || resume.id || `resume-${resume.title || 'untitled'}`}
                    onClick={() => handleResumeSelect(resume)}
                    className={[
                      'rounded-lg border px-3 py-1.5 text-left text-sm transition',
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
              })}
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
          </div>
          <div className="mt-4 space-y-4">
            {renderResumeForm()}
            {renderResumeSection()}
          </div>
        </div>
      </section>
    </div>
  );
};
