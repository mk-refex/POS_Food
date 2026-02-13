export function getApiBaseUrl() {
  const url = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000/api';
  return url.replace(/\/$/, '');
}

function getToken() {
  return localStorage.getItem('auth_token') || '';
}

// ——— Employee portal (separate token/session) ———
const EMPLOYEE_TOKEN_KEY = 'employee_token';
const EMPLOYEE_USER_KEY = 'employee_user';

export function getEmployeeToken() {
  return localStorage.getItem(EMPLOYEE_TOKEN_KEY) || '';
}

export function apiFetchEmployee(path: string, options: RequestInit = {}) {
  const base = getApiBaseUrl();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  const token = getEmployeeToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  return apiFetchWithBase(`${base}${path}`, { ...options, headers });
}

async function apiFetchWithBase(url: string, options: RequestInit = {}) {
  const headers = (options.headers || {}) as Record<string, string>;
  try {
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      let message = `Request failed (${res.status})`;
      let errors = null;
      try {
        const data = await res.json();
        message = data?.message || message;
        errors = data?.errors || null;
      } catch {
        message = res.statusText || `HTTP ${res.status}`;
      }
      const error = new Error(message);
      (error as any).errors = errors;
      (error as any).status = res.status;
      throw error;
    }
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) return res.json();
    return res.text();
  } catch (e) {
    if (e instanceof Error) throw e;
    throw new Error('Network error occurred');
  }
}

export function isEmployeeAuthenticated(): boolean {
  return !!getEmployeeToken();
}

export function getEmployeeUser() {
  try {
    const s = localStorage.getItem(EMPLOYEE_USER_KEY);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

export function setEmployeeSession(token: string, employee: object) {
  localStorage.setItem(EMPLOYEE_TOKEN_KEY, token);
  localStorage.setItem(EMPLOYEE_USER_KEY, JSON.stringify(employee));
}

export function clearEmployeeSession() {
  localStorage.removeItem(EMPLOYEE_TOKEN_KEY);
  localStorage.removeItem(EMPLOYEE_USER_KEY);
  window.location.href = '/employee/login';
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const base = getApiBaseUrl();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  try {
    const res = await fetch(`${base}${path}`, { ...options, headers });
    
    if (!res.ok) {
      let message = `Request failed (${res.status})`;
      let errors = null;
      
      try {
        const data = await res.json();
        message = data?.message || message;
        errors = data?.errors || null;
      } catch {
        // If response is not JSON, use status text
        message = res.statusText || `HTTP ${res.status}`;
      }
      
      const error = new Error(message);
      (error as any).errors = errors;
      (error as any).status = res.status;
      throw error;
    }
    
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) return res.json();
    return res.text();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Network error occurred');
  }
}

// Helper function to check if user is authenticated
export function isAuthenticated(): boolean {
  return !!getToken();
}

// Helper function to get current user
export function getCurrentUser() {
  try {
    const userStr = localStorage.getItem('currentUser');
    return userStr ? JSON.parse(userStr) : null;
  } catch {
    return null;
  }
}

// Helper function to logout
export function logout() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('currentUser');
  window.location.href = '/login';
}

// Helper function to check if user is admin
export function isAdmin(): boolean {
  const user = getCurrentUser();
  return user?.role === 'admin';
}

// Master Data API functions
export const mastersApi = {
  // Employee API
  getEmployees: (params?: Record<string, any>) => apiFetch(`/masters/employees${toQuery(params)}`),
  createEmployee: (data: any) => apiFetch('/masters/employees', { method: 'POST', body: JSON.stringify(data) }),
  updateEmployee: (id: string, data: any) => apiFetch(`/masters/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEmployee: (id: string) => apiFetch(`/masters/employees/${id}`, { method: 'DELETE' }),

  // Support Staff API
  getSupportStaff: (params?: Record<string, any>) => apiFetch(`/masters/support-staff${toQuery(params)}`),
  createSupportStaff: (data: any) => apiFetch('/masters/support-staff', { method: 'POST', body: JSON.stringify(data) }),
  updateSupportStaff: (id: string, data: any) => apiFetch(`/masters/support-staff/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSupportStaff: (id: string) => apiFetch(`/masters/support-staff/${id}`, { method: 'DELETE' }),

  // Guest API
  getGuests: (params?: Record<string, any>) => apiFetch(`/masters/guests${toQuery(params)}`),
  createGuest: (data: any) => apiFetch('/masters/guests', { method: 'POST', body: JSON.stringify(data) }),
  updateGuest: (id: string, data: any) => apiFetch(`/masters/guests/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteGuest: (id: string) => apiFetch(`/masters/guests/${id}`, { method: 'DELETE' }),

  // Price Master API
  getPriceMaster: () => apiFetch('/masters/price-master'),
  updatePriceMaster: (data: any) => apiFetch('/masters/price-master', { method: 'PUT', body: JSON.stringify(data) }),
  // API Config (read available to all authenticated users, update requires admin)
  getApiConfig: () => apiFetch('/masters/api-config'),
  updateApiConfig: (data: any) => apiFetch('/admin/api-config', { method: 'PUT', body: JSON.stringify(data) }),

  // SSO Config (Google) – admin only
  getSsoConfig: () => apiFetch('/admin/sso-config'),
  updateSsoConfig: (data: { provider?: string; clientId?: string; clientSecret?: string; redirectUri?: string | null; frontendBaseUrl?: string | null }) =>
    apiFetch('/admin/sso-config', { method: 'PUT', body: JSON.stringify(data) }),

  // SMTP Config (admin only)
  getSmtpConfig: () => apiFetch('/admin/smtp-config'),
  updateSmtpConfig: (data: { host?: string; port?: number | null; secure?: boolean; user?: string; password?: string; fromEmail?: string; fromName?: string }) =>
    apiFetch('/admin/smtp-config', { method: 'PUT', body: JSON.stringify(data) }),
  testSmtp: (testEmail: string) =>
    apiFetch('/admin/smtp-config/test', { method: 'POST', body: JSON.stringify({ testEmail }) }),

  // Menu (admin: publish menu for specific dates; employees view via /employee/menu)
  getMenus: (params?: { startDate?: string; endDate?: string; mealType?: string }) =>
    apiFetch(`/masters/menus${toQuery(params)}`),
  upsertMenu: (data: { date: string; mealType: string; items: Array<{ name: string; description?: string }>; published?: boolean }) =>
    apiFetch('/masters/menus', { method: 'POST', body: JSON.stringify(data) }),
  deleteMenu: (date: string, mealType: string) =>
    apiFetch(`/masters/menus?date=${encodeURIComponent(date)}&mealType=${encodeURIComponent(mealType)}`, { method: 'DELETE' }),
};

function toQuery(params?: Record<string, any>) {
  if (!params) return '';
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return query ? `?${query}` : '';
}


