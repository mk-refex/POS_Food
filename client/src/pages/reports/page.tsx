import { useState, useEffect, useMemo } from "react";
import Layout from "../../components/feature/Layout";
import { apiFetch, mastersApi, isAdmin } from "../../api/client";
import { ratingTextClass, ratingBadgeText } from "../../utils/ratingColor";

// Align client types with server's /transactions response
interface TransactionRecord {
  id: number | string;
  userId?: number | null;
  customerType: "employee" | "guest" | "supportStaff";
  customerId?: string | null;
  customerName?: string | null;
  companyName?: string | null;
  date: string;
  time: string;
  createdAt?: string | Date;
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

interface User {
  id: number;
  username: string;
  name: string;
  email: string;
  role: string;
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

interface FeedbackReportRecord {
  id: number;
  employeeId: string;
  employeeName?: string | null;
  companyName?: string | null;
  date: string;
  mealType: "breakfast" | "lunch";
  rating: number;
  createdAt?: string | Date | null;
}

interface FeedbackSummary {
  total: number;
  avgRating: number | null;
  byMeal: {
    breakfast: { count: number; avgRating: number | null };
    lunch: { count: number; avgRating: number | null };
  };
  byRating: { [rating: string]: number };
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState("employee");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedSupportStaff, setSelectedSupportStaff] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [reportData, setReportData] = useState<any[]>([]);
  const [supportStaffReportData, setSupportStaffReportData] = useState<any[]>(
    []
  );
  const [companyReportData, setCompanyReportData] = useState<CompanyReport[]>(
    []
  );
  // Store original unfiltered data
  const [originalReportData, setOriginalReportData] = useState<any[]>([]);
  const [originalSupportStaffReportData, setOriginalSupportStaffReportData] = useState<any[]>([]);
  const [originalCompanyReportData, setOriginalCompanyReportData] = useState<CompanyReport[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [supportStaff, setSupportStaff] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  // Filtered lists based on transactions
  const [transactionEmployees, setTransactionEmployees] = useState<any[]>([]);
  const [transactionCompanies, setTransactionCompanies] = useState<string[]>([]);
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

  const [feedbackRecords, setFeedbackRecords] = useState<FeedbackReportRecord[]>([]);
  const [feedbackSummary, setFeedbackSummary] = useState<FeedbackSummary | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackPage, setFeedbackPage] = useState(1);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [feedbackModalItem, setFeedbackModalItem] = useState<FeedbackReportRecord | null>(null);
  const FEEDBACK_PAGE_SIZE = 10;

  const feedbackTotalPages = useMemo(
    () => Math.max(1, Math.ceil(feedbackRecords.length / FEEDBACK_PAGE_SIZE)),
    [feedbackRecords.length]
  );
  const paginatedFeedbackRecords = useMemo(() => {
    const start = (feedbackPage - 1) * FEEDBACK_PAGE_SIZE;
    return feedbackRecords.slice(start, start + FEEDBACK_PAGE_SIZE);
  }, [feedbackRecords, feedbackPage]);

  // Load data on component mount
  useEffect(() => {
    const initializeData = async () => {
      let loadedUsers: User[] = [];
      if (isAdmin()) {
        loadedUsers = await loadUsers(); // Load users first if admin
      }
      // Load price master first, then load report data with the loaded price master
      const loadedPriceMaster = await loadPriceMaster();
      await Promise.all([
        loadReportData(loadedUsers, loadedPriceMaster),
        loadEmployees(),
        loadSupportStaff(),
        loadFeedbackReport()
      ]);
    };
    initializeData();
  }, []);

  const loadUsers = async (): Promise<User[]> => {
    try {
      const usersList: User[] = await apiFetch("/admin/users");
      setUsers(usersList);
      return usersList;
    } catch (error) {
      console.error('Error loading users:', error);
      return [];
    }
  };

  // Helper function to get user name from userId
  const getUserName = (userId: number | null | undefined, usersList?: User[]): string => {
    if (!userId) return "N/A";
    const usersToSearch = usersList || users;
    const user = usersToSearch.find(u => u.id === userId);
    return user ? user.name : "Unknown User";
  };

  // Helper function to format createdAt as "Billed On" (date and time together)
  const formatBilledOn = (createdAt: string | Date | null | undefined, date?: string, time?: string): string => {
    if (createdAt) {
      try {
        const dateObj = new Date(createdAt);
        if (!isNaN(dateObj.getTime())) {
          // Format as "DD/MM/YYYY HH:MM:SS"
          const day = String(dateObj.getDate()).padStart(2, '0');
          const month = String(dateObj.getMonth() + 1).padStart(2, '0');
          const year = dateObj.getFullYear();
          const hours = String(dateObj.getHours()).padStart(2, '0');
          const minutes = String(dateObj.getMinutes()).padStart(2, '0');
          const seconds = String(dateObj.getSeconds()).padStart(2, '0');
          return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
        }
      } catch (e) {
        // Fall through to date/time fallback
      }
    }
    // Fallback to date and time if createdAt is not available
    if (date && time) {
      return `${date} ${time}`;
    }
    return date || time || "N/A";
  };

  // Update createdBy field when users are loaded
  useEffect(() => {
    if (isAdmin() && users.length > 0 && reportData.length > 0) {
      // Update employee report data with correct user names
      setReportData(prev => prev.map(record => ({
        ...record,
        createdBy: getUserName(record.userId)
      })));
    }
    if (isAdmin() && users.length > 0 && supportStaffReportData.length > 0) {
      // Update support staff report data with correct user names
      setSupportStaffReportData(prev => prev.map(record => ({
        ...record,
        createdBy: getUserName(record.userId)
      })));
    }
  }, [users]);

  // Update transaction employees when employees list is loaded
  useEffect(() => {
    if (employees.length > 0 && originalReportData.length > 0) {
      const uniqueEmployeeIds = new Set<string>();
      const employeeMap = new Map<string, { employeeId: string; employeeName: string }>();

      originalReportData.forEach((record) => {
        if (record.employeeId) {
          uniqueEmployeeIds.add(record.employeeId);
          if (!employeeMap.has(record.employeeId)) {
            employeeMap.set(record.employeeId, {
              employeeId: record.employeeId,
              employeeName: record.employeeName || 'Unknown'
            });
          }
        }
      });

      // Match with full employee data
      const filteredEmployees = employees.filter((emp) =>
        uniqueEmployeeIds.has(emp.employeeId)
      ).sort((a, b) => (a.employeeName || '').localeCompare(b.employeeName || ''));

      // If we have matches, use them; otherwise use transaction data
      if (filteredEmployees.length > 0) {
        setTransactionEmployees(filteredEmployees);
      } else {
        // Use transaction data with proper structure
        const transactionBasedEmployees = Array.from(employeeMap.values())
          .map((emp, index) => ({
            id: index,
            employeeId: emp.employeeId,
            employeeName: emp.employeeName
          }))
          .sort((a, b) => (a.employeeName || '').localeCompare(b.employeeName || ''));
        setTransactionEmployees(transactionBasedEmployees);
      }
    }
  }, [employees, originalReportData]);

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

  const loadFeedbackReport = async () => {
    try {
      setFeedbackLoading(true);
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const url = params.toString() ? `/reports/feedback?${params.toString()}` : "/reports/feedback";
      const res: { list?: FeedbackReportRecord[]; summary?: FeedbackSummary } = await apiFetch(url);
      setFeedbackRecords(Array.isArray(res.list) ? res.list : []);
      setFeedbackSummary(res.summary ?? null);
      setFeedbackPage(1);
    } catch (error) {
      console.error("Error loading feedback reports:", error);
      setFeedbackRecords([]);
      setFeedbackSummary(null);
    } finally {
      setFeedbackLoading(false);
    }
  };

  const loadPriceMaster = async (): Promise<PriceMaster> => {
    try {
      const priceMasterData = await mastersApi.getPriceMaster();
      setPriceMaster(priceMasterData);
      return priceMasterData;
    } catch (error) {
      console.error('Error loading price master:', error);
      // Return default values if loading fails
      return {
        employee: { breakfast: 20, lunch: 48 },
        company: { breakfast: 135, lunch: 165 }
      };
    }
  };

  const loadReportData = async (usersList?: User[], priceMasterData?: PriceMaster) => {
    try {
      const bills: TransactionRecord[] = await apiFetch("/transactions");

      // Use provided users list or current users state
      const usersToUse = usersList || users;

      // Use provided price master or current price master state
      const priceMasterToUse = priceMasterData || priceMaster;

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
          const exceptionBreakfast = bill.items
            .filter((item) => item.name === "Breakfast" && item.isException)
            .reduce((sum, item) => sum + item.quantity, 0);
          const exceptionLunch = bill.items
            .filter((item) => item.name === "Lunch" && item.isException)
            .reduce((sum, item) => sum + item.quantity, 0);

          const isGuest = bill.customerType === "guest";
          return {
            id: bill.id,
            userId: bill.userId,
            createdBy: getUserName(bill.userId, usersToUse),
            employeeId: isGuest ? "GUEST" : bill.customerId || "N/A",
            employeeName: isGuest ? bill.customerName || "Unknown Guest" : bill.customerName || "Unknown",
            company: bill.companyName || "N/A",
            date: bill.date,
            time: bill.time,
            createdAt: bill.createdAt || null,
            breakfast: breakfastItems,
            lunch: lunchItems,
            exceptionBreakfast,
            exceptionLunch,
            hasException: exceptionBreakfast > 0 || exceptionLunch > 0,
            totalItems: bill.totalItems,
            amount: bill.totalAmount,
            isGuest,
          };
        });

      setReportData(employeeData);
      setOriginalReportData(employeeData); // Store original unfiltered data

      // Extract unique employees and companies from transactions
      const uniqueEmployeeIds = new Set<string>();
      const uniqueCompanies = new Set<string>();
      const employeeMap = new Map<string, { employeeId: string; employeeName: string }>();

      employeeData.forEach((record) => {
        // Include both employees and guests (GUEST is also valid)
        if (record.employeeId) {
          uniqueEmployeeIds.add(record.employeeId);
          // Store employee info from transaction
          if (!employeeMap.has(record.employeeId)) {
            employeeMap.set(record.employeeId, {
              employeeId: record.employeeId,
              employeeName: record.employeeName || 'Unknown'
            });
          }
        }
        if (record.company && record.company !== "N/A") {
          uniqueCompanies.add(record.company);
        }
      });

      // Match employee IDs with full employee data if available, otherwise use transaction data
      let filteredEmployees: any[] = [];
      if (employees.length > 0) {
        filteredEmployees = employees.filter((emp) =>
          uniqueEmployeeIds.has(emp.employeeId)
        ).sort((a, b) => (a.employeeName || '').localeCompare(b.employeeName || ''));
      } else {
        // If employees not loaded yet, use transaction data with proper structure
        filteredEmployees = Array.from(employeeMap.values())
          .map((emp, index) => ({
            id: index, // Add id for React key
            employeeId: emp.employeeId,
            employeeName: emp.employeeName
          }))
          .sort((a, b) => (a.employeeName || '').localeCompare(b.employeeName || ''));
      }

      setTransactionEmployees(filteredEmployees);
      setTransactionCompanies(Array.from(uniqueCompanies).sort());

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
          const exceptionBreakfast = bill.items
            .filter((item) => item.name === "Breakfast" && item.isException)
            .reduce((sum, item) => sum + item.quantity, 0);
          const exceptionLunch = bill.items
            .filter((item) => item.name === "Lunch" && item.isException)
            .reduce((sum, item) => sum + item.quantity, 0);

          return {
            id: bill.id,
            userId: bill.userId,
            createdBy: getUserName(bill.userId, usersToUse),
            staffId: bill.customerId || "N/A",
            staffName: bill.customerName || "Unknown",
            designation: (supportStaff.find((s) => s.staffId === bill.customerId)?.designation) || "N/A",
            company: bill.companyName || "N/A",
            date: bill.date,
            time: bill.time,
            createdAt: bill.createdAt || null,
            breakfast: breakfastItems,
            lunch: lunchItems,
            exceptionBreakfast,
            exceptionLunch,
            hasException: exceptionBreakfast > 0 || exceptionLunch > 0,
            totalItems: bill.totalItems,
            amount: bill.totalAmount,
          };
        });

      setSupportStaffReportData(supportStaffData);
      setOriginalSupportStaffReportData(supportStaffData); // Store original unfiltered data

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
        // Formula: totalAmount = (breakfastItems × company.breakfast) + (lunchItems × company.lunch)
        const companyBreakfastAmount = breakfastItems * priceMasterToUse.company.breakfast;
        const companyLunchAmount = lunchItems * priceMasterToUse.company.lunch;
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
      setOriginalCompanyReportData(companyArray); // Store original unfiltered data

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
    // Ensure users are loaded if admin
    if (isAdmin() && users.length === 0) {
      await loadUsers();
    }

    // Refresh feedback summary/list for the selected date range
    await loadFeedbackReport();

    // Reload price master to ensure we have the latest values
    const currentPriceMaster = await loadPriceMaster();

    // Always start from original unfiltered data and refresh with correct user names
    let filteredEmployeeData = originalReportData.map(record => ({
      ...record,
      createdBy: getUserName(record.userId)
    }));
    let filteredSupportStaffData = originalSupportStaffReportData.map(record => ({
      ...record,
      createdBy: getUserName(record.userId)
    }));
    let filteredCompanyData = [...originalCompanyReportData];

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
            const exceptionBreakfast = bill.items
              .filter((item) => item.name === "Breakfast" && item.isException)
              .reduce((sum, item) => sum + item.quantity, 0);
            const exceptionLunch = bill.items
              .filter((item) => item.name === "Lunch" && item.isException)
              .reduce((sum, item) => sum + item.quantity, 0);

            const isGuest = bill.customerType === "guest";
            return {
              id: bill.id,
              userId: bill.userId,
              createdBy: getUserName(bill.userId, users),
              employeeId: isGuest ? "GUEST" : bill.customerId || "N/A",
              employeeName: isGuest ? bill.customerName || "Unknown Guest" : bill.customerName || "Unknown",
              company: bill.companyName || "N/A",
              date: bill.date,
              time: bill.time,
              createdAt: bill.createdAt || null,
              breakfast: breakfastItems,
              lunch: lunchItems,
              exceptionBreakfast,
              exceptionLunch,
              hasException: exceptionBreakfast > 0 || exceptionLunch > 0,
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
            const exceptionBreakfast = bill.items
              .filter((item) => item.name === "Breakfast" && item.isException)
              .reduce((sum, item) => sum + item.quantity, 0);
            const exceptionLunch = bill.items
              .filter((item) => item.name === "Lunch" && item.isException)
              .reduce((sum, item) => sum + item.quantity, 0);

            return {
              id: bill.id,
              userId: bill.userId,
              createdBy: getUserName(bill.userId, users),
              staffId: bill.customerId || "N/A",
              staffName: bill.customerName || "Unknown",
              designation: (supportStaff.find((s) => s.staffId === bill.customerId)?.designation) || "N/A",
              company: bill.companyName || "N/A",
              date: bill.date,
              time: bill.time,
              createdAt: bill.createdAt || null,
              breakfast: breakfastItems,
              lunch: lunchItems,
              exceptionBreakfast,
              exceptionLunch,
              hasException: exceptionBreakfast > 0 || exceptionLunch > 0,
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
          // Formula: totalAmount = (breakfastItems × company.breakfast) + (lunchItems × company.lunch)
          const companyBreakfastAmount = breakfastItems * currentPriceMaster.company.breakfast;
          const companyLunchAmount = lunchItems * currentPriceMaster.company.lunch;
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

        // Update original data when filtering by date range
        setOriginalReportData(employeeData);
        setOriginalSupportStaffReportData(supportStaffData);
        setOriginalCompanyReportData(filteredCompanyData);

        // Extract unique employees and companies from filtered transactions
        const uniqueEmployeeIds = new Set<string>();
        const uniqueCompanies = new Set<string>();
        const employeeMap = new Map<string, { employeeId: string; employeeName: string }>();

        employeeData.forEach((record) => {
          if (record.employeeId && record.employeeId !== "GUEST") {
            uniqueEmployeeIds.add(record.employeeId);
            if (!employeeMap.has(record.employeeId)) {
              employeeMap.set(record.employeeId, {
                employeeId: record.employeeId,
                employeeName: record.employeeName
              });
            }
          }
          if (record.company && record.company !== "N/A") {
            uniqueCompanies.add(record.company);
          }
        });

        // Match employee IDs with full employee data if available, otherwise use transaction data
        let filteredEmployees: any[] = [];
        if (employees.length > 0) {
          filteredEmployees = employees.filter((emp) =>
            uniqueEmployeeIds.has(emp.employeeId)
          ).sort((a, b) => (a.employeeName || '').localeCompare(b.employeeName || ''));
        } else {
          // If employees not loaded yet, use transaction data with proper structure
          filteredEmployees = Array.from(employeeMap.values())
            .map((emp, index) => ({
              id: index, // Add id for React key
              employeeId: emp.employeeId,
              employeeName: emp.employeeName
            }))
            .sort((a, b) => (a.employeeName || '').localeCompare(b.employeeName || ''));
        }

        setTransactionEmployees(filteredEmployees);
        setTransactionCompanies(Array.from(uniqueCompanies).sort());
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

    // Filter by user (only for admins)
    if (isAdmin() && selectedUser) {
      const userId = Number(selectedUser);
      filteredEmployeeData = filteredEmployeeData.filter(
        (record) => record.userId === userId
      );
      filteredSupportStaffData = filteredSupportStaffData.filter(
        (record) => record.userId === userId
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

  const handleClearFilters = async () => {
    setStartDate('');
    setEndDate('');
    setSelectedEmployee('');
    setSelectedSupportStaff('');
    setSelectedCompany('');
    setSelectedUser('');
    setSortKey('');
    setSortDir('ASC');
    setCurrentPage(1);

    // Ensure users are loaded if admin
    let loadedUsers: User[] = [];
    if (isAdmin()) {
      if (users.length === 0) {
        loadedUsers = await loadUsers();
      } else {
        loadedUsers = users;
      }
    }

    // Reload original data with users and current price master
    await Promise.all([
      loadReportData(loadedUsers, priceMaster),
      loadFeedbackReport()
    ]);
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

  const handleDeleteTransaction = async (transactionId: number) => {
    if (!confirm('Are you sure you want to delete this transaction? This action cannot be undone.')) {
      return;
    }

    try {
      await apiFetch(`/transactions/${transactionId}`, {
        method: 'DELETE',
      });

      // Optimistically remove from current view immediately
      setReportData(prev => prev.filter(record => record.id !== transactionId));
      setSupportStaffReportData(prev => prev.filter(record => record.id !== transactionId));

      // Reset to first page
      setCurrentPage(1);

      // Reload price master to ensure we have the latest values
      const currentPriceMaster = await loadPriceMaster();

      // Fetch fresh data from server
      const bills: TransactionRecord[] = await apiFetch("/transactions");

      // Process fresh data (same logic as loadReportData)
      const employeeData = bills
        .filter((bill) => bill.customerType === "employee" || bill.customerType === "guest")
        .map((bill) => {
          const breakfastItems = bill.items
            .filter((item) => item.name === "Breakfast")
            .reduce((sum, item) => sum + item.quantity, 0);
          const lunchItems = bill.items
            .filter((item) => item.name === "Lunch")
            .reduce((sum, item) => sum + item.quantity, 0);
          const exceptionBreakfast = bill.items
            .filter((item) => item.name === "Breakfast" && item.isException)
            .reduce((sum, item) => sum + item.quantity, 0);
          const exceptionLunch = bill.items
            .filter((item) => item.name === "Lunch" && item.isException)
            .reduce((sum, item) => sum + item.quantity, 0);
          const isGuest = bill.customerType === "guest";
          return {
            id: bill.id,
            userId: bill.userId,
            createdBy: getUserName(bill.userId, users),
            employeeId: isGuest ? "GUEST" : bill.customerId || "N/A",
            employeeName: isGuest ? bill.customerName || "Unknown Guest" : bill.customerName || "Unknown",
            company: bill.companyName || "N/A",
            date: bill.date,
            time: bill.time,
            breakfast: breakfastItems,
            lunch: lunchItems,
            exceptionBreakfast,
            exceptionLunch,
            hasException: exceptionBreakfast > 0 || exceptionLunch > 0,
            totalItems: bill.totalItems,
            amount: bill.totalAmount,
            isGuest,
          };
        });

      const supportStaffData = bills
        .filter((bill) => bill.customerType === "supportStaff")
        .map((bill) => {
          const breakfastItems = bill.items
            .filter((item) => item.name === "Breakfast")
            .reduce((sum, item) => sum + item.quantity, 0);
          const lunchItems = bill.items
            .filter((item) => item.name === "Lunch")
            .reduce((sum, item) => sum + item.quantity, 0);
          const exceptionBreakfast = bill.items
            .filter((item) => item.name === "Breakfast" && item.isException)
            .reduce((sum, item) => sum + item.quantity, 0);
          const exceptionLunch = bill.items
            .filter((item) => item.name === "Lunch" && item.isException)
            .reduce((sum, item) => sum + item.quantity, 0);
          return {
            id: bill.id,
            userId: bill.userId,
            createdBy: getUserName(bill.userId, users),
            staffId: bill.customerId || "N/A",
            staffName: bill.customerName || "Unknown",
            designation: (supportStaff.find((s) => s.staffId === bill.customerId)?.designation) || "N/A",
            company: bill.companyName || "N/A",
            date: bill.date,
            time: bill.time,
            breakfast: breakfastItems,
            lunch: lunchItems,
            exceptionBreakfast,
            exceptionLunch,
            hasException: exceptionBreakfast > 0 || exceptionLunch > 0,
            totalItems: bill.totalItems,
            amount: bill.totalAmount,
          };
        });

      // Update company stats
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
        // Formula: totalAmount = (breakfastItems × company.breakfast) + (lunchItems × company.lunch)
        const companyBreakfastAmount = breakfastItems * currentPriceMaster.company.breakfast;
        const companyLunchAmount = lunchItems * currentPriceMaster.company.lunch;
        companyStats[companyName].totalAmount += companyBreakfastAmount + companyLunchAmount;
        const employeeName = bill.customerName || (bill.customerType === "guest" ? "Guest" : "Unknown");
        if (!companyStats[companyName].employees.includes(employeeName)) {
          companyStats[companyName].employees.push(employeeName);
          companyStats[companyName].totalEmployees += 1;
        }
      });

      const companyArray = Object.values(companyStats).sort(
        (a, b) => b.totalAmount - a.totalAmount
      );

      // Now apply filters using the fresh data
      let filteredEmployeeData = employeeData;
      let filteredSupportStaffData = supportStaffData;
      let filteredCompanyData = companyArray;

      // Filter by date range
      if (startDate || endDate) {
        if (startDate) {
          filteredEmployeeData = filteredEmployeeData.filter((record) => record.date >= startDate);
          filteredSupportStaffData = filteredSupportStaffData.filter((record) => record.date >= startDate);
        }
        if (endDate) {
          filteredEmployeeData = filteredEmployeeData.filter((record) => record.date <= endDate);
          filteredSupportStaffData = filteredSupportStaffData.filter((record) => record.date <= endDate);
        }
      }

      // Filter by employee
      if (selectedEmployee) {
        filteredEmployeeData = filteredEmployeeData.filter(
          (record) =>
            record.employeeId === selectedEmployee ||
            record.employeeName.toLowerCase().includes(selectedEmployee.toLowerCase())
        );
      }

      // Filter by support staff
      if (selectedSupportStaff) {
        filteredSupportStaffData = filteredSupportStaffData.filter(
          (record) =>
            record.staffId === selectedSupportStaff ||
            record.staffName.toLowerCase().includes(selectedSupportStaff.toLowerCase())
        );
      }

      // Filter by company
      if (selectedCompany) {
        filteredEmployeeData = filteredEmployeeData.filter((record) => record.company === selectedCompany);
        filteredSupportStaffData = filteredSupportStaffData.filter((record) => record.company === selectedCompany);
        filteredCompanyData = filteredCompanyData.filter((company) => company.companyName === selectedCompany);
      }

      // Filter by user (only for admins)
      if (isAdmin() && selectedUser) {
        const userId = Number(selectedUser);
        filteredEmployeeData = filteredEmployeeData.filter(
          (record) => record.userId === userId
        );
        filteredSupportStaffData = filteredSupportStaffData.filter(
          (record) => record.userId === userId
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

      // Update summary stats
      updateSummaryStats(activeTab, filteredEmployeeData, filteredSupportStaffData, filteredCompanyData);

      // Update state with filtered data
      setReportData(filteredEmployeeData);
      setSupportStaffReportData(filteredSupportStaffData);
      setCompanyReportData(filteredCompanyData);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete transaction');
      // Reload data on error to ensure consistency
      await loadReportData(undefined, priceMaster);
    }
  };

  const handleExportReport = async () => {
    let dataToExport: any[];
    let headers: string[];
    let fileName: string;

    if (activeTab === "employee") {
      dataToExport = reportData;
      headers = [
        "Bill No",
        "Employee ID",
        "Employee Name",
        "Company",
        "Billed On",
        "Item",
        "Amount",
      ];
      fileName = "employee-report";
    } else if (activeTab === "supportStaff") {
      dataToExport = supportStaffReportData;
      headers = [
        "Bill No",
        "Staff ID",
        "Staff Name",
        "Company",
        "Billed On",
        "Item",
        "Amount",
      ];
      fileName = "support-staff-report";
    } else if (activeTab === "feedback") {
      dataToExport = feedbackRecords;
      headers = [
        "Date",
        "Meal Type",
        "Employee ID",
        "Employee Name",
        "Company",
        "Rating",
      ];
      fileName = "feedback-report";
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
        ...reportData.map((record) => {
          const itemName = record.breakfast === 1 ? "Breakfast" : record.lunch === 1 ? "Lunch" : "";
          return [
            record.id,
            record.employeeId,
            record.employeeName + (record.hasException ? ' (Obtained more)' : ''),
            record.company,
            formatBilledOn(record.createdAt, record.date, record.time),
            itemName + (record.hasException ? ' (EXC)' : ''),
            `₹${record.amount}`,
          ];
        }),
      ];
    } else if (activeTab === "supportStaff") {
      excelData = [
        headers,
        ...supportStaffReportData.map((record) => {
          const itemName = record.breakfast === 1 ? "Breakfast" : record.lunch === 1 ? "Lunch" : "";
          return [
            record.id,
            record.staffId,
            record.staffName + (record.hasException ? ' (Obtained more)' : ''),
            record.company,
            formatBilledOn(record.createdAt, record.date, record.time),
            itemName + (record.hasException ? ' (EXC)' : ''),
            `₹${record.amount}`,
          ];
        }),
      ];
    } else if (activeTab === "feedback") {
      excelData = [
        headers,
        ...feedbackRecords.map((record) => [
          record.date,
          record.mealType.charAt(0).toUpperCase() + record.mealType.slice(1),
          record.employeeId,
          record.employeeName || "Unknown",
          record.companyName || "—",
          record.rating,
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
        activeTab === 'employee' ? 'Employee Report' :
          activeTab === 'supportStaff' ? 'Support Staff Report' :
            activeTab === 'feedback' ? 'Feedback Report' :
              'Company Report'
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
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap cursor-pointer ${activeTab === "employee"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
              >
                <i className="ri-user-line mr-2"></i>
                Employee Report
              </button>
              <button
                onClick={() => setActiveTab("supportStaff")}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap cursor-pointer ${activeTab === "supportStaff"
                  ? "border-purple-500 text-purple-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
              >
                <i className="ri-tools-line mr-2"></i>
                Support Staff Report
              </button>
              <button
                onClick={() => setActiveTab("company")}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap cursor-pointer ${activeTab === "company"
                  ? "border-green-500 text-green-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
              >
                <i className="ri-building-line mr-2"></i>
                Company Report
              </button>
              <button
                onClick={() => setActiveTab("feedback")}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap cursor-pointer ${activeTab === "feedback"
                  ? "border-amber-500 text-amber-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
              >
                <i className="ri-star-smile-line mr-2"></i>
                Feedback Report
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
                    {transactionEmployees.map((emp, index) => (
                      <option key={emp.id || emp.employeeId || index} value={emp.employeeId}>
                        {emp.employeeName || 'Unknown'} ({emp.employeeId || 'N/A'})
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
                  {transactionCompanies.map((company) => (
                    <option key={company} value={company}>
                      {company}
                    </option>
                  ))}
                </select>
              </div>

              {isAdmin() && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Created By
                  </label>
                  <select
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none pr-8"
                  >
                    <option value="">All Users</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.username})
                      </option>
                    ))}
                  </select>
                </div>
              )}

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
        {activeTab === "employee" && (
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
                      onClick={() => { setSortKey('id'); setSortDir(sortKey === 'id' && sortDir === 'ASC' ? 'DESC' : 'ASC'); handleGenerateReport(); }}
                    >
                      Bill No {sortKey === 'id' ? (sortDir === 'ASC' ? '▲' : '▼') : ''}
                    </th>
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
                    {isAdmin() && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                        onClick={() => { setSortKey('createdBy'); setSortDir(sortKey === 'createdBy' && sortDir === 'ASC' ? 'DESC' : 'ASC'); handleGenerateReport(); }}
                      >
                        Created By {sortKey === 'createdBy' ? (sortDir === 'ASC' ? '▲' : '▼') : ''}
                      </th>
                    )}
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                      onClick={() => { setSortKey('createdAt'); setSortDir(sortKey === 'createdAt' && sortDir === 'ASC' ? 'DESC' : 'ASC'); handleGenerateReport(); }}
                    >
                      Billed On {sortKey === 'createdAt' ? (sortDir === 'ASC' ? '▲' : '▼') : ''}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Item
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                      onClick={() => { setSortKey('amount'); setSortDir(sortKey === 'amount' && sortDir === 'ASC' ? 'DESC' : 'ASC'); handleGenerateReport(); }}
                    >
                      Amount {sortKey === 'amount' ? (sortDir === 'ASC' ? '▲' : '▼') : ''}
                    </th>
                    {isAdmin() && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reportData.length === 0 ? (
                    <tr>
                      <td
                        colSpan={isAdmin() ? 9 : 7}
                        className="px-6 py-8 text-center text-gray-500"
                      >
                        No employee or guest report data available. Generate
                        reports after employee and guest billing transactions.
                      </td>
                    </tr>
                  ) : (
                    getCurrentPageData(reportData).map((record, index) => {
                      // Determine item name: if breakfast quantity is 1, show "Breakfast", if lunch quantity is 1, show "Lunch"
                      const itemName = record.breakfast === 1 ? "Breakfast" : record.lunch === 1 ? "Lunch" : "";
                      return (
                        <tr
                          key={record.id || index}
                          className={`hover:bg-gray-50 ${record.isGuest ? "bg-green-50" : ""
                            }`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {record.id}
                          </td>
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
                            <div className="flex items-center gap-2">
                              <span>{record.employeeName}</span>
                              {record.hasException && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                  <i className="ri-error-warning-line mr-1"></i>
                                  Obtained more
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {record.company}
                          </td>
                          {isAdmin() && (
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {record.createdBy}
                            </td>
                          )}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatBilledOn(record.createdAt, record.date, record.time)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {itemName}
                            {record.hasException && (
                              <span className="ml-2 text-xs text-orange-700">(EXC)</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            ₹{record.amount}
                          </td>
                          {isAdmin() && (
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <button
                                onClick={() => handleDeleteTransaction(record.id)}
                                className="text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1 rounded-md transition-colors cursor-pointer"
                                title="Delete transaction"
                              >
                                <i className="ri-delete-bin-line"></i>
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
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
                            className={`px-3 py-1 text-sm border rounded ${currentPage === page
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
        )}

        {activeTab === "supportStaff" && (
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
                      onClick={() => { setSortKey('id'); setSortDir(sortKey === 'id' && sortDir === 'ASC' ? 'DESC' : 'ASC'); handleGenerateReport(); }}
                    >
                      Bill No {sortKey === 'id' ? (sortDir === 'ASC' ? '▲' : '▼') : ''}
                    </th>
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
                    {isAdmin() && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                        onClick={() => { setSortKey('createdBy'); setSortDir(sortKey === 'createdBy' && sortDir === 'ASC' ? 'DESC' : 'ASC'); handleGenerateReport(); }}
                      >
                        Created By {sortKey === 'createdBy' ? (sortDir === 'ASC' ? '▲' : '▼') : ''}
                      </th>
                    )}
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                      onClick={() => { setSortKey('createdAt'); setSortDir(sortKey === 'createdAt' && sortDir === 'ASC' ? 'DESC' : 'ASC'); handleGenerateReport(); }}
                    >
                      Billed On {sortKey === 'createdAt' ? (sortDir === 'ASC' ? '▲' : '▼') : ''}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Item
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                      onClick={() => { setSortKey('amount'); setSortDir(sortKey === 'amount' && sortDir === 'ASC' ? 'DESC' : 'ASC'); handleGenerateReport(); }}
                    >
                      Amount {sortKey === 'amount' ? (sortDir === 'ASC' ? '▲' : '▼') : ''}
                    </th>
                    {isAdmin() && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {supportStaffReportData.length === 0 ? (
                    <tr>
                      <td
                        colSpan={isAdmin() ? 9 : 7}
                        className="px-6 py-8 text-center text-gray-500"
                      >
                        No support staff report data available. Generate reports
                        after support staff billing transactions.
                      </td>
                    </tr>
                  ) : (
                    getCurrentPageData(supportStaffReportData).map((record, index) => {
                      // Determine item name: if breakfast quantity is 1, show "Breakfast", if lunch quantity is 1, show "Lunch"
                      const itemName = record.breakfast === 1 ? "Breakfast" : record.lunch === 1 ? "Lunch" : "";
                      return (
                        <tr key={record.id || index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {record.id}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {record.staffId}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="flex items-center gap-2">
                              <span>{record.staffName}</span>
                              {record.hasException && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                  <i className="ri-error-warning-line mr-1"></i>
                                  Obtained more
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {record.company}
                          </td>
                          {isAdmin() && (
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {record.createdBy}
                            </td>
                          )}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatBilledOn(record.createdAt, record.date, record.time)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {itemName}
                            {record.hasException && (
                              <span className="ml-2 text-xs text-orange-700">(EXC)</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            ₹{record.amount}
                          </td>
                          {isAdmin() && (
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <button
                                onClick={() => handleDeleteTransaction(record.id)}
                                className="text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1 rounded-md transition-colors cursor-pointer"
                                title="Delete transaction"
                              >
                                <i className="ri-delete-bin-line"></i>
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
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
                            className={`px-3 py-1 text-sm border rounded ${currentPage === page
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
        )}

        {activeTab === "company" && (
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
                            className={`px-3 py-1 text-sm border rounded ${currentPage === page
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

        {activeTab === "feedback" && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  Employee Feedback
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  All feedback submitted by employees for breakfast and lunch, with rating distribution.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {feedbackSummary && (
                  <div className="flex flex-wrap gap-3 text-sm">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-100">
                      <i className="ri-star-smile-line text-amber-500"></i>
                    <span className={`font-medium ${ratingTextClass(feedbackSummary?.avgRating)}`}>
                        Avg rating:{" "}
                        {feedbackSummary.avgRating != null ? feedbackSummary.avgRating.toFixed(2) : "N/A"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-100">
                      <i className="ri-message-2-line text-slate-500"></i>
                      <span className="font-medium text-slate-700">
                        Total feedback: {feedbackSummary.total}
                      </span>
                    </div>
                  </div>
                )}
                {/* <button
                  onClick={handleExportReport}
                  disabled={feedbackRecords.length === 0}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm inline-flex items-center gap-2"
                >
                  <i className="ri-download-line"></i>
                  Download Report
                </button> */}
              </div>
            </div>

            <div className="p-4 space-y-6">
              {/* Feedback list */}
              <div className="overflow-x-auto">
                {feedbackLoading ? (
                  <div className="py-12 text-center text-gray-500">
                    <i className="ri-loader-4-line text-2xl animate-spin mb-2"></i>
                    <p>Loading feedback…</p>
                  </div>
                ) : feedbackRecords.length === 0 ? (
                  <div className="py-12 text-center text-gray-500">
                    <i className="ri-emotion-unhappy-line text-3xl mb-2"></i>
                    <p>No feedback found for the selected range.</p>
                  </div>
                ) : (
                  <>
                    <table className="w-full min-w-[640px]">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Meal
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Employee
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Company
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Rating
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {paginatedFeedbackRecords.map((f) => (
                          <tr key={f.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => { setFeedbackModalItem(f); setFeedbackModalOpen(true); }}>
                            <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                              {f.date}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap capitalize">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${f.mealType === "breakfast"
                                  ? "bg-orange-50 text-orange-700 border border-orange-100"
                                  : "bg-green-50 text-green-700 border border-green-100"
                                  }`}
                              >
                                {f.mealType === "breakfast" ? (
                                  <i className="ri-restaurant-line mr-1"></i>
                                ) : (
                                  <i className="ri-bowl-line mr-1"></i>
                                )}
                                {f.mealType}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                              <div className="flex flex-col">
                                <span>{f.employeeName || "Unknown"}</span>
                                <span className="text-xs text-gray-500">
                                  {f.employeeId}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                              {f.companyName || "—"}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1">
                                <span className="font-semibold">{f.rating}</span>
                                <i className="ri-star-fill text-amber-400 text-xs"></i>
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {/* Feedback detail modal */}
                    {feedbackModalOpen && feedbackModalItem && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/50" onClick={() => setFeedbackModalOpen(false)}></div>
                        <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full z-10 overflow-auto">
                          <div className="p-4 border-b flex items-center justify-between">
                            <div>
                              <h3 className="text-lg font-semibold text-gray-800">Feedback details</h3>
                              <div className="text-sm text-gray-500">{feedbackModalItem.date} · {feedbackModalItem.mealType}</div>
                            </div>
                            <button onClick={() => setFeedbackModalOpen(false)} className="p-2 text-gray-600 hover:bg-gray-100 rounded">
                              <i className="ri-close-line"></i>
                            </button>
                          </div>
                          <div className="p-4 space-y-3">
                            <div>
                              <div className="text-sm text-gray-600">Employee</div>
                              <div className="text-base font-medium">{feedbackModalItem.employeeName || feedbackModalItem.employeeId}</div>
                            </div>
                            <div>
                              <div className="text-sm text-gray-600">Overall rating</div>
                              <div className={`text-xl font-semibold ${ratingTextClass(feedbackModalItem.rating)}`}>{feedbackModalItem.rating} / 5</div>
                            </div>
                            {feedbackModalItem.items && feedbackModalItem.items.length > 0 && (
                              <div>
                                <div className="text-sm text-gray-600 mb-2">Per-item feedback</div>
                                <ul className="space-y-2">
                                  {feedbackModalItem.items.map((it: any, idx: number) => (
                                    <li key={idx} className="border rounded p-2 flex items-center justify-between">
                                      <div className="font-medium text-gray-800">{it.name}</div>
                                      <div className={`${ratingBadgeText(it.rating)} font-semibold`}>{it.rating} / 5</div>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Pagination for feedback list */}
                    {feedbackRecords.length > FEEDBACK_PAGE_SIZE && (
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                        <div className="text-gray-600">
                          Page {feedbackPage} of {feedbackTotalPages} • Showing{" "}
                          {Math.min((feedbackPage - 1) * FEEDBACK_PAGE_SIZE + 1, feedbackRecords.length)}–
                          {Math.min(feedbackPage * FEEDBACK_PAGE_SIZE, feedbackRecords.length)} of{" "}
                          {feedbackRecords.length}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setFeedbackPage((p) => Math.max(1, p - 1))}
                            disabled={feedbackPage <= 1}
                            className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Previous
                          </button>
                          <button
                            type="button"
                            onClick={() => setFeedbackPage((p) => Math.min(feedbackTotalPages, p + 1))}
                            disabled={feedbackPage >= feedbackTotalPages}
                            className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Visual summary */}
              {feedbackSummary && feedbackSummary.total > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Summary cards */}
                  <div className="space-y-4 lg:col-span-1">
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-amber-700 mb-1">Overall average</p>
                        <p className="text-2xl font-bold text-amber-700">
                          {feedbackSummary.avgRating != null ? feedbackSummary.avgRating.toFixed(2) : "N/A"}
                        </p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                        <i className="ri-star-smile-line text-xl text-amber-600"></i>
                      </div>
                    </div>
                    <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-orange-700 mb-1">Breakfast</p>
                        <p className="text-lg font-semibold text-orange-700">
                          {feedbackSummary.byMeal.breakfast.count > 0
                            ? (feedbackSummary.byMeal.breakfast.avgRating?.toFixed(2) ?? "N/A")
                            : "No feedback"}
                        </p>
                        <p className="text-xs text-orange-700/80 mt-0.5">
                          {feedbackSummary.byMeal.breakfast.count} responses
                        </p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                        <i className="ri-restaurant-line text-xl text-orange-600"></i>
                      </div>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-emerald-700 mb-1">Lunch</p>
                        <p className="text-lg font-semibold text-emerald-700">
                          {feedbackSummary.byMeal.lunch.count > 0
                            ? (feedbackSummary.byMeal.lunch.avgRating?.toFixed(2) ?? "N/A")
                            : "No feedback"}
                        </p>
                        <p className="text-xs text-emerald-700/80 mt-0.5">
                          {feedbackSummary.byMeal.lunch.count} responses
                        </p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                        <i className="ri-bowl-line text-xl text-emerald-600"></i>
                      </div>
                    </div>
                  </div>
                  {/* Per-item averages */}
                  <div className="bg-white rounded-xl border border-gray-200 p-4 lg:col-span-2">
                    <h3 className="text-sm font-semibold text-gray-800 mb-2">Item-wise averages</h3>
                    {feedbackSummary?.itemStats && Object.keys(feedbackSummary.itemStats).length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {Object.entries(feedbackSummary.itemStats).map(([name, stat]: any) => (
                          <div key={name} className="p-3 border rounded-lg flex items-center justify-between">
                            <div>
                              <div className="font-medium text-gray-800">{name}</div>
                              <div className="text-xs text-gray-500">{stat.count} reviews</div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-semibold text-amber-700">{stat.avgRating != null ? stat.avgRating.toFixed(2) : 'N/A'}</div>
                              <div className="text-xs text-gray-500">avg rating</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No itemized feedback available.</p>
                    )}
                  </div>

                  {/* Rating distribution bars */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 lg:col-span-3">
                    <h3 className="text-sm font-semibold text-slate-800 mb-2">
                      Rating distribution
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">
                      Relative frequency of 1–5 star ratings across all feedback.
                    </p>
                    {(() => {
                      const entries = [5, 4, 3, 2, 1].map((r) => ({
                        rating: r,
                        count: feedbackSummary.byRating[String(r)] ?? feedbackSummary.byRating[r] ?? 0,
                      }));
                      const maxCount = Math.max(...entries.map((e) => e.count), 1);
                      const colorFor = (r: number) => {
                        if (r >= 4) return "bg-emerald-500";
                        if (r === 3) return "bg-amber-500";
                        return "bg-red-500";
                      };
                      return (
                        <div className="space-y-3">
                          {entries.map(({ rating, count }) => {
                            const widthPct = (count / maxCount) * 100;
                            const pctOfTotal =
                              feedbackSummary.total > 0
                                ? Math.round((count / feedbackSummary.total) * 100)
                                : 0;
                            return (
                              <div key={rating} className="flex items-center gap-3">
                                <div className="w-14 text-xs font-medium text-slate-700 flex items-center gap-1">
                                  <span>{rating}</span>
                                  <i className="ri-star-fill text-[10px] text-amber-400"></i>
                                </div>
                                <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                                  <div
                                    className={`h-2 rounded-full ${colorFor(rating)}`}
                                    style={{ width: widthPct + "%" }}
                                  ></div>
                                </div>
                                <div className="w-20 text-right text-xs text-slate-600">
                                  {count} ({pctOfTotal}%)
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
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
