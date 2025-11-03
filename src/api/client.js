const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const parseError = async res => {
  try {
    const payload = await res.json();
    return payload.error || 'Request failed';
  } catch {
    return 'Request failed';
  }
};

export const api = {
  token: null,
  _onUnauthorized: null,
  setToken(t) {
    this.token = t;
  },
  onUnauthorized(handler) {
    this._onUnauthorized = typeof handler === 'function' ? handler : null;
  },
  async get(path) {
    const res = await fetch(`${API_URL}${path}`, { headers: this.headers() });
    if (res.status === 401) {
      if (this._onUnauthorized) this._onUnauthorized();
      return { error: await parseError(res), status: 401 };
    }
    if (!res.ok) {
      return { error: await parseError(res), status: res.status };
    }
    return res.json();
  },
  async post(path, body) {
    const res = await fetch(`${API_URL}${path}`, { method: 'POST', headers: this.headers(), body: JSON.stringify(body) });
    if (res.status === 401) {
      if (this._onUnauthorized) this._onUnauthorized();
      return { error: await parseError(res), status: 401 };
    }
    if (!res.ok) {
      return { error: await parseError(res), status: res.status };
    }
    return res.json();
  },
  async patch(path, body) {
    const res = await fetch(`${API_URL}${path}`, { method: 'PATCH', headers: this.headers(), body: JSON.stringify(body) });
    if (res.status === 401) {
      if (this._onUnauthorized) this._onUnauthorized();
      return { error: await parseError(res), status: 401 };
    }
    if (!res.ok) {
      return { error: await parseError(res), status: res.status };
    }
    return res.json();
  },
  async postForm(path, formData) {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: this.headers({ json: false }),
      body: formData
    });
    if (res.status === 401) {
      if (this._onUnauthorized) this._onUnauthorized();
      return { error: await parseError(res), status: 401 };
    }
    if (!res.ok) {
      return { error: await parseError(res), status: res.status };
    }
    return res.json();
  },
  async patchForm(path, formData) {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'PATCH',
      headers: this.headers({ json: false }),
      body: formData
    });
    if (res.status === 401) {
      if (this._onUnauthorized) this._onUnauthorized();
      return { error: await parseError(res), status: 401 };
    }
    if (!res.ok) {
      return { error: await parseError(res), status: res.status };
    }
    return res.json();
  },
  async download(path, options = {}) {
    const { accept, fallbackFilename } = options;
    const res = await fetch(`${API_URL}${path}`, {
      method: 'GET',
      headers: this.headers({ json: false, accept })
    });
    if (res.status === 401) {
      if (this._onUnauthorized) this._onUnauthorized();
      return { error: await parseError(res), status: 401 };
    }
    if (!res.ok) {
      return { error: await parseError(res), status: res.status };
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    let filename = fallbackFilename || 'download';
    const match = disposition.match(/filename="?([^"]+)"?/);
    if (match) filename = match[1];
    return { blob, filename };
  },
  headers(options = {}) {
    const h = {};
    if (options.json !== false) {
      h['Content-Type'] = 'application/json';
    }
    if (options.accept) {
      h['Accept'] = options.accept;
    }
    if (this.token) h['Authorization'] = `Bearer ${this.token}`;
    return h;
  }
};
