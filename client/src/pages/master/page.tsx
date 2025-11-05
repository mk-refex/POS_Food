
import { useState, useEffect } from 'react';
import Layout from '../../components/feature/Layout';
import Pagination from '../../components/Pagination';
import { mastersApi, apiFetch } from '../../api/client';

interface Employee {
  id: number;
  employeeId: string;
  employeeName: string;
  companyName?: string;
  entity?: string;
  mobileNumber?: string;
  location?: string;
  qrCode?: string;
  createdBy: string;
  createdDate: string;
  isActive: boolean;
}

interface SupportStaff {
  id: number;
  staffId: string;
  name: string;
  designation?: string;
  companyName?: string;
  biometricData?: string;
  createdBy: string;
  createdDate: string;
  isActive: boolean;
}

interface PriceMaster {
  employee: {
    breakfast: number;
    lunch: number;
  };
  company: {
    breakfast: number;
    lunch: number;
  };
}

export default function Master() {
  const [activeTab, setActiveTab] = useState<'employee' | 'supportStaff' | 'price'>('employee');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editingSupportStaff, setEditingSupportStaff] = useState<SupportStaff | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [supportStaff, setSupportStaff] = useState<SupportStaff[]>([]);
  const [priceMaster, setPriceMaster] = useState<PriceMaster>({
    employee: { breakfast: 20, lunch: 48 },
    company: { breakfast: 135, lunch: 165 }
  });
  const [showImportModal, setShowImportModal] = useState(false);
  const [importType, setImportType] = useState<'employee' | 'supportStaff' | 'billing'>('employee');

  const [formData, setFormData] = useState({
    employeeId: '',
    employeeName: '',
    companyName: '',
    entity: '',
    mobileNumber: '',
    location: '',
    qrCode: ''
  });

  const [supportStaffFormData, setSupportStaffFormData] = useState({
    staffId: '',
    name: '',
    designation: '',
    companyName: '',
    biometricData: ''
  });

  

  const [companyNames, setCompanyNames] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [sortBy, setSortBy] = useState<'employeeName' | 'employeeId' | 'companyName' | 'createdDate'>('employeeName');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');
  const [search, setSearch] = useState('');
  const [totalCount, setTotalCount] = useState(0);

  // Load data from API
  useEffect(() => {
    loadMasterData();
  }, [page, limit, sortBy, sortOrder, search, activeTab]);

  const loadMasterData = async () => {
    try {
      setIsLoading(true);
      
      // Load employees with pagination/sort/filter
      const employeeRes = await mastersApi.getEmployees({ page, limit, sortBy, sortOrder, q: search });
      const employeeData = Array.isArray(employeeRes?.data) ? employeeRes.data : employeeRes;
      const employeeTotal = typeof employeeRes?.total === 'number' ? employeeRes.total : employeeData.length;
      setEmployees(employeeData);
      if (activeTab === 'employee') setTotalCount(employeeTotal);
      
      // Extract unique company names from employees
      const uniqueCompanies = Array.from(new Set(
        employeeData
          .map((emp: Employee) => emp.companyName)
          .filter((company: string | undefined): company is string => !!company && company.trim() !== '')
      ));
      setCompanyNames(uniqueCompanies as string[]);

      // Load support staff with pagination/sort/filter
      const staffRes = await mastersApi.getSupportStaff({ page, limit, sortBy: 'name', sortOrder, q: search });
      const supportStaffData = Array.isArray(staffRes?.data) ? staffRes.data : staffRes;
      const staffTotal = typeof staffRes?.total === 'number' ? staffRes.total : supportStaffData.length;
      setSupportStaff(supportStaffData);
      if (activeTab === 'supportStaff') setTotalCount(staffTotal);

      // Guests loading removed per request

      // Load price master
      const priceMasterData = await mastersApi.getPriceMaster();
      setPriceMaster(priceMasterData);
    } catch (error) {
      console.error('Error loading master data:', error);
      alert('Failed to load master data. Please refresh the page.');
    } finally {
      setIsLoading(false);
    }
  };

  // Update company names when employees change
  useEffect(() => {
    const uniqueCompanies = Array.from(new Set(
      employees
        .map((emp) => emp.companyName)
        .filter((company): company is string => !!company && company.trim() !== '')
    ));
    setCompanyNames(uniqueCompanies as string[]);
  }, [employees]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSupportStaffInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setSupportStaffFormData({
      ...supportStaffFormData,
      [e.target.name]: e.target.value
    });
  };

  // Guest handlers removed

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (activeTab === 'employee') {
        setFormData({ ...formData, qrCode: event.target?.result as string });
      } else {
        setSupportStaffFormData({ ...supportStaffFormData, biometricData: event.target?.result as string });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsLoading(true);

      if (activeTab === 'employee') {
        if (!formData.employeeId || !formData.employeeName) {
          alert('Employee ID and Employee Name are mandatory fields');
          return;
        }

        const newEmployee = await mastersApi.createEmployee(formData);
        setEmployees([...employees, newEmployee]);
        setFormData({
          employeeId: '',
          employeeName: '',
          companyName: '',
          entity: '',
          mobileNumber: '',
          location: '',
          qrCode: ''
        });
      } else if (activeTab === 'supportStaff') {
        if (!supportStaffFormData.staffId || !supportStaffFormData.name) {
          alert('Staff ID and Name are mandatory fields');
          return;
        }

        const newSupportStaff = await mastersApi.createSupportStaff(supportStaffFormData);
        setSupportStaff([...supportStaff, newSupportStaff]);
        setSupportStaffFormData({
          staffId: '',
          name: '',
          designation: '',
          companyName: '',
          biometricData: ''
        });
      }

      setShowAddForm(false);
    } catch (error: any) {
      console.error('Error creating record:', error);
      alert(error.message || 'Failed to create record');
    } finally {
      setIsLoading(false);
    }
  };

  const syncWithHRMS = async () => {
    setIsLoading(true);
    try {
      // Load API Config
      const apiCfg = await mastersApi.getApiConfig();
      const baseUrl = apiCfg?.baseUrl || '';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      };
      if (apiCfg?.accessToken) headers['Authorization'] = `Bearer ${apiCfg.accessToken}`;
      if (apiCfg?.apiKey) headers['x-api-key'] = apiCfg.apiKey;
      if (apiCfg?.headersJson) {
        try {
          const extra = JSON.parse(apiCfg.headersJson);
          Object.assign(headers, extra);
        } catch {}
      }

      // Call our server proxy with auth via apiFetch (adds token automatically)
      // Use /masters/hrms/employees/active instead of /admin/ for non-admin users
      const apiResponse = await apiFetch(`/masters/hrms/employees/active`);
      let hrmsEmployees: any[] = [];
      if (Array.isArray(apiResponse)) {
        hrmsEmployees = apiResponse;
      } else if (apiResponse && apiResponse.results) {
        hrmsEmployees = apiResponse.results;
      } else {
        throw new Error('Invalid response format from HRMS API');
      }
      // Best-effort pagination follow-up if the API provides meta info
      if ((apiResponse as any)?.meta?.total_pages && (apiResponse as any)?.meta?.current_page) {
        const total = Number((apiResponse as any).meta.total_pages) || 1;
        const current = Number((apiResponse as any).meta.current_page) || 1;
        for (let p = current + 1; p <= Math.min(total, 20); p++) {
          try {
            const pageJson = await apiFetch(`/masters/hrms/employees/active?page=${p}`);
            const pageResults = Array.isArray(pageJson) ? pageJson : pageJson?.results || [];
            hrmsEmployees.push(...pageResults);
          } catch {
            break;
          }
        }
      }

      const supportStaffDesignations = ['Driver', 'Office Assistant'];
      const newEmployees: Employee[] = [];
      const newSupportStaff: SupportStaff[] = [];

      hrmsEmployees.forEach((emp, index) => {
        try {
          const designation = emp.designation || '';
          const isSupport = supportStaffDesignations.some((d) =>
            designation.toLowerCase().includes(d.toLowerCase())
          );

          if (isSupport) {
            const supportItem: SupportStaff = {
              id: emp.id || `hrms-support-${Date.now()}-${index}`,
              staffId: emp.employee_id || '',
              name: emp.employee_name || '',
              designation: emp.designation || '',
              companyName: emp.company?.company_name || '',
              biometricData: emp.qr_code_image || '',
              createdBy: 'HRMS Sync',
              createdDate: new Date().toISOString().split('T')[0],
              isActive: true
            };
            newSupportStaff.push(supportItem);
          } else {
            const employeeItem: Employee = {
              id: emp.id || `hrms-${Date.now()}-${index}`,
              employeeId: emp.employee_id || '',
              employeeName: emp.employee_name || '',
              companyName: emp.company?.company_name || '',
              entity: emp.designation || '',
              mobileNumber: emp.mobile_number || '',
              location: emp.branch?.branch_name || '',
              qrCode: emp.qr_code_image || '',
              createdBy: 'HRMS Sync',
              createdDate: new Date().toISOString().split('T')[0],
              isActive: true
            };
            newEmployees.push(employeeItem);
          }
        } catch (e) {
          console.warn(`Error mapping HRMS record at index ${index}:`, e);
        }
      });

      const existingEmployeeIds = employees.map((e) => e.employeeId);
      const existingSupportIds = supportStaff.map((s) => s.staffId);

      const uniqueEmployees = newEmployees.filter(
        (e) => e.employeeId && !existingEmployeeIds.includes(e.employeeId)
      );
      const uniqueSupport = newSupportStaff.filter(
        (s) => s.staffId && !existingSupportIds.includes(s.staffId)
      );

      if (uniqueEmployees.length || uniqueSupport.length) {
        // Create employees via API
        for (const emp of uniqueEmployees) {
          try {
            await mastersApi.createEmployee({
              employeeId: emp.employeeId,
              employeeName: emp.employeeName,
              companyName: emp.companyName,
              entity: emp.entity,
              mobileNumber: emp.mobileNumber,
              location: emp.location,
              qrCode: emp.qrCode
            });
          } catch (error) {
            console.warn('Failed to create employee:', emp.employeeId, error);
          }
        }

        // Create support staff via API
        for (const staff of uniqueSupport) {
          try {
            await mastersApi.createSupportStaff({
              staffId: staff.staffId,
              name: staff.name,
              designation: staff.designation,
              companyName: staff.companyName,
              biometricData: staff.biometricData
            });
          } catch (error) {
            console.warn('Failed to create support staff:', staff.staffId, error);
          }
        }

        // Reload data from API
        await loadMasterData();
        
        alert(
          `✅ HRMS sync completed.\nNew Employees: ${uniqueEmployees.length}\nNew Support Staff: ${uniqueSupport.length}`
        );
      } else {
        alert('ℹ️ HRMS sync completed – no new records to add.');
      }
    } catch (error: any) {
      console.error('HRMS sync error:', error);
      let message = 'Failed to sync with HRMS.';
      if (error.message.includes('Network')) {
        message +=
          '\nNetwork issue or CORS restriction. Please ensure the API allows requests from this origin.';
      } else {
        message += `\n${error.message}`;
      }
      alert(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (item: Employee | SupportStaff) => {
    if (activeTab === 'employee') {
      const employee = item as Employee;
      setEditingEmployee(employee);
      setFormData({
        employeeId: employee.employeeId,
        employeeName: employee.employeeName,
        companyName: employee.companyName || '',
        entity: employee.entity || '',
        mobileNumber: employee.mobileNumber || '',
        location: employee.location || '',
        qrCode: employee.qrCode || ''
      });
    } else {
      const staff = item as SupportStaff;
      setEditingSupportStaff(staff);
      setSupportStaffFormData({
        staffId: staff.staffId,
        name: staff.name,
        designation: staff.designation || '',
        companyName: staff.companyName || '',
        biometricData: staff.biometricData || ''
      });
    }
    setShowEditForm(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsLoading(true);

      if (activeTab === 'employee' && editingEmployee) {
        if (!formData.employeeId || !formData.employeeName) {
          alert('Employee ID and Employee Name are mandatory fields');
          return;
        }

        const updatedEmployee = await mastersApi.updateEmployee(editingEmployee.id.toString(), formData);
        setEmployees(employees.map((e) => (e.id === editingEmployee.id ? updatedEmployee : e)));
        setEditingEmployee(null);
      } else if (activeTab === 'supportStaff' && editingSupportStaff) {
        if (!supportStaffFormData.staffId || !supportStaffFormData.name) {
          alert('Staff ID and Name are mandatory fields');
          return;
        }

        const updatedSupportStaff = await mastersApi.updateSupportStaff(editingSupportStaff.id.toString(), supportStaffFormData);
        setSupportStaff(supportStaff.map((s) => (s.id === editingSupportStaff.id ? updatedSupportStaff : s)));
        setEditingSupportStaff(null);
      }

      setShowEditForm(false);
      setFormData({
        employeeId: '',
        employeeName: '',
        companyName: '',
        entity: '',
        mobileNumber: '',
        location: '',
        qrCode: ''
      });
      setSupportStaffFormData({
        staffId: '',
        name: '',
        designation: '',
        companyName: '',
        biometricData: ''
      });
    } catch (error: any) {
      console.error('Error updating record:', error);
      alert(error.message || 'Failed to update record');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (item: Employee | SupportStaff) => {
    try {
      if (activeTab === 'employee') {
        const employee = item as Employee;
        if (confirm(`Delete employee "${employee.employeeName}"?`)) {
          await mastersApi.deleteEmployee(employee.id.toString());
          setEmployees(employees.filter((e) => e.id !== employee.id));
        }
      } else {
        const staff = item as SupportStaff;
        if (confirm(`Delete support staff "${staff.name}"?`)) {
          await mastersApi.deleteSupportStaff(staff.id.toString());
          setSupportStaff(supportStaff.filter((s) => s.id !== staff.id));
        }
      }
    } catch (error: any) {
      console.error('Error deleting record:', error);
      alert(error.message || 'Failed to delete record');
    }
  };

  const cancelEdit = () => {
    setEditingEmployee(null);
    setEditingSupportStaff(null);
    setShowEditForm(false);
    setFormData({
      employeeId: '',
      employeeName: '',
      companyName: '',
      entity: '',
      mobileNumber: '',
      location: '',
      qrCode: ''
    });
    setSupportStaffFormData({
      staffId: '',
      name: '',
      designation: '',
      companyName: '',
      biometricData: ''
    });
  };

  const handlePriceMasterChange = async (
    type: 'employee' | 'company',
    meal: 'breakfast' | 'lunch',
    value: number
  ) => {
    try {
      const updatedPriceMaster = {
        ...priceMaster,
        [type]: { ...priceMaster[type], [meal]: value }
      };
      
      await mastersApi.updatePriceMaster(updatedPriceMaster);
      setPriceMaster(updatedPriceMaster);
    } catch (error: any) {
      console.error('Error updating price master:', error);
      alert(error.message || 'Failed to update price master');
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const result = event.target?.result as ArrayBuffer | string;
        const name = file.name.toLowerCase();

        const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls');
        const isCsv = name.endsWith('.csv');

        let rows: string[][] = [];
        if (isExcel) {
          const { read, utils } = await import('xlsx');
          const wb = read(result, { type: typeof result === 'string' ? 'binary' : 'array' });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const json = utils.sheet_to_json<string[]>({ ...sheet }, { header: 1 });
          rows = (json as any[]).filter((r) => Array.isArray(r) && r.length);
        } else if (isCsv) {
          const text = typeof result === 'string' ? result : new TextDecoder().decode(new Uint8Array(result));
          rows = text.split('\n').map((line) => line.split(',').map((v) => v.trim()));
        } else {
          alert('Unsupported file format. Please upload .xlsx, .xls or .csv');
          return;
        }

        // first row is headers but not used directly; keeping for potential validation
        // const headers = rows[0].map((h) => String(h).trim());

        if (importType === 'employee') {
          const newEmployees: Employee[] = [];
          for (let i = 1; i < rows.length; i++) {
            const values = rows[i].map((v) => String(v).trim());
            if (values.length >= 2 && values[0] && values[1]) {
              const record = {
                employeeId: values[0],
                employeeName: values[1],
                companyName: values[2] || '',
                entity: values[3] || '',
                mobileNumber: values[4] || '',
                location: values[5] || '',
                qrCode: values[6] || '',
              };
              newEmployees.push(record as any);
            }
          }
          // Bulk create via API sequentially (simple). Can be optimized later.
          let created = 0;
          for (const emp of newEmployees) {
            try { await mastersApi.createEmployee(emp); created++; } catch {}
          }
          await loadMasterData();
          alert(`Imported ${created} employees`);
        } else if (importType === 'supportStaff') {
          const newStaff: SupportStaff[] = [];
          for (let i = 1; i < rows.length; i++) {
            const values = rows[i].map((v) => String(v).trim());
            if (values.length >= 2 && values[0] && values[1]) {
              const record = {
                staffId: values[0],
                name: values[1],
                designation: values[2] || '',
                companyName: values[3] || '',
                biometricData: values[4] || '',
              };
              newStaff.push(record as any);
            }
          }
          let created = 0;
          for (const s of newStaff) {
            try { await mastersApi.createSupportStaff(s); created++; } catch {}
          }
          await loadMasterData();
          alert(`Imported ${created} support staff`);
        } else if (importType === 'billing') {
          const newBills: any[] = [];
          for (let i = 1; i < rows.length; i++) {
            const values = rows[i].map((v) => String(v).trim());
            if (values.length >= 10) {
              newBills.push({
                id: Date.now().toString() + i,
                date: values[0],
                time: values[1],
                isGuest: values[2].toLowerCase() === 'true',
                isSupportStaff: values[3].toLowerCase() === 'true',
                customer: {
                  employeeId: values[4],
                  employeeName: values[5],
                  companyName: values[6] || ''
                },
                items: [
                  {
                    id: '1',
                    name: 'Breakfast',
                    quantity: parseInt(values[7]) || 0,
                    price: 0,
                    category: 'Breakfast'
                  },
                  {
                    id: '2',
                    name: 'Lunch',
                    quantity: parseInt(values[8]) || 0,
                    price: 0,
                    category: 'Lunch'
                  }
                ].filter((it) => it.quantity > 0),
                totalItems:
                  (parseInt(values[7]) || 0) + (parseInt(values[8]) || 0),
                totalAmount: parseFloat(values[9]) || 0
              });
            }
          }
          if (newBills.length) {
            const existingBills = JSON.parse(localStorage.getItem('billingHistory') || '[]');
            localStorage.setItem('billingHistory', JSON.stringify([...existingBills, ...newBills]));
            alert(`Imported ${newBills.length} billing records`);
          }
        }

        setShowImportModal(false);
      } catch (err) {
        console.error('Import error:', err);
        alert('Error importing file. Please verify format.');
      }
    };
    if (file.name.toLowerCase().endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Master Data</h1>
          <div className="flex space-x-3">
            <div className="hidden md:flex items-center space-x-2 bg-white border border-gray-300 rounded-lg px-3 py-2">
              <i className="ri-search-line text-gray-400"></i>
              <input
                value={search}
                onChange={(e) => { setPage(1); setSearch(e.target.value); }}
                placeholder={`Search ${activeTab === 'employee' ? 'employee' : 'support staff'}...`}
                className="outline-none text-sm w-56"
              />
            </div>
            <button
              onClick={() => setShowImportModal(true)}
              className="bg-orange-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-orange-700 transition-colors whitespace-nowrap flex items-center"
            >
              <i className="ri-upload-line mr-2"></i>
              Import Data
            </button>
            {activeTab !== 'price' && (
              <button
                onClick={syncWithHRMS}
                disabled={isLoading}
                className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors whitespace-nowrap flex items-center disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <i className="ri-loader-4-line mr-2 animate-spin"></i>
                    Syncing...
                  </>
                ) : (
                  <>
                    <i className="ri-refresh-line mr-2"></i>
                    Sync HRMS
                  </>
                )}
              </button>
            )}
            {activeTab !== 'price' && (
              <button
                onClick={() => {
                  setShowAddForm(true);
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors whitespace-nowrap flex items-center"
              >
                <i className="ri-add-line mr-2"></i>
                Add {activeTab === 'employee' ? 'Employee' : 'Support Staff'}
              </button>
            )}
          </div>
        </div>

        {/* Import Modal */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-800">Import Data</h2>
                <button onClick={() => setShowImportModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <i className="ri-close-line text-xl"></i>
                </button>
              </div>
              <div className="p-6 space-y-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Import Type
                </label>
                <select
                  value={importType}
                  onChange={(e) => setImportType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="employee">Employee Data</option>
                  <option value="supportStaff">Support Staff Data</option>
                  <option value="billing">Billing History</option>
                </select>

                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CSV File
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleImport}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    {importType === 'employee' &&
                      'CSV Format: Employee ID, Employee Name, Company Name, Entity, Mobile Number, Location, QR Code'}
                    {importType === 'supportStaff' &&
                      'CSV Format: Staff ID, Name, Designation, Company Name, Biometric Data'}
                    {importType === 'billing' &&
                      'CSV Format: Date, Time, Is Guest, Is Support Staff, Employee ID, Employee Name, Company Name, Breakfast Count, Lunch Count, Total Amount'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('employee')}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'employee'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <i className="ri-user-line mr-2"></i>
                Employee Master
              </button>
              <button
                onClick={() => setActiveTab('supportStaff')}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'supportStaff'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <i className="ri-tools-line mr-2"></i>
                Support Staff Master
              </button>
              <button
                onClick={() => setActiveTab('price')}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'price'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <i className="ri-money-rupee-circle-line mr-2"></i>
                Price Master
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          {activeTab === 'price' ? (
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Price Configuration</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Employee Pricing */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">
                    <i className="ri-user-line mr-2"></i>
                    Employee Pricing
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Breakfast Price (₹)
                      </label>
                      <input
                        type="number"
                        value={priceMaster.employee.breakfast}
                        onChange={(e) =>
                          handlePriceMasterChange('employee', 'breakfast', parseFloat(e.target.value) || 0)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Lunch Price (₹)
                      </label>
                      <input
                        type="number"
                        value={priceMaster.employee.lunch}
                        onChange={(e) =>
                          handlePriceMasterChange('employee', 'lunch', parseFloat(e.target.value) || 0)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                </div>

                {/* Company/Guest Pricing */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-green-900 mb-4 flex items-center">
                    <i className="ri-building-line mr-2"></i>
                    Company/Guest Pricing
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Breakfast Price (₹)
                      </label>
                      <input
                        type="number"
                        value={priceMaster.company.breakfast}
                        onChange={(e) =>
                          handlePriceMasterChange('company', 'breakfast', parseFloat(e.target.value) || 0)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Lunch Price (₹)
                      </label>
                      <input
                        type="number"
                        value={priceMaster.company.lunch}
                        onChange={(e) =>
                          handlePriceMasterChange('company', 'lunch', parseFloat(e.target.value) || 0)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start">
                  <i className="ri-information-line text-yellow-600 text-xl mr-3 mt-0.5"></i>
                  <div>
                    <h4 className="font-semibold text-yellow-800 mb-2">Price Master Information</h4>
                    <ul className="text-sm text-yellow-700 space-y-1">
                      <li>• Employee pricing applies to regular employees and support staff</li>
                      <li>• Company pricing applies to guests and external visitors</li>
                      <li>• Price changes will automatically apply to new billing transactions</li>
                      <li>• Historical billing data will maintain original pricing</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* List Controls removed (sorting via headers) */}
              {/* Add / Edit Modal */}
              {(showAddForm || showEditForm) && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                    <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                      <h2 className="text-xl font-semibold text-gray-800">
                        {showEditForm ? 'Edit' : 'Add New'}{' '}
                        {activeTab === 'employee' ? 'Employee' : 'Support Staff'}
                      </h2>
                      <button
                        onClick={() => {
                          setShowAddForm(false);
                          setShowEditForm(false);
                          cancelEdit();
                        }}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                      >
                        <i className="ri-close-line text-xl"></i>
                      </button>
                    </div>

                    <form onSubmit={showEditForm ? handleUpdate : handleSubmit} className="p-6 space-y-4">
                      {activeTab === 'employee' ? (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Employee ID *
                              </label>
                              <input
                                type="text"
                                name="employeeId"
                                value={formData.employeeId}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                required
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Employee Name *
                              </label>
                              <input
                                type="text"
                                name="employeeName"
                                value={formData.employeeName}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                required
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Company Name
                              </label>
                              <input
                                type="text"
                                name="companyName"
                                value={formData.companyName}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Designation
                              </label>
                              <input
                                type="text"
                                name="entity"
                                value={formData.entity}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Mobile Number
                              </label>
                              <input
                                type="tel"
                                name="mobileNumber"
                                value={formData.mobileNumber}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Location
                              </label>
                              <input
                                type="text"
                                name="location"
                                value={formData.location}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                          </div>

                          {/* QR Code Upload */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              QR Code Image
                            </label>
                            <div className="flex items-center space-x-4">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                              {formData.qrCode && (
                                <div className="w-16 h-16 border border-gray-300 rounded-lg overflow-hidden">
                                  <img src={formData.qrCode} alt="QR Preview" className="w-full h-full object-cover" />
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Staff ID *
                              </label>
                              <input
                                type="text"
                                name="staffId"
                                value={supportStaffFormData.staffId}
                                onChange={handleSupportStaffInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                required
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Name *
                              </label>
                              <input
                                type="text"
                                name="name"
                                value={supportStaffFormData.name}
                                onChange={handleSupportStaffInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                required
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Designation
                              </label>
                              <select
                                name="designation"
                                value={supportStaffFormData.designation}
                                onChange={handleSupportStaffInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              >
                                <option value="">Select designation...</option>
                                <option value="Driver">Driver</option>
                                <option value="Office Assistant">Office Assistant</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Company Name
                              </label>
                              {companyNames.length > 0 ? (
                                <select
                                  name="companyName"
                                  value={supportStaffFormData.companyName}
                                  onChange={handleSupportStaffInputChange}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                >
                                  <option value="">Select company...</option>
                                  {companyNames.map((c, i) => (
                                    <option key={i} value={c}>
                                      {c}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  name="companyName"
                                  value={supportStaffFormData.companyName}
                                  onChange={handleSupportStaffInputChange}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                />
                              )}
                            </div>
                          </div>

                          {/* Biometric Data Upload */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Biometric Data / QR Code
                            </label>
                            <div className="flex items-center space-x-4">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              />
                              {supportStaffFormData.biometricData && (
                                <div className="w-16 h-16 border border-gray-300 rounded-lg overflow-hidden">
                                  <img src={supportStaffFormData.biometricData} alt="Biometric Preview" className="w-full h-full object-cover" />
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      )}

                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <p className="text-sm text-yellow-800">
                          <i className="ri-information-line mr-1"></i>
                          {activeTab === 'employee'
                            ? 'Only Employee ID and Employee Name are mandatory.'
                            : 'Only Staff ID and Name are mandatory.'}
                        </p>
                      </div>

                      <div className="flex justify-end space-x-3 pt-4">
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddForm(false);
                            setShowEditForm(false);
                            cancelEdit();
                          }}
                          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className={`px-4 py-2 text-white rounded-lg ${
                            showEditForm
                              ? 'bg-green-600 hover:bg-green-700'
                              : activeTab === 'employee'
                              ? 'bg-blue-600 hover:bg-blue-700'
                              : 'bg-purple-600 hover:bg-purple-700'
                          }`}
                        >
                          {showEditForm ? 'Update' : 'Add'}{' '}
                          {activeTab === 'employee' ? 'Employee' : 'Support Staff'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Data Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      {activeTab === 'employee' ? (
                        <>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            QR Code
                          </th>
                          <th
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                            onClick={() => {
                              const next = sortBy === 'employeeId' && sortOrder === 'ASC' ? 'DESC' : 'ASC';
                              setSortBy('employeeId');
                              setSortOrder(sortBy === 'employeeId' ? next as any : 'ASC');
                            }}
                          >
                            Employee ID * {sortBy === 'employeeId' ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}
                          </th>
                          <th
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                            onClick={() => {
                              const next = sortBy === 'employeeName' && sortOrder === 'ASC' ? 'DESC' : 'ASC';
                              setSortBy('employeeName');
                              setSortOrder(sortBy === 'employeeName' ? next as any : 'ASC');
                            }}
                          >
                            Employee Name * {sortBy === 'employeeName' ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}
                          </th>
                          <th
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                            onClick={() => {
                              const next = sortBy === 'companyName' && sortOrder === 'ASC' ? 'DESC' : 'ASC';
                              setSortBy('companyName');
                              setSortOrder(sortBy === 'companyName' ? next as any : 'ASC');
                            }}
                          >
                            Company Name {sortBy === 'companyName' ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}
                          </th>
                          <th
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                            onClick={() => {
                              const next = sortBy === 'employeeName' && sortOrder === 'ASC' ? 'DESC' : 'ASC';
                              setSortBy('employeeName');
                              setSortOrder(sortBy === 'employeeName' ? next : 'ASC');
                            }}
                          >
                            Designation
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Mobile Number
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Location
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Created By
                          </th>
                          <th
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                            onClick={() => {
                              const next = sortBy === 'createdDate' && sortOrder === 'ASC' ? 'DESC' : 'ASC';
                              setSortBy('createdDate');
                              setSortOrder(sortBy === 'createdDate' ? next as any : 'ASC');
                            }}
                          >
                            Created Date {sortBy === 'createdDate' ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </>
                      ) : (
                        <>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Biometric Data
                          </th>
                          <th
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                            onClick={() => {
                              const next = (sortBy as any) === 'staffId' && sortOrder === 'ASC' ? 'DESC' : 'ASC';
                              setSortBy('staffId' as any);
                              setSortOrder((sortBy as any) === 'staffId' ? (next as any) : 'ASC');
                            }}
                          >
                            Staff ID * {(sortBy as any) === 'staffId' ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}
                          </th>
                          <th
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                            onClick={() => {
                              const next = (sortBy as any) === 'name' && sortOrder === 'ASC' ? 'DESC' : 'ASC';
                              setSortBy('name' as any);
                              setSortOrder((sortBy as any) === 'name' ? (next as any) : 'ASC');
                            }}
                          >
                            Name * {(sortBy as any) === 'name' ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}
                          </th>
                          <th
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                            onClick={() => {
                              const next = (sortBy as any) === 'designation' && sortOrder === 'ASC' ? 'DESC' : 'ASC';
                              setSortBy('designation' as any);
                              setSortOrder((sortBy as any) === 'designation' ? (next as any) : 'ASC');
                            }}
                          >
                            Designation {(sortBy as any) === 'designation' ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}
                          </th>
                          <th
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                            onClick={() => {
                              const next = (sortBy as any) === 'companyName' && sortOrder === 'ASC' ? 'DESC' : 'ASC';
                              setSortBy('companyName' as any);
                              setSortOrder((sortBy as any) === 'companyName' ? (next as any) : 'ASC');
                            }}
                          >
                            Company Name {(sortBy as any) === 'companyName' ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Created By
                          </th>
                          <th
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                            onClick={() => {
                              const next = (sortBy as any) === 'createdDate' && sortOrder === 'ASC' ? 'DESC' : 'ASC';
                              setSortBy('createdDate' as any);
                              setSortOrder((sortBy as any) === 'createdDate' ? (next as any) : 'ASC');
                            }}
                          >
                            Created Date {(sortBy as any) === 'createdDate' ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {activeTab === 'employee' ? (
                      employees.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="px-6 py-8 text-center text-gray-500">
                            No employees found. Add employees manually or sync with HRMS.
                          </td>
                        </tr>
                      ) : (
                        employees.map((employee) => (
                          <tr key={employee.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              {employee.qrCode ? (
                                <div className="w-10 h-10 border border-gray-300 rounded-lg overflow-hidden">
                                  <img src={employee.qrCode} alt="QR" className="w-full h-full object-cover" />
                                </div>
                              ) : (
                                <div className="w-10 h-10 bg-gray-100 border border-gray-300 rounded-lg flex items-center justify-center">
                                  <i className="ri-qr-code-line text-gray-400"></i>
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {employee.employeeId}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {employee.employeeName}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {employee.companyName || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {employee.entity || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {employee.mobileNumber || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {employee.location || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {employee.createdBy}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {employee.createdDate}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleEdit(employee)}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                                  title="Edit Employee"
                                >
                                  <i className="ri-edit-line"></i>
                                </button>
                                <button
                                  onClick={() => handleDelete(employee)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                  title="Delete Employee"
                                >
                                  <i className="ri-delete-bin-line"></i>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )
                    ) : supportStaff.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                          No support staff found. Add support staff manually or sync with HRMS.
                        </td>
                      </tr>
                    ) : (
                      supportStaff.map((staff) => (
                        <tr key={staff.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            {staff.biometricData ? (
                              <div className="w-12 h-12 border border-gray-300 rounded-lg overflow-hidden">
                                <img src={staff.biometricData} alt="Biometric" className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="w-12 h-12 bg-purple-100 border border-purple-300 rounded-lg flex items-center justify-center">
                                <i className="ri-fingerprint-line text-purple-400"></i>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {staff.staffId}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {staff.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {staff.designation || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {staff.companyName || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {staff.createdBy}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {staff.createdDate}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleEdit(staff)}
                                className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg"
                                title="Edit Support Staff"
                              >
                                <i className="ri-edit-line"></i>
                              </button>
                              <button
                                onClick={() => handleDelete(staff)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                title="Delete Support Staff"
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

              {/* Pagination */}
              <Pagination
                totalItems={totalCount}
                currentPage={page}
                itemsPerPage={limit}
                onPageChange={(p) => setPage(Math.max(1, p))}
                onItemsPerPageChange={(l) => { setPage(1); setLimit(l); }}
              />
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
