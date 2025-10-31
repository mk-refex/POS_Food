import { useState, useEffect } from 'react';
import Layout from '../../components/feature/Layout';
import { apiFetch } from '../../api/client';

interface Transaction {
  id: number;
  customerType: 'employee' | 'guest' | 'supportStaff';
  customerName?: string;
  companyName?: string;
  date: string;
  time: string;
  items: Array<{
    name: string;
    quantity: number;
    isException?: boolean;
    actualPrice: number;
  }>;
  totalItems: number;
  totalAmount: number;
}

// DashboardStats interface removed as widgets are no longer used

export default function Dashboard() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [stats, setStats] = useState({
    breakfast: {
      employee: 0,
      supportStaff: 0,
      guest: 0,
      total: 0
    },
    lunch: {
      employee: 0,
      supportStaff: 0,
      guest: 0,
      total: 0
    }
  });
  const [companyWiseData, setCompanyWiseData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Load dashboard data on component mount
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async (overrideStart?: string, overrideEnd?: string) => {
    try {
      setLoading(true);
      setError('');
      
      // Load transactions
      const params = new URLSearchParams();
      const s = overrideStart !== undefined ? overrideStart : startDate;
      const e = overrideEnd !== undefined ? overrideEnd : endDate;
      if (s) params.set('startDate', s);
      if (e) params.set('endDate', e);
      const transactions = await apiFetch(`/transactions?${params.toString()}`);
      
      // Filter by date range if specified
      let filteredTransactions = transactions;
      if (s) {
        filteredTransactions = filteredTransactions.filter((txn: Transaction) => txn.date >= s);
      }
      if (e) {
        filteredTransactions = filteredTransactions.filter((txn: Transaction) => txn.date <= e);
      }

      // Calculate breakfast and lunch stats
      let breakfastEmployee = 0, breakfastSupportStaff = 0, breakfastGuest = 0;
      let lunchEmployee = 0, lunchSupportStaff = 0, lunchGuest = 0;
      const companyStats: { [key: string]: { breakfast: number; lunch: number; total: number } } = {};

      filteredTransactions.forEach((txn: Transaction) => {
        const breakfastItems = txn.items
          .filter(item => item.name === 'Breakfast')
          .reduce((sum, item) => sum + item.quantity, 0);
        const lunchItems = txn.items
          .filter(item => item.name === 'Lunch')
          .reduce((sum, item) => sum + item.quantity, 0);
        
        if (txn.customerType === 'guest') {
          breakfastGuest += breakfastItems;
          lunchGuest += lunchItems;
        } else if (txn.customerType === 'supportStaff') {
          breakfastSupportStaff += breakfastItems;
          lunchSupportStaff += lunchItems;
        } else {
          breakfastEmployee += breakfastItems;
          lunchEmployee += lunchItems;
        }

        // Company-wise statistics
        const companyName = txn.companyName || 'Unknown Company';

        if (!companyStats[companyName]) {
          companyStats[companyName] = { breakfast: 0, lunch: 0, total: 0 };
        }

        companyStats[companyName].breakfast += breakfastItems;
        companyStats[companyName].lunch += lunchItems;
        companyStats[companyName].total += breakfastItems + lunchItems;
      });

      // Update stats
      setStats({
        breakfast: {
          employee: breakfastEmployee,
          supportStaff: breakfastSupportStaff,
          guest: breakfastGuest,
          total: breakfastEmployee + breakfastSupportStaff + breakfastGuest
        },
        lunch: {
          employee: lunchEmployee,
          supportStaff: lunchSupportStaff,
          guest: lunchGuest,
          total: lunchEmployee + lunchSupportStaff + lunchGuest
        }
      });

      // Convert company stats to array
      const companyArray = Object.entries(companyStats).map(([name, data]) => ({
        name,
        breakfast: data.breakfast,
        lunch: data.lunch,
        total: data.total
      })).sort((a, b) => b.total - a.total); // Sort by total consumption

      setCompanyWiseData(companyArray);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDateFilter = () => {
    loadDashboardData();
  };

  const resetFilters = () => {
    setStartDate('');
    setEndDate('');
    // Immediately reload with empty filters, independent of async state updates
    loadDashboardData('', '');
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <i className="ri-loader-4-line text-4xl text-blue-600 animate-spin mb-4"></i>
            <p className="text-gray-600">Loading dashboard data...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">Overview of your POS system analytics</p>
          </div>
          
          {/* Date Filter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700 whitespace-nowrap">From:</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm w-full sm:w-auto"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700 whitespace-nowrap">To:</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm w-full sm:w-auto"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleDateFilter}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center flex-1 sm:flex-none"
                >
                  <i className="ri-filter-line mr-2"></i>
                  Filter
                </button>
                <button
                  onClick={resetFilters}
                  className="bg-gray-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-600 transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center flex-1 sm:flex-none"
                >
                  <i className="ri-refresh-line mr-2"></i>
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center">
              <i className="ri-error-warning-line text-red-600 mr-2"></i>
              <p className="text-red-800 font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* System Stats Cards - REMOVED */}
        {/* The Total Users, Invoices, and Reports widgets have been removed as requested */}

        {/* Stats Cards - Updated with Support Staff */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 sm:gap-6">
          {/* Breakfast Employee */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">Breakfast</p>
                <p className="text-xs text-gray-500 mb-2">Employee</p>
                <p className="text-2xl sm:text-3xl font-bold text-orange-600">{stats.breakfast.employee}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <i className="ri-restaurant-line text-2xl text-orange-600"></i>
              </div>
            </div>
          </div>

          {/* Breakfast Support Staff */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">Breakfast</p>
                <p className="text-xs text-gray-500 mb-2">Support Staff</p>
                <p className="text-2xl sm:text-3xl font-bold text-purple-600">{stats.breakfast.supportStaff}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <i className="ri-tools-line text-2xl text-purple-600"></i>
              </div>
            </div>
          </div>

          {/* Breakfast Guest */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">Breakfast</p>
                <p className="text-xs text-gray-500 mb-2">Guest</p>
                <p className="text-2xl sm:text-3xl font-bold text-orange-500">{stats.breakfast.guest}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <i className="ri-user-line text-2xl text-orange-500"></i>
              </div>
            </div>
          </div>

          {/* Lunch Employee */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">Lunch</p>
                <p className="text-xs text-gray-500 mb-2">Employee</p>
                <p className="text-2xl sm:text-3xl font-bold text-green-600">{stats.lunch.employee}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <i className="ri-bowl-line text-2xl text-green-600"></i>
              </div>
            </div>
          </div>

          {/* Lunch Support Staff */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">Lunch</p>
                <p className="text-xs text-gray-500 mb-2">Support Staff</p>
                <p className="text-2xl sm:text-3xl font-bold text-purple-500">{stats.lunch.supportStaff}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <i className="ri-tools-line text-2xl text-purple-500"></i>
              </div>
            </div>
          </div>

          {/* Lunch Guest */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">Lunch</p>
                <p className="text-xs text-gray-500 mb-2">Guest</p>
                <p className="text-2xl sm:text-3xl font-bold text-green-500">{stats.lunch.guest}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <i className="ri-user-line text-2xl text-green-500"></i>
              </div>
            </div>
          </div>
        </div>

        {/* Company Wise Count */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Company Wise Count</h2>
            <p className="text-sm text-gray-600 mt-1">Breakdown of consumption by company</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company Name
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Breakfast
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lunch
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {companyWiseData.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 sm:px-6 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <i className="ri-bar-chart-line text-4xl text-gray-300 mb-3"></i>
                        <p className="text-gray-500 font-medium">No data available</p>
                        <p className="text-sm text-gray-400 mt-1">Start billing to see company-wise consumption</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  companyWiseData.map((company, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 sm:px-6 py-4 text-sm font-medium text-gray-900">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                            <i className="ri-building-line text-blue-600"></i>
                          </div>
                          <span className="truncate">{company.name}</span>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          {company.breakfast}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {company.lunch}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {company.total}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary Cards - Updated with Support Staff */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Total Breakfast */}
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-orange-100 text-sm font-medium mb-1">Total Breakfast Consumed</p>
                <p className="text-3xl sm:text-4xl font-bold mb-2">{stats.breakfast.total}</p>
                <div className="flex items-center text-orange-100 text-sm">
                  <i className="ri-group-line mr-2"></i>
                  <span>Employee + Support Staff + Guest</span>
                </div>
              </div>
              <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
                <i className="ri-restaurant-line text-3xl"></i>
              </div>
            </div>
          </div>

          {/* Total Lunch */}
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-green-100 text-sm font-medium mb-1">Total Lunch Consumed</p>
                <p className="text-3xl sm:text-4xl font-bold mb-2">{stats.lunch.total}</p>
                <div className="flex items-center text-green-100 text-sm">
                  <i className="ri-group-line mr-2"></i>
                  <span>Employee + Support Staff + Guest</span>
                </div>
              </div>
              <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
                <i className="ri-bowl-line text-3xl"></i>
              </div>
            </div>
          </div>

          {/* Support Staff Summary */}
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-purple-100 text-sm font-medium mb-1">Support Staff Total</p>
                <p className="text-3xl sm:text-4xl font-bold mb-2">{stats.breakfast.supportStaff + stats.lunch.supportStaff}</p>
                <div className="flex items-center text-purple-100 text-sm">
                  <i className="ri-tools-line mr-2"></i>
                  <span>Breakfast + Lunch</span>
                </div>
              </div>
              <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
                <i className="ri-tools-line text-3xl"></i>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}