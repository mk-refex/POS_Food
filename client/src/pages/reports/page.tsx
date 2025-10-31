import { useState, useEffect } from "react";
import Layout from "../../components/feature/Layout";
import { apiFetch, mastersApi } from "../../api/client";

// Align client types with server's /transactions response
interface TransactionRecord {
  id: number | string;
  customerType: "employee" | "guest" | "supportStaff";
  customerId?: string | null;
  customerName?: string | null;
  companyName?: string | null;
  date: string;
  time: string;
  items: Array<{
    id?: string;
    name: string;
    quantity: number;
    isException?: boolean;
    actualPrice: number;
  }>;
  totalItems: number;
  totalAmount: number;
}

interface CompanyReport {
  companyName: string;
  totalEmployees: number;
  totalTransactions: number;
  breakfast: number;
  lunch: number;
  totalItems: number;
  totalAmount: number;
  employees: string[];
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

export default function Reports() {
  const [activeTab, setActiveTab] = useState("employee");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedSupportStaff, setSelectedSupportStaff] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("");
  const [reportData, setReportData] = useState<any[]>([]);
  const [supportStaffReportData, setSupportStaffReportData] = useState<any[]>(
    []
  );
  const [companyReportData, setCompanyReportData] = useState<CompanyReport[]>(
    []
  );
  const [employees, setEmployees] = useState<any[]>([]);
  const [supportStaff, setSupportStaff] = useState<any[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [priceMaster, setPriceMaster] = useState<PriceMaster>({
    employee: { breakfast: 20, lunch: 48 },
    company: { breakfast: 135, lunch: 165 }
  });
  const [summaryStats, setSummaryStats] = useState({
    totalBreakfast: 0,
    totalLunch: 0,
    totalAmount: 0,
  });
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('ASC');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Load data on component mount
  useEffect(() => {
    loadReportData();
    loadEmployees();
    loadSupportStaff();
    loadPriceMaster();
  }, []);

  const loadEmployees = async () => {
    try {
      const pageSize = 1000;
      let page = 1;
      let all: any[] = [];
      while (true) {
        const res = await mastersApi.getEmployees({ page, limit: pageSize, sortBy: 'employeeName', sortOrder: 'ASC' });
        const list = (Array.isArray((res as any)?.data) ? (res as any).data : res) as any[];
        all = all.concat(list);
        if (!list || list.length < pageSize) break;
        page += 1;
        if (page > 50) break; // safety guard
      }
      setEmployees(all);

      // Extract unique company names
      const uniqueCompanies = [
        ...new Set(
          all.map((emp: any) => emp.companyName).filter(Boolean)
        ),
      ];
      setCompanies(uniqueCompanies);
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  };

  const loadSupportStaff = async () => {
    try {
      const pageSize = 1000;
      let page = 1;
      let all: any[] = [];
      while (true) {
        const res = await mastersApi.getSupportStaff({ page, limit: pageSize, sortBy: 'name', sortOrder: 'ASC' });
        const list = (Array.isArray((res as any)?.data) ? (res as any).data : res) as any[];
        all = all.concat(list);
        if (!list || list.length < pageSize) break;
        page += 1;
        if (page > 50) break; // safety guard
      }
      setSupportStaff(all);
    } catch (error) {
      console.error('Error loading support staff:', error);
    }
  };

  const loadPriceMaster = async () => {
    try {
      const priceMasterData = await mastersApi.getPriceMaster();
      setPriceMaster(priceMasterData);
    } catch (error) {
      console.error('Error loading price master:', error);
    }
  };

  const loadReportData = async () => {
    try {
      const bills: TransactionRecord[] = await apiFetch("/transactions");

      // Process transactions into employee report format (employees and guests only)
      const employeeData = bills
        .filter((bill) => bill.customerType === "employee" || bill.customerType === "guest")
        .map((bill) => {
          const breakfastItems = bill.items
            .filter((item) => item.name === "Breakfast")
            .reduce((sum, item) => sum + item.quantity, 0);
          const lunchItems = bill.items
            .filter((item) => item.name === "Lunch")
            .reduce((sum, item) => sum + item.quantity, 0);

          const isGuest = bill.customerType === "guest";
          return {
            id: bill.id,
            employeeId: isGuest ? "GUEST" : bill.customerId || "N/A",
            employeeName: isGuest ? bill.customerName || "Unknown Guest" : bill.customerName || "Unknown",
            company: bill.companyName || "N/A",
            date: bill.date,
            time: bill.time,
            breakfast: breakfastItems,
            lunch: lunchItems,
            totalItems: bill.totalItems,
            amount: bill.totalAmount,
            isGuest,
          };
        });

      setReportData(employeeData);

      // Process support staff report (ONLY support staff)
      const supportStaffData = bills
        .filter((bill) => bill.customerType === "supportStaff")
        .map((bill) => {
          const breakfastItems = bill.items
            .filter((item) => item.name === "Breakfast")
            .reduce((sum, item) => sum + item.quantity, 0);
          const lunchItems = bill.items
            .filter((item) => item.name === "Lunch")
            .reduce((sum, item) => sum + item.quantity, 0);

          return {
            id: bill.id,
            staffId: bill.customerId || "N/A",
            staffName: bill.customerName || "Unknown",
            designation: (supportStaff.find((s) => s.staffId === bill.customerId)?.designation) || "N/A",
            company: bill.companyName || "N/A",
            date: bill.date,
            time: bill.time,
            breakfast: breakfastItems,
            lunch: lunchItems,
            totalItems: bill.totalItems,
            amount: bill.totalAmount,
          };
        });

      setSupportStaffReportData(supportStaffData);

      // Company-wise report data (use server-provided totalAmount)
      const companyStats: { [key: string]: CompanyReport } = {};

      bills.forEach((bill) => {
        const companyName = bill.companyName || (bill.customerType === "guest" ? "Guest Company" : "Unknown Company");

        const breakfastItems = bill.items
          .filter((item) => item.name === "Breakfast")
          .reduce((sum, item) => sum + item.quantity, 0);
        const lunchItems = bill.items
          .filter((item) => item.name === "Lunch")
          .reduce((sum, item) => sum + item.quantity, 0);

        if (!companyStats[companyName]) {
          companyStats[companyName] = {
            companyName,
            totalEmployees: 0,
            totalTransactions: 0,
            breakfast: 0,
            lunch: 0,
            totalItems: 0,
            totalAmount: 0,
            employees: [],
          };
        }

        companyStats[companyName].totalTransactions += 1;
        companyStats[companyName].breakfast += breakfastItems;
        companyStats[companyName].lunch += lunchItems;
        companyStats[companyName].totalItems += bill.totalItems;

        // Calculate total amount using Company/Guest pricing from price master
        const companyBreakfastAmount = breakfastItems * priceMaster.company.breakfast;
        const companyLunchAmount = lunchItems * priceMaster.company.lunch;
        companyStats[companyName].totalAmount += companyBreakfastAmount + companyLunchAmount;

        // Track unique employees
        const employeeName = bill.customerName || (bill.customerType === "guest" ? "Guest" : "Unknown");
        if (!companyStats[companyName].employees.includes(employeeName)) {
          companyStats[companyName].employees.push(employeeName);
          companyStats[companyName].totalEmployees += 1;
        }
      });

      const companyArray = Object.values(companyStats).sort(
        (a, b) => b.totalAmount - a.totalAmount
      );
      setCompanyReportData(companyArray);

      // Calculate summary statistics based on active tab
      updateSummaryStats(
        activeTab,
        employeeData,
        supportStaffData,
        companyArray
      );
    } catch (err) {
      console.error(err);
    }
  };

  const updateSummaryStats = (
    tab: string,
    employeeData: any[],
    supportStaffData: any[],
    companyData: any[]
  ) => {
    let totalBreakfast, totalLunch, totalAmount;

    if (tab === "company") {
      // For company report: use company pricing and sum from company data
      totalBreakfast = companyData.reduce(
        (sum, company) => sum + company.breakfast,
        0
      );
      totalLunch = companyData.reduce((sum, company) => sum + company.lunch, 0);
      totalAmount = companyData.reduce(
        (sum, company) => sum + company.totalAmount,
        0
      );
    } else if (tab === "supportStaff") {
      // For support staff report: use actual billing amounts
      totalBreakfast = supportStaffData.reduce(
        (sum, record) => sum + record.breakfast,
        0
      );
      totalLunch = supportStaffData.reduce(
        (sum, record) => sum + record.lunch,
        0
      );
      totalAmount = supportStaffData.reduce(
        (sum, record) => sum + record.amount,
        0
      );
    } else {
      // For employee report: use actual billing amounts
      totalBreakfast = employeeData.reduce(
        (sum, record) => sum + record.breakfast,
        0
      );
      totalLunch = employeeData.reduce((sum, record) => sum + record.lunch, 0);
      totalAmount = employeeData.reduce(
        (sum, record) => sum + record.amount,
        0
      );
    }

    setSummaryStats({
      totalBreakfast,
      totalLunch,
      totalAmount,
    });
  };

  const handleGenerateReport = async () => {
    let filteredEmployeeData = [...reportData];
    let filteredSupportStaffData = [...supportStaffReportData];
    let filteredCompanyData = [...companyReportData];

    // Filter by date range
    if (startDate || endDate) {
      try {
        const params = new URLSearchParams();
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
        let bills: TransactionRecord[] = await apiFetch(
          `/transactions?${params.toString()}`
        );

        if (startDate) {
          bills = bills.filter((bill) => bill.date >= startDate);
        }
        if (endDate) {
          bills = bills.filter((bill) => bill.date <= endDate);
        }

        // Reprocess filtered employee/guest data
        const employeeData = bills
          .filter((bill) => bill.customerType === "employee" || bill.customerType === "guest")
          .map((bill) => {
            const breakfastItems = bill.items
              .filter((item) => item.name === "Breakfast")
              .reduce((sum, item) => sum + item.quantity, 0);
            const lunchItems = bill.items
              .filter((item) => item.name === "Lunch")
              .reduce((sum, item) => sum + item.quantity, 0);

            const isGuest = bill.customerType === "guest";
            return {
              id: bill.id,
              employeeId: isGuest ? "GUEST" : bill.customerId || "N/A",
              employeeName: isGuest ? bill.customerName || "Unknown Guest" : bill.customerName || "Unknown",
              company: bill.companyName || "N/A",
              date: bill.date,
              time: bill.time,
              breakfast: breakfastItems,
              lunch: lunchItems,
              totalItems: bill.totalItems,
              amount: bill.totalAmount,
              isGuest,
            };
          });

        filteredEmployeeData = employeeData;

        // Reprocess filtered support staff data (ONLY support staff)
        const supportStaffData = bills
          .filter((bill) => bill.customerType === "supportStaff")
          .map((bill) => {
            const breakfastItems = bill.items
              .filter((item) => item.name === "Breakfast")
              .reduce((sum, item) => sum + item.quantity, 0);
            const lunchItems = bill.items
              .filter((item) => item.name === "Lunch")
              .reduce((sum, item) => sum + item.quantity, 0);

            return {
              id: bill.id,
              staffId: bill.customerId || "N/A",
              staffName: bill.customerName || "Unknown",
              designation: (supportStaff.find((s) => s.staffId === bill.customerId)?.designation) || "N/A",
              company: bill.companyName || "N/A",
              date: bill.date,
              time: bill.time,
              breakfast: breakfastItems,
              lunch: lunchItems,
              totalItems: bill.totalItems,
              amount: bill.totalAmount,
            };
          });

        filteredSupportStaffData = supportStaffData;

        // Reprocess company data using backend totals
        const companyStats: { [key: string]: CompanyReport } = {};

        bills.forEach((bill) => {
          const companyName = bill.companyName || (bill.customerType === "guest" ? "Guest Company" : "Unknown Company");

          const breakfastItems = bill.items
            .filter((item) => item.name === "Breakfast")
            .reduce((sum, item) => sum + item.quantity, 0);
          const lunchItems = bill.items
            .filter((item) => item.name === "Lunch")
            .reduce((sum, item) => sum + item.quantity, 0);

          if (!companyStats[companyName]) {
            companyStats[companyName] = {
              companyName,
              totalEmployees: 0,
              totalTransactions: 0,
              breakfast: 0,
              lunch: 0,
              totalItems: 0,
              totalAmount: 0,
              employees: [],
            };
          }

          companyStats[companyName].totalTransactions += 1;
          companyStats[companyName].breakfast += breakfastItems;
          companyStats[companyName].lunch += lunchItems;
          companyStats[companyName].totalItems += bill.totalItems;

          // Calculate total amount using Company/Guest pricing from price master
          const companyBreakfastAmount = breakfastItems * priceMaster.company.breakfast;
          const companyLunchAmount = lunchItems * priceMaster.company.lunch;
          companyStats[companyName].totalAmount += companyBreakfastAmount + companyLunchAmount;

          const employeeName = bill.customerName || (bill.customerType === "guest" ? "Guest" : "Unknown");
          if (!companyStats[companyName].employees.includes(employeeName)) {
            companyStats[companyName].employees.push(employeeName);
            companyStats[companyName].totalEmployees += 1;
          }
        });

        filteredCompanyData = Object.values(companyStats).sort(
          (a, b) => b.totalAmount - a.totalAmount
        );
      } catch (err) {
        console.error(err);
      }
    }

    // Filter by employee
    if (selectedEmployee) {
      filteredEmployeeData = filteredEmployeeData.filter(
        (record) =>
          record.employeeId === selectedEmployee ||
          record.employeeName
            .toLowerCase()
            .includes(selectedEmployee.toLowerCase())
      );
    }

    // Filter by support staff
    if (selectedSupportStaff) {
      filteredSupportStaffData = filteredSupportStaffData.filter(
        (record) =>
          record.staffId === selectedSupportStaff ||
          record.staffName
            .toLowerCase()
            .includes(selectedSupportStaff.toLowerCase())
      );
    }

    // Filter by company
    if (selectedCompany) {
      filteredEmployeeData = filteredEmployeeData.filter(
        (record) => record.company === selectedCompany
      );
      filteredSupportStaffData = filteredSupportStaffData.filter(
        (record) => record.company === selectedCompany
      );
      filteredCompanyData = filteredCompanyData.filter(
        (company) => company.companyName === selectedCompany
      );
    }

    // Apply sorting
    const applySort = <T,>(arr: T[], key: string) => {
      if (!key) return arr;
      const dir = sortDir === 'ASC' ? 1 : -1;
      return [...arr].sort((a: any, b: any) => {
        const av = a?.[key];
        const bv = b?.[key];
        if (av == null && bv == null) return 0;
        if (av == null) return -1 * dir;
        if (bv == null) return 1 * dir;
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
        return String(av).localeCompare(String(bv)) * dir;
      });
    };

    filteredEmployeeData = applySort(filteredEmployeeData, sortKey);
    filteredSupportStaffData = applySort(filteredSupportStaffData, sortKey);
    filteredCompanyData = applySort(filteredCompanyData as any[], sortKey) as any[];

    // Update summary stats based on active tab
    updateSummaryStats(
      activeTab,
      filteredEmployeeData,
      filteredSupportStaffData,
      filteredCompanyData
    );

    setReportData(filteredEmployeeData);
    setSupportStaffReportData(filteredSupportStaffData);
    setCompanyReportData(filteredCompanyData);
  };

  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedEmployee('');
    setSelectedSupportStaff('');
    setSelectedCompany('');
    setSortKey('');
    setSortDir('ASC');
    setCurrentPage(1);
    // Reload original data
    loadReportData();
  };

  // Pagination helper functions
  const getCurrentPageData = (data: any[]) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  };

  const getTotalPages = (data: any[]) => {
    return Math.ceil(data.length / itemsPerPage);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (items: number) => {
    setItemsPerPage(items);
    setCurrentPage(1);
  };

  const handleExportReport = async () => {
    let dataToExport: any[];
    let headers: string[];
    let fileName: string;

    if (activeTab === "employee") {
      dataToExport = reportData;
      headers = [
        "Employee ID",
        "Employee Name",
        "Company",
        "Date",
        "Time",
        "Breakfast",
        "Lunch",
        "Total Items",
        "Amount",
      ];
      fileName = "employee-report";
    } else if (activeTab === "supportStaff") {
      dataToExport = supportStaffReportData;
      headers = [
        "Staff ID",
        "Staff Name",
        "Company",
        "Date",
        "Time",
        "Breakfast",
        "Lunch",
        "Total Items",
        "Amount",
      ];
      fileName = "support-staff-report";
    } else {
      dataToExport = companyReportData;
      headers = [
        "Company Name",
        "Total Employees",
        "Total Transactions",
        "Breakfast",
        "Lunch",
        "Total Items",
        "Total Amount",
      ];
      fileName = "company-report";
    }

    if (dataToExport.length === 0) {
      alert("No data to export");
      return;
    }

    let excelData: any[][];

    if (activeTab === "employee") {
      excelData = [
        headers,
        ...reportData.map((record) => [
          record.employeeId,
          record.employeeName,
          record.company,
          record.date,
          record.time,
          record.breakfast,
          record.lunch,
          record.totalItems,
          `₹${record.amount}`,
        ]),
      ];
    } else if (activeTab === "supportStaff") {
      excelData = [
        headers,
        ...supportStaffReportData.map((record) => [
          record.staffId,
          record.staffName,
          record.company,
          record.date,
          record.time,
          record.breakfast,
          record.lunch,
          record.totalItems,
          `₹${record.amount}`,
        ]),
      ];
    } else {
      excelData = [
        headers,
        ...companyReportData.map((company) => [
          company.companyName,
          company.totalEmployees,
          company.totalTransactions,
          company.breakfast,
          company.lunch,
          company.totalItems,
          `₹${company.totalAmount}`,
        ]),
      ];
    }

    // Create modern .xlsx using xlsx
    try {
      const { utils, writeFile } = await import('xlsx');
      const wb = utils.book_new();
      const ws = utils.aoa_to_sheet(excelData);
      utils.book_append_sheet(wb, ws, (
        activeTab === 'employee' ? 'Employee Report' : (activeTab === 'supportStaff' ? 'Support Staff Report' : 'Company Report')
      ));
      writeFile(wb, `${fileName}-${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (e) {
      console.error('XLSX export failed, falling back to CSV:', e);
      // Fallback: CSV
      const csv = excelData.map(r => r.map(v => {
        const s = String(v ?? '');
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }
  };

  // Add useEffect to update summary when tab changes
  useEffect(() => {
    updateSummaryStats(
      activeTab,
      reportData,
      supportStaffReportData,
      companyReportData
    );
  }, [activeTab, reportData, supportStaffReportData, companyReportData]);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Reports</h1>
          <button
            onClick={handleExportReport}
            className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors cursor-pointer whitespace-nowrap flex items-center"
          >
            <i className="ri-download-line mr-2"></i>
            Export Report
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab("employee")}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap cursor-pointer ${
                  activeTab === "employee"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <i className="ri-user-line mr-2"></i>
                Employee Report
              </button>
              <button
                onClick={() => setActiveTab("supportStaff")}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap cursor-pointer ${
                  activeTab === "supportStaff"
                    ? "border-purple-500 text-purple-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <i className="ri-tools-line mr-2"></i>
                Support Staff Report
              </button>
              <button
                onClick={() => setActiveTab("company")}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap cursor-pointer ${
                  activeTab === "company"
                    ? "border-green-500 text-green-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <i className="ri-building-line mr-2"></i>
                Company Report
              </button>
            </nav>
          </div>

          {/* Filters */}
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Report Filters
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              {activeTab === "employee" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Employee
                  </label>
                  <select
                    value={selectedEmployee}
                    onChange={(e) => setSelectedEmployee(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none pr-8"
                  >
                    <option value="">All Employees</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.employeeId}>
                        {emp.employeeName} ({emp.employeeId})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {activeTab === "supportStaff" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Support Staff
                  </label>
                  <select
                    value={selectedSupportStaff}
                    onChange={(e) => setSelectedSupportStaff(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none pr-8"
                  >
                    <option value="">All Support Staff</option>
                    {supportStaff.map((staff) => (
                      <option key={staff.id} value={staff.staffId}>
                        {staff.name} ({staff.staffId})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company
                </label>
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none pr-8"
                >
                  <option value="">All Companies</option>
                  {companies.map((company) => (
                    <option key={company} value={company}>
                      {company}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end gap-2 sm:col-span-2 md:col-span-2 lg:col-span-2 xl:col-span-2">
                <button
                  onClick={handleGenerateReport}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center"
                >
                  <i className="ri-search-line mr-2"></i>
                  Generate Report
                </button>
                <button
                  onClick={handleClearFilters}
                  className="w-full bg-gray-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-600 transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center"
                >
                  <i className="ri-refresh-line mr-2"></i>
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Report Content */}
        {activeTab === "employee" ? (
          /* Employee Report Table */
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">
                Employee Report
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Detailed consumption report by employee and guests (excludes
                support staff only)
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                      onClick={() => { setSortKey('employeeId'); setSortDir(sortKey === 'employeeId' && sortDir === 'ASC' ? 'DESC' : 'ASC'); handleGenerateReport(); }}
                    >
                      Employee ID {sortKey === 'employeeId' ? (sortDir === 'ASC' ? '▲' : '▼') : ''}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                      onClick={() => { setSortKey('employeeName'); setSortDir(sortKey === 'employeeName' && sortDir === 'ASC' ? 'DESC' : 'ASC'); handleGenerateReport(); }}
                    >
                      Employee Name {sortKey === 'employeeName' ? (sortDir === 'ASC' ? '▲' : '▼') : ''}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                      onClick={() => { setSortKey('company'); setSortDir(sortKey === 'company' && sortDir === 'ASC' ? 'DESC' : 'ASC'); handleGenerateReport(); }}
                    >
                      Company {sortKey === 'company' ? (sortDir === 'ASC' ? '▲' : '▼') : ''}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                      onClick={() => { setSortKey('date'); setSortDir(sortKey === 'date' && sortDir === 'ASC' ? 'DESC' : 'ASC'); handleGenerateReport(); }}
                    >
                      Date {sortKey === 'date' ? (sortDir === 'ASC' ? '▲' : '▼') : ''}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Breakfast
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Lunch
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                      onClick={() => { setSortKey('totalItems'); setSortDir(sortKey === 'totalItems' && sortDir === 'ASC' ? 'DESC' : 'ASC'); handleGenerateReport(); }}
                    >
                      Total Items {sortKey === 'totalItems' ? (sortDir === 'ASC' ? '▲' : '▼') : ''}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                      onClick={() => { setSortKey('amount'); setSortDir(sortKey === 'amount' && sortDir === 'ASC' ? 'DESC' : 'ASC'); handleGenerateReport(); }}
                    >
                      Amount {sortKey === 'amount' ? (sortDir === 'ASC' ? '▲' : '▼') : ''}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reportData.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-6 py-8 text-center text-gray-500"
                      >
                        No employee or guest report data available. Generate
                        reports after employee and guest billing transactions.
                      </td>
                    </tr>
                  ) : (
                    getCurrentPageData(reportData).map((record, index) => (
                      <tr
                        key={record.id || index}
                        className={`hover:bg-gray-50 ${
                          record.isGuest ? "bg-green-50" : ""
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          <div className="flex items-center">
                            {record.isGuest && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 mr-2">
                                <i className="ri-user-add-line mr-1"></i>
                                Guest
                              </span>
                            )}
                            {record.employeeId}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.employeeName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.company}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.date}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.time}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.breakfast}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.lunch}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {record.totalItems}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ₹{record.amount}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Controls */}
            {reportData.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <label className="text-sm text-gray-700">Show:</label>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                        className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                      <span className="text-sm text-gray-700">entries</span>
                    </div>
                    <div className="text-sm text-gray-700">
                      Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, reportData.length)} of {reportData.length} entries
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    
                    {Array.from({ length: getTotalPages(reportData) }, (_, i) => i + 1)
                      .filter(page => {
                        const totalPages = getTotalPages(reportData);
                        return page === 1 || page === totalPages || Math.abs(page - currentPage) <= 2;
                      })
                      .map((page, index, array) => (
                        <span key={page}>
                          {index > 0 && array[index - 1] !== page - 1 && (
                            <span className="px-2 text-gray-500">...</span>
                          )}
                          <button
                            onClick={() => handlePageChange(page)}
                            className={`px-3 py-1 text-sm border rounded ${
                              currentPage === page
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'border-gray-300 hover:bg-gray-100'
                            }`}
                          >
                            {page}
                          </button>
                        </span>
                      ))}
                    
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === getTotalPages(reportData)}
                      className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === "supportStaff" ? (
          /* Support Staff Report Table */
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">
                Support Staff Report
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Detailed consumption report by support staff
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                      onClick={() => { setSortKey('staffId'); setSortDir(sortKey === 'staffId' && sortDir === 'ASC' ? 'DESC' : 'ASC'); handleGenerateReport(); }}
                    >
                      Staff ID {sortKey === 'staffId' ? (sortDir === 'ASC' ? '▲' : '▼') : ''}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                      onClick={() => { setSortKey('staffName'); setSortDir(sortKey === 'staffName' && sortDir === 'ASC' ? 'DESC' : 'ASC'); handleGenerateReport(); }}
                    >
                      Staff Name {sortKey === 'staffName' ? (sortDir === 'ASC' ? '▲' : '▼') : ''}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                      onClick={() => { setSortKey('company'); setSortDir(sortKey === 'company' && sortDir === 'ASC' ? 'DESC' : 'ASC'); handleGenerateReport(); }}
                    >
                      Company {sortKey === 'company' ? (sortDir === 'ASC' ? '▲' : '▼') : ''}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Breakfast
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Lunch
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                      onClick={() => { setSortKey('totalItems'); setSortDir(sortKey === 'totalItems' && sortDir === 'ASC' ? 'DESC' : 'ASC'); handleGenerateReport(); }}
                    >
                      Total Items {sortKey === 'totalItems' ? (sortDir === 'ASC' ? '▲' : '▼') : ''}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                      onClick={() => { setSortKey('amount'); setSortDir(sortKey === 'amount' && sortDir === 'ASC' ? 'DESC' : 'ASC'); handleGenerateReport(); }}
                    >
                      Amount {sortKey === 'amount' ? (sortDir === 'ASC' ? '▲' : '▼') : ''}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {supportStaffReportData.length === 0 ? (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-6 py-8 text-center text-gray-500"
                      >
                        No support staff report data available. Generate reports
                        after support staff billing transactions.
                      </td>
                    </tr>
                  ) : (
                    getCurrentPageData(supportStaffReportData).map((record, index) => (
                      <tr key={record.id || index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {record.staffId}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.staffName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.company}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.date}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.time}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.breakfast}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.lunch}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {record.totalItems}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ₹{record.amount}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Controls for Support Staff */}
            {supportStaffReportData.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <label className="text-sm text-gray-700">Show:</label>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                        className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                      <span className="text-sm text-gray-700">entries</span>
                    </div>
                    <div className="text-sm text-gray-700">
                      Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, supportStaffReportData.length)} of {supportStaffReportData.length} entries
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    
                    {Array.from({ length: getTotalPages(supportStaffReportData) }, (_, i) => i + 1)
                      .filter(page => {
                        const totalPages = getTotalPages(supportStaffReportData);
                        return page === 1 || page === totalPages || Math.abs(page - currentPage) <= 2;
                      })
                      .map((page, index, array) => (
                        <span key={page}>
                          {index > 0 && array[index - 1] !== page - 1 && (
                            <span className="px-2 text-gray-500">...</span>
                          )}
                          <button
                            onClick={() => handlePageChange(page)}
                            className={`px-3 py-1 text-sm border rounded ${
                              currentPage === page
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'border-gray-300 hover:bg-gray-100'
                            }`}
                          >
                            {page}
                          </button>
                        </span>
                      ))}
                    
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === getTotalPages(supportStaffReportData)}
                      className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Company Report Table */
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">
                Company Report
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Detailed consumption report by company
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                      onClick={() => { setSortKey('companyName'); setSortDir(sortKey === 'companyName' && sortDir === 'ASC' ? 'DESC' : 'ASC'); handleGenerateReport(); }}
                    >
                      Company Name {sortKey === 'companyName' ? (sortDir === 'ASC' ? '▲' : '▼') : ''}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Employees
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Transactions
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Breakfast Count
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Lunch Count
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Items
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {companyReportData.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-8 text-center text-gray-500"
                      >
                        No company report data available. Generate reports after
                        billing transactions.
                      </td>
                    </tr>
                  ) : (
                    getCurrentPageData(companyReportData).map((company, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {company.companyName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {company.totalEmployees}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {company.totalTransactions}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {company.breakfast}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {company.lunch}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {company.totalItems}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ₹{company.totalAmount}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Controls for Company */}
            {companyReportData.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <label className="text-sm text-gray-700">Show:</label>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                        className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                      <span className="text-sm text-gray-700">entries</span>
                    </div>
                    <div className="text-sm text-gray-700">
                      Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, companyReportData.length)} of {companyReportData.length} entries
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    
                    {Array.from({ length: getTotalPages(companyReportData) }, (_, i) => i + 1)
                      .filter(page => {
                        const totalPages = getTotalPages(companyReportData);
                        return page === 1 || page === totalPages || Math.abs(page - currentPage) <= 2;
                      })
                      .map((page, index, array) => (
                        <span key={page}>
                          {index > 0 && array[index - 1] !== page - 1 && (
                            <span className="px-2 text-gray-500">...</span>
                          )}
                          <button
                            onClick={() => handlePageChange(page)}
                            className={`px-3 py-1 text-sm border rounded ${
                              currentPage === page
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'border-gray-300 hover:bg-gray-100'
                            }`}
                          >
                            {page}
                          </button>
                        </span>
                      ))}
                    
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === getTotalPages(companyReportData)}
                      className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Summary Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Breakfast
                </p>
                <p className="text-2xl font-bold text-orange-600">
                  {summaryStats.totalBreakfast}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <i className="ri-restaurant-line text-2xl text-orange-600"></i>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Lunch</p>
                <p className="text-2xl font-bold text-green-600">
                  {summaryStats.totalLunch}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <i className="ri-bowl-line text-2xl text-green-600"></i>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Amount
                </p>
                <p className="text-2xl font-bold text-blue-600">
                  ₹{summaryStats.totalAmount}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <i className="ri-money-rupee-circle-line text-2xl text-blue-600"></i>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
