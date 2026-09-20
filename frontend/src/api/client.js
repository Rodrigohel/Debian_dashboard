// Em produção (instalador padrão), o próprio backend serve este frontend
// buildado na mesma origem — então o caminho relativo ('') já basta e
// continua funcionando não importa o IP/host usado para acessar (LAN,
// Tailscale, etc.), sem precisar rebuildar. VITE_API_URL só é necessário
// quando frontend e backend rodam em portas/hosts diferentes (`npm run
// dev`, ou um reverse proxy dedicado — ver frontend/.env.example).
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3002' : '');

function defaultWsUrl() {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/ws`;
}
const WS_URL = import.meta.env.VITE_WS_URL || (API_URL ? `${API_URL.replace(/^http/, 'ws')}/ws` : defaultWsUrl());

export const TOKEN_KEY = 'ip_dashboard_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    setToken(null);
    const err = new Error('Não autenticado');
    err.status = 401;
    throw err;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erro ${res.status}`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return res.json();
  return res.text();
}

export function resolveAssetUrl(path) {
  if (!path) return '';
  return `${API_URL}${path}`;
}

// Downloads autenticados (CSV/PDF): uma navegação direta (`window.open` /
// `<a href>`) não carrega o header Authorization, então o backend
// responderia 401 — busca o arquivo via fetch (com o token) como blob e
// aciona o download programaticamente.
async function downloadFile(path, filename) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erro ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  login: (username, password) =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  me: () => request('/api/auth/me'),

  devices: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
    const suffix = qs.toString() ? `?${qs}` : '';
    return request(`/api/devices${suffix}`);
  },
  deviceDetail: (id) => request(`/api/devices/${id}`),
  createDevice: (data) => request('/api/devices', { method: 'POST', body: JSON.stringify(data) }),
  updateDevice: (id, data) => request(`/api/devices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDevice: (id) => request(`/api/devices/${id}`, { method: 'DELETE' }),
  checkDeviceNow: (id) => request(`/api/devices/${id}/check`, { method: 'POST' }),
  toggleFavorite: (id, favorite) => request(`/api/devices/${id}/favorite`, { method: 'POST', body: JSON.stringify({ favorite }) }),
  identifyDevice: (id) => request(`/api/devices/${id}/identify`, { method: 'POST' }),
  identifyAll: (ids) => request('/api/devices/identify-all', { method: 'POST', body: JSON.stringify({ ids }) }),
  summary: () => request('/api/devices/summary'),
  scanNetwork: (params) => request('/api/devices/scan', { method: 'POST', body: JSON.stringify(params || {}) }),
  importDevices: async (file) => {
    const token = getToken();
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_URL}/api/devices/import`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Erro ${res.status}`);
    }
    return res.json();
  },
  exportDevicesCsv: () => downloadFile('/api/devices/export', 'dispositivos.csv'),
  exportDevicesPdf: () => downloadFile('/api/devices/export/pdf', 'dispositivos.pdf'),

  alerts: () => request('/api/alerts'),
  eventsHistory: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
    return request(`/api/history?${qs}`);
  },

  networkHistory: (hours) => request(`/api/stats/network-history?hours=${hours}`),
  serverHealth: () => request('/api/stats/server-health'),
  flappiestDevices: (hours = 24, limit = 5) => request(`/api/stats/flappiest?hours=${hours}&limit=${limit}`),

  publicDashboard: () => request('/api/public/dashboard'),
  publicSettings: () => request('/api/public/settings'),

  settings: () => request('/api/settings'),
  updateSettings: (partial) => request('/api/settings', { method: 'PUT', body: JSON.stringify(partial) }),
  testTelegram: (partial) => request('/api/settings/telegram/test', { method: 'POST', body: JSON.stringify(partial) }),
  uploadLogo: async (file) => {
    const token = getToken();
    const form = new FormData();
    form.append('logo', file);
    const res = await fetch(`${API_URL}/api/settings/logo`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Erro ${res.status}`);
    }
    return res.json();
  },

  users: () => request('/api/users'),
  createUser: (data) => request('/api/users', { method: 'POST', body: JSON.stringify(data) }),
  deleteUser: (id) => request(`/api/users/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};

export function connectLiveSocket(onMessage) {
  let ws;
  let closedByUser = false;

  function connect() {
    ws = new WebSocket(WS_URL);
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        onMessage(msg);
      } catch {
        // ignora mensagens malformadas
      }
    };
    ws.onclose = () => {
      if (!closedByUser) setTimeout(connect, 3000);
    };
    ws.onerror = () => ws.close();
  }

  connect();

  return () => {
    closedByUser = true;
    ws && ws.close();
  };
}
