import { useState, useEffect, useRef, useCallback } from "react";
import Layout from "../../components/feature/Layout";
import { apiFetch, mastersApi } from "../../api/client";
import { buildReceiptHtml } from "./receiptBuilder";
import { useSocketEvent } from "../../contexts/SocketContext";

export default function Billing() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedEmployeeObj, setSelectedEmployeeObj] =
    useState<Employee | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [allGuests, setAllGuests] = useState<Guest[]>([]); // Store all guests for filtering
  const [selectedGuest, setSelectedGuest] = useState("");
  const [selectedGuestObj, setSelectedGuestObj] = useState<Guest | null>(null);
  const [newGuestName, setNewGuestName] = useState("");
  const [guestCompanyName, setGuestCompanyName] = useState("");
  const [isGuest, setIsGuest] = useState(false);
  const [isSupportStaff, setIsSupportStaff] = useState(false);
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [supportStaff, setSupportStaff] = useState<SupportStaff[]>([]);
  const [selectedSupportStaff, setSelectedSupportStaff] = useState("");
  const [selectedSupportStaffObj, setSelectedSupportStaffObj] =
    useState<SupportStaff | null>(null);
  // Unified search state
  const [customerSearch, setCustomerSearch] = useState("");
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [addCustomerType, setAddCustomerType] = useState<"employee" | "supportStaff" | "guest">("guest");
  const [newSupportStaffName, setNewSupportStaffName] = useState("");
  const [newSupportStaffId, setNewSupportStaffId] = useState("");
  const [newSupportStaffDesignation, setNewSupportStaffDesignation] =
    useState("");
  const [newSupportStaffCompany, setNewSupportStaffCompany] = useState("");
  const [companyNames, setCompanyNames] = useState<string[]>([]);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationData, setValidationData] = useState<{
    itemName: string;
    employeeName: string;
    consumedToday: { breakfast: number; lunch: number };
  } | null>(null);
  const [showSubmitExceptionModal, setShowSubmitExceptionModal] = useState(false);
  const [serverWarningState, setServerWarningState] = useState<{ breakfastExceeded?: boolean; lunchExceeded?: boolean } | null>(null);
  const [pendingSubmit, setPendingSubmit] = useState<{ payload: any; billingData: any } | null>(null);
  const [pendingItem, setPendingItem] = useState<(typeof menuItems)[0] | null>(
    null
  );
  const [priceMaster, setPriceMaster] = useState<PriceMaster>({
    employee: { breakfast: 20, lunch: 48 },
    company: { breakfast: 135, lunch: 165 },
  });

  // Thermal receipt ref
  const receiptRef = useRef<HTMLDivElement | null>(null);

  // Load data from API on component mount
  const loadMasterData = async () => {
    try {
      // Load price master first to ensure menu prices are up-to-date
      const priceMasterData = await mastersApi.getPriceMaster();
      setPriceMaster(priceMasterData);

      // Load employees
      const employeeRes = await mastersApi.getEmployees({
        limit: 1000,
        sortBy: "employeeName",
      });
      const employeeData = (
        Array.isArray((employeeRes as any)?.data)
          ? (employeeRes as any).data
          : employeeRes
      ) as Employee[];
      setEmployees(employeeData);

      // Extract unique company names from employees
      const uniqueCompanies = [
        ...new Set(
          employeeData
            .map((emp: Employee) => emp.companyName)
            .filter((company: string) => company && company.trim() !== "")
        ),
      ];
      setCompanyNames(uniqueCompanies as string[]);

      // Load saved guests
      const guestRes = await mastersApi.getGuests({
        limit: 1000,
        sortBy: "name",
      });
      const guestData = (
        Array.isArray((guestRes as any)?.data)
          ? (guestRes as any).data
          : guestRes
      ) as Guest[];
      setGuests(guestData);
      setAllGuests(guestData); // Store all guests for filtering

      // Load saved support staff
      const supportRes = await mastersApi.getSupportStaff({
        limit: 1000,
        sortBy: "name",
      });
      const supportStaffData = (
        Array.isArray((supportRes as any)?.data)
          ? (supportRes as any).data
          : supportRes
      ) as SupportStaff[];
      setSupportStaff(supportStaffData);
    } catch (error) {
      console.error("Error loading master data:", error);
      alert("Failed to load master data. Please refresh the page.");
    }
  };

  useEffect(() => {
    loadMasterData();
  }, []);

  useSocketEvent('master:updated', loadMasterData);

  // Extract employee ID from URL (e.g., https://contacts.dev.refex.group/vcard/VRPL025062)
  const extractEmployeeIdFromUrl = (searchText: string): string | null => {
    const urlPattern = /\/vcard\/([A-Z0-9]+)/i;
    const match = searchText.match(urlPattern);
    return match ? match[1] : null;
  };

  // Unified search - debounced server-side search for all customer types
  useEffect(() => {
    const handle = setTimeout(async () => {
      if (!customerSearch.trim()) {
        // If search is empty, load all data
        try {
          const [employeeRes, supportRes, guestRes] = await Promise.all([
            mastersApi.getEmployees({
              limit: 1000,
              sortBy: "employeeName",
            }),
            mastersApi.getSupportStaff({
              limit: 1000,
              sortBy: "name",
            }),
            mastersApi.getGuests({
              limit: 1000,
              sortBy: "name",
            }),
          ]);
          const employeeData = (
            Array.isArray((employeeRes as any)?.data)
              ? (employeeRes as any).data
              : employeeRes
          ) as Employee[];
          const supportStaffData = (
            Array.isArray((supportRes as any)?.data)
              ? (supportRes as any).data
              : supportRes
          ) as SupportStaff[];
          const guestData = (
            Array.isArray((guestRes as any)?.data)
              ? (guestRes as any).data
              : guestRes
          ) as Guest[];
          setEmployees(employeeData);
          setSupportStaff(supportStaffData);
          setGuests(guestData);
          setAllGuests(guestData);
        } catch (e) {
          console.error("Error loading master data:", e);
        }
        return;
      }

      // Extract employee ID from URL if present
      const extractedId = extractEmployeeIdFromUrl(customerSearch);
      const searchQuery = extractedId || customerSearch;

      try {
        // Search employees, support staff, and guests in parallel
        const [employeeRes, supportRes, guestRes] = await Promise.all([
          mastersApi.getEmployees({
            q: searchQuery,
            limit: 50,
            sortBy: "employeeName",
          }),
          mastersApi.getSupportStaff({
            q: searchQuery,
            limit: 50,
            sortBy: "name",
          }),
          mastersApi.getGuests({
            q: searchQuery,
            limit: 50,
            sortBy: "name",
          }),
        ]);
        const employeeList = (
          Array.isArray((employeeRes as any)?.data)
            ? (employeeRes as any).data
            : employeeRes
        ) as Employee[];
        const supportStaffList = (
          Array.isArray((supportRes as any)?.data)
            ? (supportRes as any).data
            : supportRes
        ) as SupportStaff[];
        const guestList = (
          Array.isArray((guestRes as any)?.data)
            ? (guestRes as any).data
            : guestRes
        ) as Guest[];
        setEmployees(employeeList);
        setSupportStaff(supportStaffList);
        setGuests(guestList);
        setAllGuests(guestList);
      } catch (e) {
        console.error("Error searching customers:", e);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [customerSearch]);

  const menuItems = [
    { id: "1", name: "Breakfast", price: 0, category: "Breakfast" },
    { id: "2", name: "Lunch", price: 0, category: "Lunch" },
  ];

  // Unified filtering for all customer types
  const getFilteredCustomers = () => {
    if (!customerSearch.trim()) {
      return {
        employees: [],
        supportStaff: [],
        guests: [],
      };
    }

    // Extract employee ID from URL if present
    const extractedId = extractEmployeeIdFromUrl(customerSearch);
    const searchLower = (extractedId || customerSearch).toLowerCase();

    const filteredEmployees = employees.filter(
      (emp) =>
        emp.employeeName.toLowerCase().includes(searchLower) ||
        emp.employeeId.toLowerCase().includes(searchLower) ||
        emp.companyName?.toLowerCase().includes(searchLower)
    );

    const filteredSupportStaff = supportStaff.filter(
      (staff) =>
        staff.name.toLowerCase().includes(searchLower) ||
        staff.staffId.toLowerCase().includes(searchLower) ||
        staff.designation?.toLowerCase().includes(searchLower) ||
        staff.companyName?.toLowerCase().includes(searchLower)
    );

    const filteredGuests = allGuests.filter(
      (guest) =>
        guest.name.toLowerCase().includes(searchLower) ||
        guest.companyName.toLowerCase().includes(searchLower)
    );

    return {
      employees: filteredEmployees,
      supportStaff: filteredSupportStaff,
      guests: filteredGuests,
    };
  };

  const filteredCustomers = getFilteredCustomers();

  // Handle customer selection from unified search
  const handleCustomerSelect = useCallback((
    type: "employee" | "supportStaff" | "guest",
    id: string,
    obj: Employee | SupportStaff | Guest
  ) => {
    // Clear all selections first
    setSelectedEmployee("");
    setSelectedEmployeeObj(null);
    setSelectedSupportStaff("");
    setSelectedSupportStaffObj(null);
    setSelectedGuest("");
    setSelectedGuestObj(null);
    setIsGuest(false);
    setIsSupportStaff(false);

    // Set the selected customer
    if (type === "employee") {
      setSelectedEmployee(id);
      setSelectedEmployeeObj(obj as Employee);
      setIsGuest(false);
      setIsSupportStaff(false);
      setCustomerSearch(`${(obj as Employee).employeeName} (${(obj as Employee).employeeId})`);
    } else if (type === "supportStaff") {
      setSelectedSupportStaff(id);
      setSelectedSupportStaffObj(obj as SupportStaff);
      setIsGuest(false);
      setIsSupportStaff(true);
      setCustomerSearch(`${(obj as SupportStaff).name} (${(obj as SupportStaff).staffId})`);
    } else if (type === "guest") {
      setSelectedGuest(id);
      setSelectedGuestObj(obj as Guest);
      setIsGuest(true);
      setIsSupportStaff(false);
      setCustomerSearch(`${(obj as Guest).name} - ${(obj as Guest).companyName}`);
    }
  }, []);

  // Clear selection when search field is cleared
  useEffect(() => {
    if (!customerSearch.trim() && (selectedEmployee || selectedSupportStaff || selectedGuest)) {
      setSelectedEmployee("");
      setSelectedEmployeeObj(null);
      setSelectedSupportStaff("");
      setSelectedSupportStaffObj(null);
      setSelectedGuest("");
      setSelectedGuestObj(null);
      setIsGuest(false);
      setIsSupportStaff(false);
    }
  }, [customerSearch, selectedEmployee, selectedSupportStaff, selectedGuest]);

  // Auto-select customer if URL is pasted and only one result is found
  useEffect(() => {
    // Only auto-select if:
    // 1. Search is not empty
    // 2. It's a URL (contains /vcard/)
    // 3. No customer is currently selected
    // 4. There's exactly one result total across all types
    const isUrl = customerSearch.includes("/vcard/");
    const totalResults = 
      filteredCustomers.employees.length +
      filteredCustomers.supportStaff.length +
      filteredCustomers.guests.length;
    const hasSelection = selectedEmployee || selectedSupportStaff || selectedGuest;

    if (
      customerSearch.trim() &&
      isUrl &&
      !hasSelection &&
      totalResults === 1
    ) {
      // Auto-select the single result
      if (filteredCustomers.employees.length === 1) {
        const emp = filteredCustomers.employees[0];
        handleCustomerSelect("employee", emp.id.toString(), emp);
      } else if (filteredCustomers.supportStaff.length === 1) {
        const staff = filteredCustomers.supportStaff[0];
        handleCustomerSelect("supportStaff", staff.id.toString(), staff);
      } else if (filteredCustomers.guests.length === 1) {
        const guest = filteredCustomers.guests[0];
        handleCustomerSelect("guest", guest.id.toString(), guest);
      }
    }
  }, [filteredCustomers, customerSearch, selectedEmployee, selectedSupportStaff, selectedGuest, handleCustomerSelect]);

  // Check if employee/support staff has already consumed meals today
  const checkConsumption = (personId: string, isEmployee: boolean = true) => {
    const today = new Date().toISOString().split("T")[0];
    const billingHistory = JSON.parse(
      localStorage.getItem("billingHistory") || "[]"
    );

    const todaysBills = billingHistory.filter(
      (bill: any) =>
        bill.date === today &&
        !bill.isGuest &&
        (isEmployee
          ? !bill.isSupportStaff && bill.customer?.employeeId === personId
          : bill.isSupportStaff && bill.customer?.staffId === personId)
    );

    let breakfastCount = 0;
    let lunchCount = 0;

    todaysBills.forEach((bill: any) => {
      bill.items.forEach((item: any) => {
        if (item.name === "Breakfast") {
          breakfastCount += item.quantity;
        } else if (item.name === "Lunch") {
          lunchCount += item.quantity;
        }
      });
    });

    return { breakfast: breakfastCount, lunch: lunchCount };
  };

  const addToCart = async (item: (typeof menuItems)[0]) => {
    // First check if customer is selected
    if (!selectedEmployee && !selectedSupportStaff && !selectedGuest) {
      alert("Please select a customer first");
      return;
    }

    // Only validate for employees and support staff, not guests
    if (!isGuest) {
      let person: any = null;
      let personName = "";
      let isEmployee = true;

      if (isSupportStaff && selectedSupportStaff) {
        person = supportStaff.find(
          (staff) => staff.id.toString() === selectedSupportStaff
        );
        personName = person?.name || "";
        isEmployee = false;
      } else if (!isSupportStaff && selectedEmployee) {
        person = employees.find(
          (emp) => emp.id.toString() === selectedEmployee
        );
        personName = person?.employeeName || "";
        isEmployee = true;
      }

      if (person) {
        const personId = isEmployee ? person.employeeId : person.staffId;
        const consumedToday = checkConsumption(personId, isEmployee);

        // Check if already consumed today
        let wouldExceedLimit = false;

        if (item.name === "Breakfast") {
          wouldExceedLimit = consumedToday.breakfast >= 1;
        } else if (item.name === "Lunch") {
          wouldExceedLimit = consumedToday.lunch >= 1;
        }

        if (wouldExceedLimit) {
          // Show validation modal
          setValidationData({
            itemName: item.name,
            employeeName: personName,
            consumedToday,
          });
          setPendingItem(item);
          setShowValidationModal(true);
          return;
        }
      }
    }

    // Set cart with only this item (quantity 1)
    setCart([{ ...item, quantity: 1 }]);

    // Automatically print the bill
    await handlePrintBillDirect([{ ...item, quantity: 1 }]);
  };

  const handleValidationConfirm = async (addException: boolean) => {
    if (addException && pendingItem) {
      // Set cart with only this item (quantity 1) with exception flag
      const itemWithException = { ...pendingItem, quantity: 1, isException: true };
      setCart([itemWithException]);
      
      // Automatically print the bill
      await handlePrintBillDirect([itemWithException]);
    }

    // Close modal and reset
    setShowValidationModal(false);
    setValidationData(null);
    setPendingItem(null);
  };

  // Remove updateQuantity function as quantity controls are removed

  const addGuest = async () => {
    if (newGuestName && guestCompanyName) {
      try {
        const newGuest = await mastersApi.createGuest({
          name: newGuestName,
          companyName: guestCompanyName,
        });
        setGuests([...guests, newGuest]);
        setAllGuests([...allGuests, newGuest]); // Also update allGuests
        handleCustomerSelect("guest", newGuest.id.toString(), newGuest);
        setNewGuestName("");
        setGuestCompanyName("");
        setShowAddGuest(false);
      } catch (error: any) {
        console.error("Error creating guest:", error);
        alert(error.message || "Failed to create guest");
      }
    }
  };

  const addSupportStaff = async () => {
    if (newSupportStaffName && newSupportStaffId) {
      try {
        const newStaff = await mastersApi.createSupportStaff({
          staffId: newSupportStaffId,
          name: newSupportStaffName,
          designation: newSupportStaffDesignation,
          companyName: newSupportStaffCompany,
        });
        setSupportStaff([...supportStaff, newStaff]);
        handleCustomerSelect("supportStaff", newStaff.id.toString(), newStaff);
        setNewSupportStaffName("");
        setNewSupportStaffId("");
        setNewSupportStaffDesignation("");
        setNewSupportStaffCompany("");
      } catch (error: any) {
        console.error("Error creating support staff:", error);
        alert(error.message || "Failed to create support staff");
      }
    }
  };

  const handlePrintBillDirect = async (itemsToPrint: CartItem[]) => {
    if (itemsToPrint.length === 0) return;

    if (isGuest && !selectedGuest && !showAddGuest) {
      alert("Please select a guest or add a new guest");
      return;
    }

    if (isSupportStaff && !selectedSupportStaff) {
      alert("Please select support staff");
      return;
    }

    if (!isGuest && !isSupportStaff && !selectedEmployee) {
      alert("Please select an employee");
      return;
    }

    // Get current user login info for support staff validation
    const currentUser = localStorage.getItem("currentUser") || "admin";

    // Calculate total amount based on price master - ALL use employee pricing now
    let totalAmount = 0;
    let customerData = null;

    if (isGuest) {
      customerData =
        selectedGuestObj ||
        allGuests.find((g) => g.id.toString() === selectedGuest);
    } else if (isSupportStaff) {
      customerData =
        selectedSupportStaffObj ||
        supportStaff.find((s) => s.id.toString() === selectedSupportStaff);

      // Apply company validation based on login
      if (customerData) {
        if (currentUser === "refextower") {
          customerData = {
            ...customerData,
            companyName: "Refex Industries Limited",
          };
        } else if (currentUser === "bazullah") {
          customerData = {
            ...customerData,
            companyName: "Refex Holding Private Limited",
          };
        }
      }
    } else {
      customerData =
        selectedEmployeeObj ||
        employees.find((e) => e.id.toString() === selectedEmployee);
    }

    // Only one item allowed - calculate for that single item
    const item = itemsToPrint[0];
    const itemPrice =
      item.name === "Breakfast"
        ? priceMaster.employee.breakfast
        : priceMaster.employee.lunch;
    totalAmount = itemPrice * item.quantity;

    // Build transaction payload for backend - only one item
    const billingData = {
      id: Date.now().toString(), // Temporary ID, will be replaced with DB ID
      date: new Date().toISOString().split("T")[0],
      time: new Date().toLocaleTimeString(),
      isGuest,
      isSupportStaff,
      customer: customerData,
      items: [{
        ...item,
        // Store the actual price used for this transaction - all use employee pricing now
        actualPrice: itemPrice,
      }],
      totalItems: item.quantity,
      totalAmount,
      // Store pricing type for reports - all use employee pricing now
      pricingType: "employee",
    };

    try {
      // Build payload - only one item
      const payload = {
        customerType: isGuest
          ? "guest"
          : isSupportStaff
            ? "supportStaff"
            : "employee",
        customerId: isGuest
          ? selectedGuest || null
          : isSupportStaff
            ? (customerData as SupportStaff | null)?.staffId || null
            : (customerData as Employee | null)?.employeeId || null,
        customerName: isGuest
          ? (customerData as Guest | null)?.name || null
          : isSupportStaff
            ? (customerData as SupportStaff | null)?.name || null
            : (customerData as Employee | null)?.employeeName || null,
        companyName: customerData?.companyName || null,
        date: billingData.date,
        time: billingData.time,
        items: [{
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          isException: item.isException || false,
          actualPrice: itemPrice,
        }],
        totalItems: item.quantity,
        totalAmount: totalAmount,
      };

      // Server-side validation (skip for guests)
      if (!isGuest && payload.customerId) {
        const validateRes = await apiFetch(`/transactions?validateOnly=true`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        const warnings = validateRes?.warnings || {};
        if (warnings.breakfastExceeded || warnings.lunchExceeded) {
          setServerWarningState({
            breakfastExceeded: !!warnings.breakfastExceeded,
            lunchExceeded: !!warnings.lunchExceeded,
          });
          setPendingSubmit({ payload, billingData });
          setShowSubmitExceptionModal(true);
          return; // wait for user choice
        }
      }

      const response = await apiFetch("/transactions", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      // Get the actual transaction ID from database response
      const transactionId =
        response?.id || response?.data?.id || Date.now().toString();
      billingData.id = transactionId.toString();

      // Prepare receipt HTML and send to Electron for silent print, fallback to window.print
      const html = buildReceiptHtml(billingData);
      console.log("html", html);
      await printReceipt(html, billingData);
    } catch (err: any) {
      alert(err.message || "Failed to save transaction");
      return;
    }

    // Clear form
    setCart([]);
    setSelectedEmployee("");
    setSelectedEmployeeObj(null);
    setSelectedGuest("");
    setSelectedGuestObj(null);
    setSelectedSupportStaff("");
    setSelectedSupportStaffObj(null);
    setCustomerSearch("");
    setIsGuest(false);
    setIsSupportStaff(false);
  };

  const printReceipt = async (html: any, _billingData: any) => {
    // Create hidden iframe
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const cleanup = () => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    };

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      cleanup();
      alert("Unable to access print document");
      return;
    }

    // Write receipt HTML
    doc.open();
    doc.write(html);
    doc.close();

    const printAndCleanup = () => {
      try {
        const contentWindow = iframe.contentWindow;
        if (!contentWindow) {
          cleanup();
          return;
        }
        
        contentWindow.focus();

        // ✅ Silent print when Chrome launched with --kiosk-printing
        contentWindow.print();

        // Wait briefly to ensure print is sent to printer before removing iframe
        setTimeout(cleanup, 1000);
      } catch (err) {
        console.error("Print error:", err);
        cleanup();
      }
    };

    // Wait until iframe fully loads
    const contentDoc = iframe.contentDocument;
    if (contentDoc && contentDoc.readyState === "complete") {
      printAndCleanup();
    } else {
      iframe.onload = printAndCleanup;
    }
  };

  const handleSubmitExceptionChoice = async (proceedWithException: boolean) => {
    const state = pendingSubmit;
    if (!state) {
      setShowSubmitExceptionModal(false);
      return;
    }
    if (!proceedWithException) {
      // Cancel
      setShowSubmitExceptionModal(false);
      setServerWarningState(null);
      setPendingSubmit(null);
      return;
    }

    try {
      // Apply exception flags to exceeded items - only one item
      const warn = serverWarningState || {};
      const convert = (items: any[]) =>
        items.map((it: any) => {
          const isBreakfast = it.name === "Breakfast";
          const isLunch = it.name === "Lunch";
          if ((isBreakfast && warn.breakfastExceeded) || (isLunch && warn.lunchExceeded)) {
            return { ...it, isException: true };
          }
          return it;
        });

      const payload = { ...state.payload, items: convert(state.payload.items) };
      const billingData = { ...state.billingData, items: convert(state.billingData.items) };

      const response = await apiFetch("/transactions", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const transactionId = response?.id || response?.data?.id || Date.now().toString();
      billingData.id = transactionId.toString();

      const html = buildReceiptHtml(billingData);
      await printReceipt(html, billingData);

      // Clear modal state
      setShowSubmitExceptionModal(false);
      setServerWarningState(null);
      setPendingSubmit(null);

      // Clear form
      setCart([]);
      setSelectedEmployee("");
      setSelectedEmployeeObj(null);
      setSelectedGuest("");
      setSelectedGuestObj(null);
      setSelectedSupportStaff("");
      setSelectedSupportStaffObj(null);
      setCustomerSearch("");
      setIsGuest(false);
      setIsSupportStaff(false);
    } catch (err: any) {
      setShowSubmitExceptionModal(false);
      alert(err?.message || "Failed to save transaction");
    }
  };

  // use shared receipt builder (imported)

  const getSelectedPersonName = () => {
    if (selectedGuest) {
      const guest = allGuests.find((g) => g.id.toString() === selectedGuest);
      return guest ? `${guest.name} (${guest.companyName})` : "";
    } else if (selectedSupportStaff) {
      const staff = supportStaff.find(
        (s) => s.id.toString() === selectedSupportStaff
      );
      return staff ? `${staff.name} (${staff.staffId})` : "";
    } else if (selectedEmployee) {
      const employee = employees.find(
        (e) => e.id.toString() === selectedEmployee
      );
      return employee
        ? `${employee.employeeName} (${employee.employeeId})`
        : "";
    }
    return "";
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto h-full">
        {/* Hidden receipt container for browser fallback printing */}
        <div ref={receiptRef} id="thermal-receipt-host"></div>
        {/* Validation Modal */}
        {showValidationModal && validationData && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-red-600 flex items-center">
                    <i className="ri-alert-line mr-2"></i>
                    Daily Consumption Limit Reached
                  </h2>
                  <button
                    onClick={() => handleValidationConfirm(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg cursor-pointer"
                  >
                    <i className="ri-close-line text-xl"></i>
                  </button>
                </div>
              </div>

              <div className="p-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start">
                    <i className="ri-warning-line text-yellow-600 text-xl mr-3 mt-0.5"></i>
                    <div>
                      <h3 className="font-semibold text-yellow-800 mb-2">
                        Daily Limit Alert
                      </h3>
                      <p className="text-sm text-blue-700 mb-3">
                        <strong>{validationData.employeeName}</strong> has
                        already consumed today:
                      </p>
                      <div className="space-y-1 text-sm text-blue-700">
                        <div className="flex items-center">
                          <i className="ri-restaurant-line mr-2"></i>
                          <span>
                            Breakfast: {validationData.consumedToday.breakfast}{" "}
                            time(s) (Daily Limit: 1)
                          </span>
                        </div>
                        <div className="flex items-center">
                          <i className="ri-bowl-line mr-2"></i>
                          <span>
                            Lunch: {validationData.consumedToday.lunch} time(s)
                            (Daily Limit: 1)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start">
                    <i className="ri-information-line text-blue-600 text-xl mr-3 mt-0.5"></i>
                    <div>
                      <h4 className="font-semibold text-blue-800 mb-2">
                        Exception Option Available
                      </h4>
                      <p className="text-sm text-blue-700">
                        You can add an additional{" "}
                        <strong>{validationData.itemName.toLowerCase()}</strong>{" "}
                        as an exception (e.g., consuming on behalf of someone
                        else or special circumstances).
                      </p>
                      <p className="text-xs text-blue-600 mt-2 font-medium">
                        Exception items will be marked separately in the bill.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => handleValidationConfirm(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 cursor-pointer whitespace-nowrap font-medium transition-colors"
                  >
                    <i className="ri-close-line mr-2"></i>
                    Cancel
                  </button>
                  <button
                    onClick={() => handleValidationConfirm(true)}
                    className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 cursor-pointer whitespace-nowrap font-medium transition-colors flex items-center justify-center"
                  >
                    <i className="ri-add-line mr-2"></i>
                    Add as Exception
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Submit Exception Modal */}
        {showSubmitExceptionModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-red-600 flex items-center">
                    <i className="ri-alert-line mr-2"></i>
                    Already obtained meal today
                  </h2>
                  <button
                    onClick={() => handleSubmitExceptionChoice(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg cursor-pointer"
                  >
                    <i className="ri-close-line text-xl"></i>
                  </button>
                </div>
              </div>

              <div className="p-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4 text-sm text-yellow-800">
                  {serverWarningState?.breakfastExceeded && (
                    <div className="flex items-center mb-1">
                      <i className="ri-restaurant-line mr-2"></i>
                      Breakfast already taken today.
                    </div>
                  )}
                  {serverWarningState?.lunchExceeded && (
                    <div className="flex items-center">
                      <i className="ri-bowl-line mr-2"></i>
                      Lunch already taken today.
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-sm text-blue-800">
                  Proceed as an Exception to record an additional meal for today. Exception items will be marked in bill and reports.
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => handleSubmitExceptionChoice(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 cursor-pointer whitespace-nowrap font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSubmitExceptionChoice(true)}
                    className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 cursor-pointer whitespace-nowrap font-medium transition-colors"
                  >
                    Exception
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Customer Modal */}
        {showAddCustomerModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                    <i className="ri-user-add-line mr-2"></i>
                    Add Customer
                  </h2>
                  <button
                    onClick={() => {
                      setShowAddCustomerModal(false);
                      setAddCustomerType("guest");
                      setNewGuestName("");
                      setGuestCompanyName("");
                      setNewSupportStaffName("");
                      setNewSupportStaffId("");
                      setNewSupportStaffDesignation("");
                      setNewSupportStaffCompany("");
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg cursor-pointer"
                  >
                    <i className="ri-close-line text-xl"></i>
                  </button>
                </div>
              </div>

              <div className="p-6">
                {/* Customer Type Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer Type
                  </label>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setAddCustomerType("guest")}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all ${
                        addCustomerType === "guest"
                          ? "bg-green-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      <i className="ri-user-add-line mr-1"></i>
                      Guest
                    </button>
                    <button
                      onClick={() => setAddCustomerType("supportStaff")}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all ${
                        addCustomerType === "supportStaff"
                          ? "bg-purple-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      <i className="ri-tools-line mr-1"></i>
                      Support Staff
                    </button>
                  </div>
                </div>

                {/* Guest Form */}
                {addCustomerType === "guest" && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        Guest Name
                      </label>
                      <input
                        type="text"
                        value={newGuestName}
                        onChange={(e) => setNewGuestName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                        placeholder="Enter guest name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        Company Name
                      </label>
                      {companyNames.length > 0 ? (
                        <div className="relative">
                          <select
                            value={guestCompanyName}
                            onChange={(e) => setGuestCompanyName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none pr-8 appearance-none"
                          >
                            <option value="">Select company...</option>
                            {companyNames.map((company, index) => (
                              <option key={index} value={company}>
                                {company}
                              </option>
                            ))}
                          </select>
                          <i className="ri-arrow-down-s-line absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none"></i>
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={guestCompanyName}
                          onChange={(e) => setGuestCompanyName(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                          placeholder="Enter company name"
                        />
                      )}
                    </div>
                    <div className="flex space-x-3 pt-2">
                      <button
                        onClick={() => {
                          setShowAddCustomerModal(false);
                          setNewGuestName("");
                          setGuestCompanyName("");
                        }}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 cursor-pointer font-medium transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={async () => {
                          await addGuest();
                          setShowAddCustomerModal(false);
                        }}
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer font-medium transition-colors"
                      >
                        <i className="ri-add-line mr-1"></i>
                        Add Guest
                      </button>
                    </div>
                  </div>
                )}

                {/* Support Staff Form */}
                {addCustomerType === "supportStaff" && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        Staff ID
                      </label>
                      <input
                        type="text"
                        value={newSupportStaffId}
                        onChange={(e) => setNewSupportStaffId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                        placeholder="Enter staff ID"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        Staff Name
                      </label>
                      <input
                        type="text"
                        value={newSupportStaffName}
                        onChange={(e) => setNewSupportStaffName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                        placeholder="Enter staff name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        Designation
                      </label>
                      <select
                        value={newSupportStaffDesignation}
                        onChange={(e) => setNewSupportStaffDesignation(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none pr-8 appearance-none"
                      >
                        <option value="">Select designation...</option>
                        <option value="Driver">Driver</option>
                        <option value="Office Assistant">Office Assistant</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        Company Name
                      </label>
                      {companyNames.length > 0 ? (
                        <div className="relative">
                          <select
                            value={newSupportStaffCompany}
                            onChange={(e) => setNewSupportStaffCompany(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none pr-8 appearance-none"
                          >
                            <option value="">Select company...</option>
                            {companyNames.map((company, index) => (
                              <option key={index} value={company}>
                                {company}
                              </option>
                            ))}
                          </select>
                          <i className="ri-arrow-down-s-line absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none"></i>
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={newSupportStaffCompany}
                          onChange={(e) => setNewSupportStaffCompany(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                          placeholder="Enter company name"
                        />
                      )}
                    </div>
                    <div className="flex space-x-3 pt-2">
                      <button
                        onClick={() => {
                          setShowAddCustomerModal(false);
                          setNewSupportStaffName("");
                          setNewSupportStaffId("");
                          setNewSupportStaffDesignation("");
                          setNewSupportStaffCompany("");
                        }}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 cursor-pointer font-medium transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={async () => {
                          await addSupportStaff();
                          setShowAddCustomerModal(false);
                        }}
                        className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 cursor-pointer font-medium transition-colors"
                      >
                        <i className="ri-add-line mr-1"></i>
                        Add Staff
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 h-full">
          {/* Menu Items - Fixed Height Container */}
          <div className="xl:col-span-2 flex flex-col h-full">
            {/* Header - Compact */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Billing</h1>
                <p className="text-gray-600 text-sm">
                  Select items and process orders
                </p>
              </div>
              <div className="mt-2 sm:mt-0">
                <a href="/billing/self" className="inline-flex items-center px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm">
                  Employee Self-Billing
                </a>
              </div>
            </div>

            {/* Menu Items - Fixed Height, No Scroll */}
            <div className="flex-1 space-y-3">
              {/* Breakfast Section - Compact */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden billing-menu-card">
                <div className="p-3 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-orange-100">
                  <h2 className="text-base font-semibold text-gray-900 flex items-center">
                    <div className="w-6 h-6 bg-orange-500 rounded-lg flex items-center justify-center mr-2">
                      <i className="ri-restaurant-line text-white text-xs"></i>
                    </div>
                    Breakfast Menu
                  </h2>
                  <p className="text-xs text-gray-600 mt-1">
                    Price: ₹{priceMaster.employee.breakfast} per item
                  </p>
                </div>
                <div className="p-3">
                  <button
                    onClick={() => addToCart(menuItems[0])}
                    className="bg-gradient-to-br from-orange-50 to-orange-100 hover:from-orange-100 hover:to-orange-200 border border-orange-200 hover:border-orange-300 rounded-lg p-3 text-center transition-all cursor-pointer w-full group hover:shadow-md"
                  >
                    <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                      <i className="ri-restaurant-line text-lg text-white"></i>
                    </div>
                    <h3 className="font-semibold text-gray-900 text-sm mb-1">
                      Breakfast
                    </h3>
                    <p className="text-orange-600 font-bold">
                      ₹{priceMaster.employee.breakfast}
                    </p>
                  </button>
                </div>
              </div>

              {/* Lunch Section - Compact */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden billing-menu-card">
                <div className="p-3 border-b border-gray-200 bg-gradient-to-r from-green-50 to green-100">
                  <h2 className="text-base font-semibold text-gray-900 flex items-center">
                    <div className="w-6 h-6 bg-green-500 rounded-lg flex items-center justify-center mr-2">
                      <i className="ri-bowl-line text-white text-xs"></i>
                    </div>
                    Lunch Menu
                  </h2>
                  <p className="text-xs text-gray-600 mt-1">
                    Price: ₹{priceMaster.employee.lunch} per item
                  </p>
                </div>
                <div className="p-3">
                  <button
                    onClick={() => addToCart(menuItems[1])}
                    className="bg-gradient-to-br from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 border border-green-200 hover:border-green-300 rounded-lg p-3 text-center transition-all cursor-pointer w-full group hover:shadow-md"
                  >
                    <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                      <i className="ri-bowl-line text-lg text-white"></i>
                    </div>
                    <h3 className="font-semibold text-gray-900 text-sm mb-1">
                      Lunch
                    </h3>
                    <p className="text-green-600 font-bold">
                      ₹{priceMaster.employee.lunch}
                    </p>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Cart & Billing - Fixed Height */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col h-full billing-order-summary">
            <div className="p-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100 flex-shrink-0">
              <h2 className="text-base font-semibold text-gray-900 flex items-center">
                <i className="ri-shopping-cart-line mr-2 text-blue-600"></i>
                Order Summary
              </h2>
              <p className="text-xs text-gray-600 mt-1">
                Review your order details
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {/* Unified Customer Search */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-gray-700">
                    <i className="ri-search-line mr-1"></i>
                    Search Customer
                  </label>
                  <button
                    onClick={() => setShowAddCustomerModal(true)}
                    className="text-blue-600 hover:text-blue-700 text-xs font-medium cursor-pointer hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors flex items-center"
                  >
                    <i className="ri-add-line mr-1"></i>
                    Add Customer
                  </button>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full px-3 py-2 pl-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
                    placeholder="Search by ID, Name or Scan QR Code"
                  />
                  <i className="ri-search-line absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm"></i>
                </div>

                {/* Show selected customer */}
                {(selectedEmployee || selectedSupportStaff || selectedGuest) && (
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center mr-2 ${
                          selectedEmployee ? "bg-blue-500" :
                          selectedSupportStaff ? "bg-purple-500" :
                          "bg-green-500"
                        }`}>
                          <i className={`text-white text-xs ${
                            selectedEmployee ? "ri-user-line" :
                            selectedSupportStaff ? "ri-tools-line" :
                            "ri-user-add-line"
                          }`}></i>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-blue-900">
                            Selected {selectedEmployee ? "Employee" : selectedSupportStaff ? "Support Staff" : "Guest"}
                          </p>
                          <p className="text-xs text-blue-700">
                            {getSelectedPersonName()}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedEmployee("");
                          setSelectedEmployeeObj(null);
                          setSelectedSupportStaff("");
                          setSelectedSupportStaffObj(null);
                          setSelectedGuest("");
                          setSelectedGuestObj(null);
                          setCustomerSearch("");
                          setIsGuest(false);
                          setIsSupportStaff(false);
                        }}
                        className="text-blue-600 hover:text-blue-800 cursor-pointer p-1 hover:bg-blue-100 rounded-lg transition-colors"
                      >
                        <i className="ri-close-line text-xs"></i>
                      </button>
                    </div>
                  </div>
                )}

                {/* Unified search results - grouped by type */}
                {customerSearch &&
                  !selectedEmployee &&
                  !selectedSupportStaff &&
                  !selectedGuest &&
                  (filteredCustomers.employees.length > 0 ||
                    filteredCustomers.supportStaff.length > 0 ||
                    filteredCustomers.guests.length > 0) && (
                    <div className="mt-2 max-h-96 overflow-y-auto border border-gray-200 rounded-lg bg-white shadow-lg">
                      {/* Employees Section */}
                      {filteredCustomers.employees.length > 0 && (
                        <div>
                          <div className="px-3 py-2 bg-blue-50 border-b border-blue-200 sticky top-0">
                            <p className="text-xs font-semibold text-blue-900">
                              Employees:
                            </p>
                          </div>
                          {filteredCustomers.employees.map((emp) => (
                            <button
                              key={emp.id}
                              onClick={() =>
                                handleCustomerSelect("employee", emp.id.toString(), emp)
                              }
                              className="w-full px-2 py-2 text-left hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                            >
                              <div className="flex items-center space-x-2">
                                {emp.qrCode ? (
                                  <div className="w-7 h-7 border border-gray-300 rounded-lg overflow-hidden">
                                    <img
                                      src={emp.qrCode}
                                      alt="QR"
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                ) : (
                                  <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <i className="ri-user-line text-blue-500 text-xs"></i>
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-gray-900 truncate text-xs">
                                    {emp.employeeName}
                                  </div>
                                  <div className="text-xs text-gray-500 truncate">
                                    {emp.employeeId} •{" "}
                                    {emp.companyName || "No Company"}
                                  </div>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Support Staff Section */}
                      {filteredCustomers.supportStaff.length > 0 && (
                        <div>
                          <div className="px-3 py-2 bg-purple-50 border-b border-purple-200 sticky top-0">
                            <p className="text-xs font-semibold text-purple-900">
                              Support Staff:
                            </p>
                          </div>
                          {filteredCustomers.supportStaff.map((staff) => (
                            <button
                              key={staff.id}
                              onClick={() =>
                                handleCustomerSelect("supportStaff", staff.id.toString(), staff)
                              }
                              className="w-full px-2 py-2 text-left hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                            >
                              <div className="flex items-center space-x-2">
                                <div className="w-7 h-7 bg-purple-100 rounded-lg flex items-center justify-center">
                                  <i className="ri-tools-line text-purple-500 text-xs"></i>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-gray-900 truncate text-xs">
                                    {staff.name}
                                  </div>
                                  <div className="text-xs text-gray-500 truncate">
                                    {staff.staffId} •{" "}
                                    {staff.designation || "No Designation"}
                                  </div>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Guests Section */}
                      {filteredCustomers.guests.length > 0 && (
                        <div>
                          <div className="px-3 py-2 bg-green-50 border-b border-green-200 sticky top-0">
                            <p className="text-xs font-semibold text-green-900">
                              Guest:
                            </p>
                          </div>
                          {filteredCustomers.guests.map((guest) => (
                            <button
                              key={guest.id}
                              onClick={() =>
                                handleCustomerSelect("guest", guest.id.toString(), guest)
                              }
                              className="w-full px-2 py-2 text-left hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                            >
                              <div className="flex items-center space-x-2">
                                <div className="w-7 h-7 bg-green-100 rounded-lg flex items-center justify-center">
                                  <i className="ri-user-add-line text-green-500 text-xs"></i>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-gray-900 truncate text-xs">
                                    {guest.name}
                                  </div>
                                  <div className="text-xs text-gray-500 truncate">
                                    {guest.companyName}
                                  </div>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                {/* No results message */}
                {customerSearch &&
                  !selectedEmployee &&
                  !selectedSupportStaff &&
                  !selectedGuest &&
                  filteredCustomers.employees.length === 0 &&
                  filteredCustomers.supportStaff.length === 0 &&
                  filteredCustomers.guests.length === 0 && (
                    <div className="mt-2 p-2 text-center text-gray-500 border border-gray-200 rounded-lg bg-gray-50">
                      <i className="ri-search-line text-lg mb-1 block"></i>
                      <p className="text-xs">
                        No customers found matching "{customerSearch}"
                      </p>
                    </div>
                  )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

// Type definitions
interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
  isException?: boolean;
}

interface Employee {
  id: number;
  employeeName: string;
  employeeId: string;
  companyName: string;
  qrCode?: string;
}

interface Guest {
  id: number;
  name: string;
  companyName: string;
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
