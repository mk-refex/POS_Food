import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Layout from '../../components/feature/Layout';
import Pagination from '../../components/Pagination';
import { apiFetch, isAdmin, mastersApi } from '../../api/client';

interface User {
  id: number;
  username?: string | null;
  email: string;
  name: string;
  role: 'admin' | 'user';
  createdAt: string;
  updatedAt: string;
}

interface Company {
  id: number;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface HrmsConfig {
  id: number;
  companyId: number;
  apiUrl: string;
  accessToken?: string;
  apiKey?: string;
  username?: string;
  password?: string;
  headers?: Record<string, string>;
  isActive: boolean;
  lastSync?: string;
  syncInterval: number;
  company?: Company;
  createdAt: string;
  updatedAt: string;
}

interface SsoProvider {
  id: number;
  provider: string;
  displayName?: string | null;
  iconUrl?: string | null;
  sortOrder: number;
  isActive: boolean;
  clientId?: string;
  clientSecret?: string;
  hasClientSecret?: boolean;
  redirectUri?: string | null;
  frontendBaseUrl?: string | null;
  authorizationUrl?: string | null;
  tokenUrl?: string | null;
  userInfoUrl?: string | null;
  discoveryUrl?: string | null;
  scopes?: string | null;
}

const emptySsoForm = {
  provider: '',
  displayName: '',
  iconUrl: '',
  sortOrder: 0,
  isActive: true,
  clientId: '',
  clientSecret: '',
  redirectUri: '',
  frontendBaseUrl: '',
  authorizationUrl: '',
  tokenUrl: '',
  userInfoUrl: '',
  discoveryUrl: '',
  scopes: 'openid email profile',
};

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<'users' | 'api' | 'sso' | 'smtp'>('users');
  const [users, setUsers] = useState<User[]>([]);
  // Companies removed per request
  // HRMS removed per request
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Pagination state per tab (simple client-side for now)
  const [userPage, setUserPage] = useState(1);
  const [userLimit, setUserLimit] = useState(10);
  // company pagination removed
  // hrms pagination removed

  // Form states
  const [showUserForm, setShowUserForm] = useState(false);
  // company form removed
  // hrms form removed
  const [editingItem, setEditingItem] = useState<any>(null);

  // Form data
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    password: '',
    name: '',
    role: 'user' as 'admin' | 'user'
  });
  
  // Form validation errors
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // company form state removed

  // hrms form state removed

  // API Config (singleton)
  const [apiConfig, setApiConfig] = useState({
    baseUrl: '',
    accessToken: '',
    apiKey: '',
    username: '',
    password: '',
    headersJson: ''
  });

  // SSO providers
  const [ssoProviders, setSsoProviders] = useState<SsoProvider[]>([]);
  const [showSsoForm, setShowSsoForm] = useState(false);
  const [ssoForm, setSsoForm] = useState(emptySsoForm);
  const [ssoSaving, setSsoSaving] = useState(false);

  // SMTP Config
  const [smtpConfig, setSmtpConfig] = useState({
    host: '',
    port: '',
    secure: true,
    user: '',
    password: '',
    fromEmail: '',
    fromName: ''
  });
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testSmtpLoading, setTestSmtpLoading] = useState(false);
  const [testSmtpMessage, setTestSmtpMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!isAdmin()) {
      window.location.href = '/dashboard';
      return;
    }
    loadData();
  }, []);

  // Load API config initially and whenever tab is "api"
  useEffect(() => {
    const loadApi = async () => {
      try {
        const cfg = await mastersApi.getApiConfig();
        if (cfg) {
          setApiConfig({
            baseUrl: cfg.baseUrl || '',
            accessToken: cfg.accessToken || '',
            apiKey: cfg.apiKey || '',
            username: cfg.username || '',
            password: '',
            headersJson: cfg.headersJson || ''
          });
        }
      } catch {}
    };
    if (activeTab === 'api') loadApi();
  }, [activeTab]);

  const loadSsoProviders = async () => {
    try {
      const rows = await mastersApi.listSsoProviders();
      setSsoProviders(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load SSO providers');
      setSsoProviders([]);
    }
  };

  // Load SSO providers when tab is "sso"
  useEffect(() => {
    if (activeTab !== 'sso') return;
    setError('');
    loadSsoProviders();
  }, [activeTab]);

  // Load SMTP config when tab is "smtp"
  useEffect(() => {
    if (activeTab !== 'smtp') return;
    setTestSmtpMessage(null);
    const loadSmtp = async () => {
      try {
        const cfg = await mastersApi.getSmtpConfig();
        if (cfg) {
          setSmtpConfig({
            host: cfg.host || '',
            port: cfg.port != null ? String(cfg.port) : '',
            secure: cfg.secure !== false,
            user: cfg.user || '',
            password: '',
            fromEmail: cfg.fromEmail || '',
            fromName: cfg.fromName || ''
          });
        } else {
          setSmtpConfig({ host: '', port: '', secure: true, user: '', password: '', fromEmail: '', fromName: '' });
        }
      } catch {
        setSmtpConfig({ host: '', port: '', secure: true, user: '', password: '', fromEmail: '', fromName: '' });
      }
    };
    loadSmtp();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const [usersData] = await Promise.all([
        apiFetch('/admin/users')
      ]);
      
      setUsers(usersData);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Client-side validation
    setFormErrors({});
    const errors: Record<string, string> = {};
    
    // Validate username format if provided
    if (userForm.username && !/^[a-zA-Z0-9_.-]+$/.test(userForm.username)) {
      errors.username = 'Username can only contain letters, numbers, dots, underscores, and hyphens';
    }
    
    if (userForm.username && userForm.username.length < 3) {
      errors.username = 'Username must be at least 3 characters';
    }
    
    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userForm.email)) {
      errors.email = 'Invalid email format';
    }
    
    // Check for existing username and email before submission
    if (!editingItem && userForm.username) {
      const existingByUsername = users.find(u => u.username?.toLowerCase() === userForm.username.toLowerCase());
      if (existingByUsername) {
        errors.username = 'Username already in use';
      }
    }
    
    if (!editingItem) {
      const existingByEmail = users.find(u => u.email.toLowerCase() === userForm.email.toLowerCase());
      if (existingByEmail) {
        errors.email = 'Email already in use';
      }
    }
    
    // Check for conflicts when editing
    if (editingItem) {
      const existingByUsername = users.find(u => u.id !== editingItem.id && u.username?.toLowerCase() === userForm.username.toLowerCase());
      if (existingByUsername) {
        errors.username = 'Username already in use';
      }
      
      const existingByEmail = users.find(u => u.id !== editingItem.id && u.email.toLowerCase() === userForm.email.toLowerCase());
      if (existingByEmail) {
        errors.email = 'Email already in use';
      }
    }
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      setFormErrors({});
      
      if (editingItem) {
        await apiFetch(`/admin/users/${editingItem.id}`, {
          method: 'PUT',
          body: JSON.stringify(userForm)
        });
        setSuccess('User updated successfully');
      } else {
        await apiFetch('/admin/users', {
          method: 'POST',
          body: JSON.stringify(userForm)
        });
        setSuccess('User created successfully');
      }
      
      setShowUserForm(false);
      setEditingItem(null);
      setUserForm({ username: '', email: '', password: '', name: '', role: 'user' });
      setFormErrors({});
      loadData();
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to save user';
      setError(errorMessage);
      
      // Parse server-side validation errors if available
      if (err.errors) {
        setFormErrors(err.errors);
      } else if (errorMessage.includes('Email already in use')) {
        setFormErrors({ email: 'Email already in use' });
      } else if (errorMessage.includes('Username already in use')) {
        setFormErrors({ username: 'Username already in use' });
      }
    } finally {
      setLoading(false);
    }
  };

  // company submit removed

  // HRMS removed
  // const handleHrmsSubmit = async (e: React.FormEvent) => { /* removed */ };

  const handleDelete = async (type: 'user' | 'sso', id: number) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    
    try {
      setLoading(true);
      setError('');
      
      if (type === 'sso') {
        await mastersApi.deleteSsoProvider(id);
        setSuccess('SSO provider deleted successfully');
        await loadSsoProviders();
      } else {
        await apiFetch(`/admin/${type + 's'}/${id}`, {
          method: 'DELETE'
        });
        setSuccess(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully`);
        loadData();
      }
    } catch (err: any) {
      setError(err.message || `Failed to delete ${type}`);
    } finally {
      setLoading(false);
    }
  };

  // HRMS removed
  // const handleTestConnection = async (id: number) => { /* removed */ };

  const editSsoProvider = (item: SsoProvider) => {
    setEditingItem(item);
    setSsoForm({
      provider: item.provider || '',
      displayName: item.displayName || '',
      iconUrl: item.iconUrl || '',
      sortOrder: item.sortOrder ?? 0,
      isActive: item.isActive !== false,
      clientId: item.clientId || '',
      clientSecret: '',
      redirectUri: item.redirectUri || '',
      frontendBaseUrl: item.frontendBaseUrl || '',
      authorizationUrl: item.authorizationUrl || '',
      tokenUrl: item.tokenUrl || '',
      userInfoUrl: item.userInfoUrl || '',
      discoveryUrl: item.discoveryUrl || '',
      scopes: item.scopes || 'openid email profile',
    });
    setShowSsoForm(true);
  };

  const handleSsoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSsoSaving(true);
      setError('');
      setSuccess('');
      const payload: Record<string, unknown> = {
        provider: ssoForm.provider.trim(),
        displayName: ssoForm.displayName.trim() || ssoForm.provider.trim(),
        iconUrl: ssoForm.iconUrl.trim() || null,
        sortOrder: Number(ssoForm.sortOrder) || 0,
        isActive: ssoForm.isActive,
        clientId: ssoForm.clientId.trim(),
        redirectUri: ssoForm.redirectUri.trim() || null,
        frontendBaseUrl: ssoForm.frontendBaseUrl.trim() || null,
        authorizationUrl: ssoForm.authorizationUrl.trim() || null,
        tokenUrl: ssoForm.tokenUrl.trim() || null,
        userInfoUrl: ssoForm.userInfoUrl.trim() || null,
        discoveryUrl: ssoForm.discoveryUrl.trim() || null,
        scopes: ssoForm.scopes.trim() || 'openid email profile',
      };
      if (ssoForm.clientSecret.trim()) {
        payload.clientSecret = ssoForm.clientSecret.trim();
      }
      if (editingItem?.id) {
        await mastersApi.updateSsoProvider(editingItem.id, payload);
        setSuccess('SSO provider updated');
      } else {
        await mastersApi.createSsoProvider(payload);
        setSuccess('SSO provider created');
      }
      setShowSsoForm(false);
      setEditingItem(null);
      await loadSsoProviders();
    } catch (err: any) {
      setError(err?.message || 'Failed to save SSO provider');
    } finally {
      setSsoSaving(false);
    }
  };

  const editItem = (item: any, type: 'user') => {
    setEditingItem(item);
    
    if (type === 'user') {
      setUserForm({
        username: item.username || '',
        email: item.email,
        password: '',
        name: item.name,
        role: item.role
      });
      setFormErrors({});
      setShowUserForm(true);
    }
  };

  if (!isAdmin()) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <i className="ri-shield-cross-line text-4xl text-red-600 mb-4"></i>
            <p className="text-gray-600">Access denied. Admin privileges required.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-gray-600 mt-1">Manage users</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-center">
              <i className="ri-error-warning-line text-red-600 mr-2"></i>
              <p className="text-red-800 font-medium">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
            <div className="flex items-center">
              <i className="ri-check-line text-green-600 mr-2"></i>
              <p className="text-green-800 font-medium">{success}</p>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'users', label: 'Users', icon: 'ri-user-line' },
                { id: 'api', label: 'API Config', icon: 'ri-settings-3-line' },
                { id: 'sso', label: 'SSO Config', icon: 'ri-shield-keyhole-line' },
                { id: 'smtp', label: 'SMTP Config', icon: 'ri-mail-line' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <i className={`${tab.icon} mr-2`}></i>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">User Management</h2>
              <button
                onClick={() => {
                  setEditingItem(null);
                  setUserForm({ username: '', email: '', password: '', name: '', role: 'user' });
                  setFormErrors({});
                  setShowUserForm(true);
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <i className="ri-add-line mr-2"></i>
                Add User
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.slice((userPage-1)*userLimit, (userPage-1)*userLimit + userLimit).map((user) => (
                      <tr key={user.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.username || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => editItem(user, 'user')}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                              title="Edit User"
                            >
                              <i className="ri-edit-line"></i>
                            </button>
                            <button
                              onClick={() => handleDelete('user', user.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                              title="Delete User"
                            >
                              <i className="ri-delete-bin-line"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                totalItems={users.length}
                currentPage={userPage}
                itemsPerPage={userLimit}
                onPageChange={(p) => setUserPage(Math.max(1, p))}
                onItemsPerPageChange={(l) => { setUserPage(1); setUserLimit(l); }}
              />
            </div>
          </div>
        )}

        {/* API Config Tab */}
        {activeTab === 'api' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">API Configuration</h2>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <form
                className="p-6 space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    setLoading(true);
                    setError('');
                    const payload: any = { ...apiConfig };
                    if (!payload.password) delete payload.password;
                    await mastersApi.updateApiConfig(payload);
                    setSuccess('API configuration saved');
                    const cfg = await mastersApi.getApiConfig();
                    if (cfg) {
                      setApiConfig({
                        baseUrl: cfg.baseUrl || '',
                        accessToken: cfg.accessToken || '',
                        apiKey: cfg.apiKey || '',
                        username: cfg.username || '',
                        password: '',
                        headersJson: cfg.headersJson || ''
                      });
                    }
                  } catch (err: any) {
                    setError(err.message || 'Failed to save API config');
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Base URL *</label>
                    <input name="baseUrl" type="url" value={apiConfig.baseUrl} onChange={(e)=>setApiConfig({ ...apiConfig, baseUrl: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Access Token</label>
                    <input name="accessToken" type="text" value={apiConfig.accessToken} onChange={(e)=>setApiConfig({ ...apiConfig, accessToken: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                    <input name="apiKey" type="text" value={apiConfig.apiKey} onChange={(e)=>setApiConfig({ ...apiConfig, apiKey: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                    <input name="username" type="text" value={apiConfig.username} onChange={(e)=>setApiConfig({ ...apiConfig, username: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <input name="password" type="password" value={apiConfig.password} onChange={(e)=>setApiConfig({ ...apiConfig, password: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Custom Headers (JSON)</label>
                    <textarea name="headersJson" rows={4} value={apiConfig.headersJson} onChange={(e)=>setApiConfig({ ...apiConfig, headersJson: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" placeholder='{"Authorization":"Bearer ..."}' />
                  </div>
                </div>
                <div className="flex justify-end pt-4">
                  <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                    {loading ? 'Saving...' : 'Save Configuration'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* SSO Config Tab */}
        {activeTab === 'sso' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">SSO Providers</h2>
              <button
                onClick={() => {
                  setEditingItem(null);
                  setSsoForm(emptySsoForm);
                  setShowSsoForm(true);
                }}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <i className="ri-add-line mr-2"></i>
                Add Provider
              </button>
            </div>
            <p className="text-sm text-gray-600">
              Add OIDC providers for the employee login page. Set a Discovery URL or the Authorization, Token, and UserInfo URLs.
              Redirect URI must be your API callback, e.g.{' '}
              <code className="text-xs bg-gray-100 px-1 rounded">https://your-api.com/api/employee-auth/sso/refex-one/callback</code>.
              Lower sort order appears first on the login page.
            </p>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Icon</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Slug</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {ssoProviders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                          No SSO providers configured yet.
                        </td>
                      </tr>
                    ) : (
                      ssoProviders.map((provider) => (
                        <tr key={provider.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{provider.sortOrder ?? 0}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {provider.iconUrl ? (
                              <img src={provider.iconUrl} alt="" className="h-6 w-6 object-contain" />
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {provider.displayName || provider.provider}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{provider.provider}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              provider.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {provider.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => editSsoProvider(provider)}
                                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                title="Edit provider"
                              >
                                <i className="ri-edit-line"></i>
                              </button>
                              <button
                                onClick={() => handleDelete('sso', provider.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                title="Delete provider"
                              >
                                <i className="ri-delete-bin-line"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SMTP Config Tab */}
        {activeTab === 'smtp' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">SMTP Configuration</h2>
            </div>
            <p className="text-sm text-gray-600">
              Configure outgoing email (e.g. for notifications). Save the configuration first, then use &quot;Test SMTP&quot; to send a test email.
            </p>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <form
                className="p-6 space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    setSmtpSaving(true);
                    setError('');
                    setSuccess('');
                    const payload: any = {
                      host: smtpConfig.host.trim(),
                      port: smtpConfig.port.trim() === '' ? null : Number(smtpConfig.port) || null,
                      secure: smtpConfig.secure,
                      user: smtpConfig.user.trim(),
                      fromEmail: smtpConfig.fromEmail.trim(),
                      fromName: smtpConfig.fromName.trim()
                    };
                    if (smtpConfig.password) payload.password = smtpConfig.password;
                    await mastersApi.updateSmtpConfig(payload);
                    setSuccess('SMTP configuration saved');
                    const cfg = await mastersApi.getSmtpConfig();
                    if (cfg) {
                      setSmtpConfig({
                        host: cfg.host || '',
                        port: cfg.port != null ? String(cfg.port) : '',
                        secure: cfg.secure !== false,
                        user: cfg.user || '',
                        password: '',
                        fromEmail: cfg.fromEmail || '',
                        fromName: cfg.fromName || ''
                      });
                    }
                  } catch (err: any) {
                    setError(err?.message || 'Failed to save SMTP config');
                  } finally {
                    setSmtpSaving(false);
                  }
                }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Host</label>
                    <input
                      type="text"
                      value={smtpConfig.host}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
                      placeholder="smtp.gmail.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={smtpConfig.port}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, port: e.target.value })}
                      placeholder="465 or 587"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                    <p className="mt-1 text-xs text-gray-500">Usually 465 (SSL) or 587 (TLS). Leave empty for default.</p>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="smtp-secure"
                      checked={smtpConfig.secure}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, secure: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="smtp-secure" className="text-sm font-medium text-gray-700">Use SSL/TLS (secure)</label>
                  </div>
                  <div />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">User / Login</label>
                    <input
                      type="text"
                      value={smtpConfig.user}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, user: e.target.value })}
                      placeholder="your@email.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <input
                      type="password"
                      value={smtpConfig.password}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, password: e.target.value })}
                      placeholder="Leave blank to keep existing"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">From Email</label>
                    <input
                      type="email"
                      value={smtpConfig.fromEmail}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, fromEmail: e.target.value })}
                      placeholder="noreply@yourdomain.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">From Name</label>
                    <input
                      type="text"
                      value={smtpConfig.fromName}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, fromName: e.target.value })}
                      placeholder="POS Food"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-4">
                  <button type="submit" disabled={smtpSaving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                    {smtpSaving ? 'Saving...' : 'Save SMTP Configuration'}
                  </button>
                </div>
              </form>
            </div>

            {/* Test SMTP */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Test SMTP</h3>
                <p className="text-sm text-gray-600 mb-4">Send a test email to verify your SMTP settings. Save the configuration above first.</p>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Test email address</label>
                    <input
                      type="email"
                      value={testEmail}
                      onChange={(e) => { setTestEmail(e.target.value); setTestSmtpMessage(null); }}
                      placeholder="recipient@example.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={testSmtpLoading}
                    onClick={async () => {
                      if (!testEmail.trim()) {
                        setTestSmtpMessage({ type: 'error', text: 'Enter a test email address' });
                        return;
                      }
                      try {
                        setTestSmtpLoading(true);
                        setTestSmtpMessage(null);
                        await mastersApi.testSmtp(testEmail.trim());
                        setTestSmtpMessage({ type: 'success', text: 'Test email sent successfully. Check the inbox (and spam).' });
                      } catch (err: any) {
                        setTestSmtpMessage({ type: 'error', text: err?.message || 'Failed to send test email' });
                      } finally {
                        setTestSmtpLoading(false);
                      }
                    }}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    {testSmtpLoading ? 'Sending...' : 'Test SMTP'}
                  </button>
                </div>
                {testSmtpMessage && (
                  <p className={`mt-3 text-sm ${testSmtpMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                    {testSmtpMessage.text}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {showSsoForm &&
          createPortal(
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
              <button
                type="button"
                aria-label="Close"
                className="absolute inset-0 bg-black/50"
                onClick={() => {
                  setShowSsoForm(false);
                  setEditingItem(null);
                }}
              />
              <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[min(90vh,820px)] flex flex-col">
                <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {editingItem ? 'Edit SSO Provider' : 'Add SSO Provider'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSsoForm(false);
                      setEditingItem(null);
                    }}
                    className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
                    aria-label="Close dialog"
                  >
                    <i className="ri-close-line text-xl" />
                  </button>
                </div>
                <form onSubmit={handleSsoSubmit} className="flex flex-col flex-1 min-h-0">
                  <div className="flex-1 overflow-y-auto px-6 py-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Provider slug *</label>
                        <input
                          type="text"
                          value={ssoForm.provider}
                          onChange={(e) => setSsoForm({ ...ssoForm, provider: e.target.value })}
                          placeholder="refex-one"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                          required
                          disabled={Boolean(editingItem)}
                        />
                        <p className="mt-1 text-xs text-gray-500">Used in login URL.</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Display name *</label>
                        <input
                          type="text"
                          value={ssoForm.displayName}
                          onChange={(e) => setSsoForm({ ...ssoForm, displayName: e.target.value })}
                          placeholder="Refex One"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Sort order</label>
                        <input
                          type="number"
                          value={ssoForm.sortOrder}
                          onChange={(e) => setSsoForm({ ...ssoForm, sortOrder: Number(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                        />
                      </div>
                      <div className="flex items-center pt-7">
                        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={ssoForm.isActive}
                            onChange={(e) => setSsoForm({ ...ssoForm, isActive: e.target.checked })}
                          />
                          Active on login page
                        </label>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Icon URL</label>
                        <input
                          type="url"
                          value={ssoForm.iconUrl}
                          onChange={(e) => setSsoForm({ ...ssoForm, iconUrl: e.target.value })}
                          placeholder="https://example.com/icon.png"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Client ID *</label>
                        <input
                          type="text"
                          value={ssoForm.clientId}
                          onChange={(e) => setSsoForm({ ...ssoForm, clientId: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                          required
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Client Secret</label>
                        <input
                          type="password"
                          value={ssoForm.clientSecret}
                          onChange={(e) => setSsoForm({ ...ssoForm, clientSecret: e.target.value })}
                          placeholder={editingItem ? 'Leave blank to keep existing' : ''}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                          required={!editingItem}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Redirect URI</label>
                        <input
                          type="url"
                          value={ssoForm.redirectUri}
                          onChange={(e) => setSsoForm({ ...ssoForm, redirectUri: e.target.value })}
                          placeholder="https://your-api.com/api/employee-auth/sso/refex-one/callback"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Frontend base URL</label>
                        <input
                          type="url"
                          value={ssoForm.frontendBaseUrl}
                          onChange={(e) => setSsoForm({ ...ssoForm, frontendBaseUrl: e.target.value })}
                          placeholder="https://canteen.refex.group"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Discovery URL</label>
                        <input
                          type="url"
                          value={ssoForm.discoveryUrl}
                          onChange={(e) => setSsoForm({ ...ssoForm, discoveryUrl: e.target.value })}
                          placeholder="https://provider.com/.well-known/openid-configuration"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Authorization URL</label>
                        <input
                          type="url"
                          value={ssoForm.authorizationUrl}
                          onChange={(e) => setSsoForm({ ...ssoForm, authorizationUrl: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Token URL</label>
                        <input
                          type="url"
                          value={ssoForm.tokenUrl}
                          onChange={(e) => setSsoForm({ ...ssoForm, tokenUrl: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">UserInfo URL</label>
                        <input
                          type="url"
                          value={ssoForm.userInfoUrl}
                          onChange={(e) => setSsoForm({ ...ssoForm, userInfoUrl: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Scopes</label>
                        <input
                          type="text"
                          value={ssoForm.scopes}
                          onChange={(e) => setSsoForm({ ...ssoForm, scopes: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowSsoForm(false);
                        setEditingItem(null);
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={ssoSaving}
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                      {ssoSaving ? 'Saving...' : editingItem ? 'Update' : 'Create'}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body,
          )}

        {/* User Form Modal */}
        {showUserForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">
                  {editingItem ? 'Edit User' : 'Add New User'}
                </h2>
              </div>
              <form onSubmit={handleUserSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={userForm.name}
                    onChange={(e) => {
                      setUserForm({ ...userForm, name: e.target.value });
                      if (formErrors.name) setFormErrors({ ...formErrors, name: '' });
                    }}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
                      formErrors.name ? 'border-red-300' : 'border-gray-300'
                    }`}
                    required
                  />
                  {formErrors.name && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Username <span className="text-gray-500 text-xs">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={userForm.username}
                    onChange={(e) => {
                      setUserForm({ ...userForm, username: e.target.value });
                      if (formErrors.username) setFormErrors({ ...formErrors, username: '' });
                    }}
                    placeholder="e.g., john_doe"
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
                      formErrors.username ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {formErrors.username && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.username}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">Letters, numbers, dots, underscores, and hyphens only. Min 3 characters.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={userForm.email}
                    onChange={(e) => {
                      setUserForm({ ...userForm, email: e.target.value });
                      if (formErrors.email) setFormErrors({ ...formErrors, email: '' });
                    }}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
                      formErrors.email ? 'border-red-300' : 'border-gray-300'
                    }`}
                    required
                  />
                  {formErrors.email && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="password"
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    required={!editingItem}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value as 'admin' | 'user' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserForm(false);
                      setFormErrors({});
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : (editingItem ? 'Update' : 'Create')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
