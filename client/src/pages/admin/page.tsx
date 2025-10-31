import { useState, useEffect } from 'react';
import Layout from '../../components/feature/Layout';
import Pagination from '../../components/Pagination';
import { apiFetch, isAdmin, mastersApi } from '../../api/client';

interface User {
  id: number;
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

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<'users'>('users');
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
    email: '',
    password: '',
    name: '',
    role: 'user' as 'admin' | 'user'
  });

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
    try {
      setLoading(true);
      setError('');
      
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
      setUserForm({ email: '', password: '', name: '', role: 'user' });
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to save user');
    } finally {
      setLoading(false);
    }
  };

  // company submit removed

  // HRMS removed
  // const handleHrmsSubmit = async (e: React.FormEvent) => { /* removed */ };

  const handleDelete = async (type: 'user', id: number) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    
    try {
      setLoading(true);
      setError('');
      
      await apiFetch(`/admin/${type + 's'}/${id}`, {
        method: 'DELETE'
      });
      
      setSuccess(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully`);
      loadData();
    } catch (err: any) {
      setError(err.message || `Failed to delete ${type}`);
    } finally {
      setLoading(false);
    }
  };

  // HRMS removed
  // const handleTestConnection = async (id: number) => { /* removed */ };

  const editItem = (item: any, type: 'user') => {
    setEditingItem(item);
    
    if (type === 'user') {
      setUserForm({
        email: item.email,
        password: '',
        name: item.name,
        role: item.role
      });
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
                { id: 'api', label: 'API Config', icon: 'ri-settings-3-line' }
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
                  setUserForm({ email: '', password: '', name: '', role: 'user' });
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
                    onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    required
                  />
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
                    onClick={() => setShowUserForm(false)}
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
