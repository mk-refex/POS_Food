import { useState, useEffect, useRef } from "react";
import Layout from "../../components/feature/Layout";
import { apiFetch, mastersApi } from "../../api/client";

export default function Billing() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedEmployeeObj, setSelectedEmployeeObj] =
    useState<Employee | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [guests, setGuests] = useState<Guest[]>([]);
  const [allGuests, setAllGuests] = useState<Guest[]>([]); // Store all guests for filtering
  const [selectedGuest, setSelectedGuest] = useState("");
  const [selectedGuestObj, setSelectedGuestObj] = useState<Guest | null>(null);
  const [newGuestName, setNewGuestName] = useState("");
  const [guestCompanyName, setGuestCompanyName] = useState("");
  const [isGuest, setIsGuest] = useState(false);
  const [isSupportStaff, setIsSupportStaff] = useState(false);
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [guestSearch, setGuestSearch] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [supportStaff, setSupportStaff] = useState<SupportStaff[]>([]);
  const [selectedSupportStaff, setSelectedSupportStaff] = useState("");
  const [selectedSupportStaffObj, setSelectedSupportStaffObj] =
    useState<SupportStaff | null>(null);
  const [supportStaffSearch, setSupportStaffSearch] = useState("");
  const [showAddSupportStaff, setShowAddSupportStaff] = useState(false);
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
  useEffect(() => {
    loadMasterData();
  }, []);

  const loadMasterData = async () => {
    try {
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

      // Load price master
      const priceMasterData = await mastersApi.getPriceMaster();
      setPriceMaster(priceMasterData);
    } catch (error) {
      console.error("Error loading master data:", error);
      alert("Failed to load master data. Please refresh the page.");
    }
  };

  // Debounced server-side search for employees
  useEffect(() => {
    const handle = setTimeout(async () => {
      try {
        const res = await mastersApi.getEmployees({
          q: employeeSearch,
          limit: 50,
          sortBy: "employeeName",
        });
        const list = (
          Array.isArray((res as any)?.data) ? (res as any).data : res
        ) as Employee[];
        setEmployees(list);
      } catch (e) {}
    }, 300);
    return () => clearTimeout(handle);
  }, [employeeSearch]);

  // Debounced server-side search for support staff
  useEffect(() => {
    const handle = setTimeout(async () => {
      try {
        const res = await mastersApi.getSupportStaff({
          q: supportStaffSearch,
          limit: 50,
          sortBy: "name",
        });
        const list = (
          Array.isArray((res as any)?.data) ? (res as any).data : res
        ) as SupportStaff[];
        setSupportStaff(list);
      } catch (e) {}
    }, 300);
    return () => clearTimeout(handle);
  }, [supportStaffSearch]);

  // Note: Removed server-side search for guests - using client-side filtering instead
  // This ensures dropdown always shows all guests while search filters client-side

  const menuItems = [
    { id: "1", name: "Breakfast", price: 0, category: "Breakfast" },
    { id: "2", name: "Lunch", price: 0, category: "Lunch" },
  ];

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.employeeName.toLowerCase().includes(employeeSearch.toLowerCase()) ||
      emp.employeeId.toLowerCase().includes(employeeSearch.toLowerCase())
  );

  const filteredSupportStaff = supportStaff.filter(
    (staff) =>
      staff.name.toLowerCase().includes(supportStaffSearch.toLowerCase()) ||
      staff.staffId.toLowerCase().includes(supportStaffSearch.toLowerCase())
  );

  // Filter guests based on search (using allGuests for client-side filtering)
  const filteredGuests = allGuests.filter(
    (guest) =>
      guest.name.toLowerCase().includes(guestSearch.toLowerCase()) ||
      guest.companyName.toLowerCase().includes(guestSearch.toLowerCase())
  );

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

  const addToCart = (item: (typeof menuItems)[0]) => {
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

        // Check current cart items (non-exception items only)
        const currentBreakfastInCart = cart
          .filter((cartItem) => cartItem.id === "1" && !cartItem.isException)
          .reduce((sum, cartItem) => sum + cartItem.quantity, 0);

        const currentLunchInCart = cart
          .filter((cartItem) => cartItem.id === "2" && !cartItem.isException)
          .reduce((sum, cartItem) => sum + cartItem.quantity, 0);

        // Calculate what the total would be after adding this item
        let wouldExceedLimit = false;

        if (item.name === "Breakfast") {
          // For breakfast: check if total consumed today + current cart + new item would exceed 1
          wouldExceedLimit =
            consumedToday.breakfast + currentBreakfastInCart + 1 > 1;
        } else if (item.name === "Lunch") {
          // For lunch: check if total consumed today + current cart + new item would exceed 1
          wouldExceedLimit = consumedToday.lunch + currentLunchInCart + 1 > 1;
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

    // Add to cart normally
    const existingItem = cart.find(
      (cartItem) => cartItem.id === item.id && !cartItem.isException
    );
    if (existingItem) {
      setCart(
        cart.map((cartItem) =>
          cartItem.id === item.id && !cartItem.isException
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        )
      );
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
  };

  const handleValidationConfirm = (addException: boolean) => {
    if (addException && pendingItem) {
      // Add to cart with exception flag
      const existingExceptionItem = cart.find(
        (cartItem) => cartItem.id === pendingItem.id && cartItem.isException
      );
      if (existingExceptionItem) {
        setCart(
          cart.map((cartItem) =>
            cartItem.id === pendingItem.id && cartItem.isException
              ? { ...cartItem, quantity: cartItem.quantity + 1 }
              : cartItem
          )
        );
      } else {
        setCart([...cart, { ...pendingItem, quantity: 1, isException: true }]);
      }
    }

    // Close modal and reset
    setShowValidationModal(false);
    setValidationData(null);
    setPendingItem(null);
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity === 0) {
      setCart(cart.filter((item) => item.id !== id));
    } else {
      const item = cart.find((cartItem) => cartItem.id === id);
      if (!item) return;

      // Check validation when increasing quantity for employees/support staff (non-exception items only)
      if (!isGuest && quantity > item.quantity && !item.isException) {
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

          // Calculate other cart items (non-exception only, excluding current item)
          const otherBreakfastInCart = cart
            .filter(
              (cartItem) =>
                cartItem.id === "1" &&
                cartItem.id !== id &&
                !cartItem.isException
            )
            .reduce((sum, cartItem) => sum + cartItem.quantity, 0);

          const otherLunchInCart = cart
            .filter(
              (cartItem) =>
                cartItem.id === "2" &&
                cartItem.id !== id &&
                !cartItem.isException
            )
            .reduce((sum, cartItem) => sum + cartItem.quantity, 0);

          // Check if increasing quantity would exceed limit
          let wouldExceedLimit = false;

          if (item.name === "Breakfast") {
            // For breakfast: total consumed + other cart items + new quantity should not exceed 1
            wouldExceedLimit =
              consumedToday.breakfast + otherBreakfastInCart + quantity > 1;
          } else if (item.name === "Lunch") {
            // For lunch: total consumed + other cart items + new quantity should not exceed 1
            wouldExceedLimit =
              consumedToday.lunch + otherLunchInCart + quantity > 1;
          }

          if (wouldExceedLimit) {
            // Show validation modal
            setValidationData({
              itemName: item.name,
              employeeName: personName,
              consumedToday,
            });
            setPendingItem({
              id: item.id,
              name: item.name,
              price: item.price,
              category: item.category,
            });
            setShowValidationModal(true);
            return;
          }
        }
      }

      setCart(
        cart.map((cartItem) =>
          cartItem.id === id ? { ...cartItem, quantity } : cartItem
        )
      );
    }
  };

  const addGuest = async () => {
    if (newGuestName && guestCompanyName) {
      try {
        const newGuest = await mastersApi.createGuest({
          name: newGuestName,
          companyName: guestCompanyName,
        });
        setGuests([...guests, newGuest]);
        setAllGuests([...allGuests, newGuest]); // Also update allGuests
        setSelectedGuest(newGuest.id.toString());
        setSelectedGuestObj(newGuest);
        setNewGuestName("");
        setGuestCompanyName("");
        setShowAddGuest(false);
        setGuestSearch(`${newGuest.name} - ${newGuest.companyName}`);
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
        setSelectedSupportStaff(newStaff.id.toString());
        setNewSupportStaffName("");
        setNewSupportStaffId("");
        setNewSupportStaffDesignation("");
        setNewSupportStaffCompany("");
        setShowAddSupportStaff(false);
      } catch (error: any) {
        console.error("Error creating support staff:", error);
        alert(error.message || "Failed to create support staff");
      }
    }
  };

  const handlePrintBill = async () => {
    if (cart.length === 0) return;

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

    cart.forEach((item) => {
      // All customer types now use employee pricing
      const itemPrice =
        item.name === "Breakfast"
          ? priceMaster.employee.breakfast
          : priceMaster.employee.lunch;

      totalAmount += itemPrice * item.quantity;
    });

    // Build transaction payload for backend
    const billingData = {
      id: Date.now().toString(), // Temporary ID, will be replaced with DB ID
      date: new Date().toISOString().split("T")[0],
      time: new Date().toLocaleTimeString(),
      isGuest,
      isSupportStaff,
      customer: customerData,
      items: cart.map((item) => ({
        ...item,
        // Store the actual price used for this transaction - all use employee pricing now
        actualPrice:
          item.name === "Breakfast"
            ? priceMaster.employee.breakfast
            : priceMaster.employee.lunch,
      })),
      totalItems: cart.reduce((sum, item) => sum + item.quantity, 0),
      totalAmount,
      // Store pricing type for reports - all use employee pricing now
      pricingType: "employee",
    };

    try {
      // Build payload
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
        items: billingData.items.map(
          ({ id, name, quantity, isException, actualPrice }) => ({
            id,
            name,
            quantity,
            isException,
            actualPrice,
          })
        ),
        totalItems: billingData.totalItems,
        totalAmount: billingData.totalAmount,
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
    setEmployeeSearch("");
    setSupportStaffSearch("");
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
        iframe.contentWindow.focus();

        // ✅ Silent print when Chrome launched with --kiosk-printing
        iframe.contentWindow.print();

        // Wait briefly to ensure print is sent to printer before removing iframe
        setTimeout(cleanup, 1000);
      } catch (err) {
        console.error("Print error:", err);
        cleanup();
      }
    };

    // Wait until iframe fully loads
    if (iframe.contentDocument.readyState === "complete") {
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
      // Apply exception flags to exceeded items
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
      setEmployeeSearch("");
      setSupportStaffSearch("");
    } catch (err: any) {
      setShowSubmitExceptionModal(false);
      alert(err?.message || "Failed to save transaction");
    }
  };

  const buildReceiptHtml = (billing: any) => {
    const customerName = billing.isGuest
      ? billing.customer?.name
      : billing.isSupportStaff
        ? billing.customer?.name
        : billing.customer?.employeeName;

    const currentUser = localStorage.getItem("currentUser") || "admin";
    let currentUserName = "Admin";
    try {
      const userData = JSON.parse(currentUser);
      currentUserName = userData?.name || userData?.username || "Admin";
    } catch (e) {
      currentUserName = "Admin";
    }

    const billNumber = billing.id;

    return `<!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8" />
    <title>Kitchen Print - Bill ${billNumber}</title>
    <style>
      @page {
        size: 80mm auto;
        margin: 0mm !important;
      }
      * {
        box-sizing: border-box;
      }
      body {
        font-family: monospace;
        width: 76mm; /* add small left/right margins within 80mm roll */
        margin: 0;
        padding: 0 2mm; /* 2mm left and right padding for small margins */
        font-size: 13px;
        line-height: 1.3;
        color: #000;
        background: #fff;
      }
      .center {
        font-size: 16px;
        text-align: center;
        font-weight: bold;
      }
      .section {
        margin: 4px 0;
      }
      .line {
        border-top: 1px dashed #000;
        margin: 4px 0;
      }
      .item-row {
        display: flex;
        justify-content: space-between;
        white-space: pre;
      }
    </style>
  </head>
  <body>
    <div class="center">KITCHEN PRINT</div>
    <div class="center">Refex Group</div>
    <div class="center">*** Bill No: ${billNumber} ***</div>
  
    <div class="section">
      <b>Customer:</b> ${customerName || ""}
      <br/><b>Created By:</b> ${currentUserName}
      <div class="item-row">
        <span><b>Date:</b> ${billing.date.split("-").reverse().join("/")}</span>
        <span><b>Time:</b> ${billing.time}</span>
      </div>
    </div>
  
    <div class="line"></div>
    <div class="item-row">
      <span><b>Item</b></span>
      <span><b>Qty</b></span>
    </div>
    <div class="line"></div>
  
    ${billing.items
      .map((it: any) => {
        const flag = it.isException ? " (EXC)" : "";
        return `<div class="item-row"><span>${it.name}${flag}</span><span>${it.quantity}</span></div>`;
      })
      .join("")}
  
    <div class="line"></div>
  </body>
  </html>`;
  };

  const getSelectedPersonName = () => {
    if (isGuest) {
      const guest = allGuests.find((g) => g.id.toString() === selectedGuest);
      return guest ? `${guest.name} (${guest.companyName})` : "";
    } else if (isSupportStaff) {
      const staff = supportStaff.find(
        (s) => s.id.toString() === selectedSupportStaff
      );
      return staff ? `${staff.name} (${staff.staffId})` : "";
    } else {
      const employee = employees.find(
        (e) => e.id.toString() === selectedEmployee
      );
      return employee
        ? `${employee.employeeName} (${employee.employeeId})`
        : "";
    }
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
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setIsGuest(false);
                    setIsSupportStaff(false);
                  }}
                  className={`px-3 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap transition-all ${
                    !isGuest && !isSupportStaff
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <i className="ri-user-line mr-1"></i>
                  Employee
                </button>
                <button
                  onClick={() => {
                    setIsGuest(false);
                    setIsSupportStaff(true);
                  }}
                  className={`px-3 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap transition-all ${
                    isSupportStaff
                      ? "bg-purple-600 text-white shadow-sm"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <i className="ri-tools-line mr-1"></i>
                  Support Staff
                </button>
                <button
                  onClick={() => {
                    setIsGuest(true);
                    setIsSupportStaff(false);
                  }}
                  className={`px-3 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap transition-all ${
                    isGuest
                      ? "bg-green-600 text-white shadow-sm"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <i className="ri-user-add-line mr-1"></i>
                  Guest
                </button>
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
              {/* Customer Selection */}
              {!isGuest && !isSupportStaff ? (
                // Employee Selection
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">
                    <i className="ri-search-line mr-1"></i>
                    Search Employee
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={employeeSearch}
                      onChange={(e) => setEmployeeSearch(e.target.value)}
                      className="w-full px-3 py-2 pl-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
                      placeholder="Search by name or ID..."
                    />
                    <i className="ri-search-line absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm"></i>
                  </div>

                  {/* Show selected employee */}
                  {selectedEmployee && (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="w-6 h-6 bg-blue-500 rounded-lg flex items-center justify-center mr-2">
                            <i className="ri-user-line text-white text-xs"></i>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-blue-900">
                              Selected Employee
                            </p>
                            <p className="text-xs text-blue-700">
                              {getSelectedPersonName()}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedEmployee("");
                            setEmployeeSearch("");
                          }}
                          className="text-blue-600 hover:text-blue-800 cursor-pointer p-1 hover:bg-blue-100 rounded-lg transition-colors"
                        >
                          <i className="ri-close-line text-xs"></i>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Employee search results */}
                  {employeeSearch &&
                    !selectedEmployee &&
                    filteredEmployees.length > 0 && (
                      <div className="mt-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-white shadow-lg">
                        {filteredEmployees.map((emp) => (
                          <button
                            key={emp.id}
                            onClick={() => {
                              setSelectedEmployee(emp.id.toString());
                              setSelectedEmployeeObj(emp);
                              setEmployeeSearch(
                                `${emp.employeeName} (${emp.employeeId})`
                              );
                            }}
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
                                <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center">
                                  <i className="ri-qr-code-line text-gray-500 text-xs"></i>
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

                  {employeeSearch &&
                    !selectedEmployee &&
                    filteredEmployees.length === 0 &&
                    employees.length > 0 && (
                      <div className="mt-2 p-2 text-center text-gray-500 border border-gray-200 rounded-lg bg-gray-50">
                        <i className="ri-search-line text-lg mb-1 block"></i>
                        <p className="text-xs">
                          No employees found matching "{employeeSearch}"
                        </p>
                      </div>
                    )}

                  {employees.length === 0 && !selectedEmployee && (
                    <div className="mt-2 p-2 text-center text-gray-500 border border-gray-200 rounded-lg bg-gray-50">
                      <i className="ri-user-add-line text-lg mb-1 block"></i>
                      <p className="text-xs">No employees available</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Please add employees in Master Data first
                      </p>
                    </div>
                  )}
                </div>
              ) : isSupportStaff ? (
                // Support Staff Selection
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-gray-700">
                      <i className="ri-tools-line mr-1"></i>
                      Search Support Staff
                    </label>
                    <button
                      onClick={() =>
                        setShowAddSupportStaff(!showAddSupportStaff)
                      }
                      className="text-purple-600 hover:text-purple-700 text-xs font-medium cursor-pointer hover:bg-purple-50 px-2 py-1 rounded-lg transition-colors"
                    >
                      <i className="ri-add-line mr-1"></i>
                      Add New
                    </button>
                  </div>

                  {showAddSupportStaff && (
                    <div className="space-y-2 p-2 bg-purple-50 rounded-lg border border-purple-200 mb-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Staff ID
                        </label>
                        <input
                          type="text"
                          value={newSupportStaffId}
                          onChange={(e) => setNewSupportStaffId(e.target.value)}
                          className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-xs"
                          placeholder="Enter staff ID"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Staff Name
                        </label>
                        <input
                          type="text"
                          value={newSupportStaffName}
                          onChange={(e) =>
                            setNewSupportStaffName(e.target.value)
                          }
                          className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-xs"
                          placeholder="Enter staff name"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Designation
                        </label>
                        <select
                          value={newSupportStaffDesignation}
                          onChange={(e) =>
                            setNewSupportStaffDesignation(e.target.value)
                          }
                          className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none pr-6 appearance-none text-xs"
                        >
                          <option value="">Select designation...</option>
                          <option value="Driver">Driver</option>
                          <option value="Office Assistant">
                            Office Assistant
                          </option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Company Name
                        </label>
                        {companyNames.length > 0 ? (
                          <div className="relative">
                            <select
                              value={newSupportStaffCompany}
                              onChange={(e) =>
                                setNewSupportStaffCompany(e.target.value)
                              }
                              className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none pr-6 appearance-none text-xs"
                            >
                              <option value="">Select company...</option>
                              {companyNames.map((company, index) => (
                                <option key={index} value={company}>
                                  {company}
                                </option>
                              ))}
                            </select>
                            <i className="ri-arrow-down-s-line absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none text-xs"></i>
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={newSupportStaffCompany}
                            onChange={(e) =>
                              setNewSupportStaffCompany(e.target.value)
                            }
                            className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-xs"
                            placeholder="Enter company name"
                          />
                        )}
                      </div>

                      <div className="flex space-x-2">
                        <button
                          onClick={addSupportStaff}
                          className="px-2 py-2 bg-purple-600 text-white rounded-lg text-xs hover:bg-purple-700 cursor-pointer whitespace-nowrap flex-1 font-medium transition-colors"
                        >
                          <i className="ri-add-line mr-1"></i>
                          Add Staff
                        </button>
                        <button
                          onClick={() => setShowAddSupportStaff(false)}
                          className="px-2 py-2 bg-gray-300 text-gray-700 rounded-lg text-xs hover:bg-gray-400 cursor-pointer whitespace-nowrap flex-1 font-medium transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="relative">
                    <input
                      type="text"
                      value={supportStaffSearch}
                      onChange={(e) => setSupportStaffSearch(e.target.value)}
                      className="w-full px-3 py-2 pl-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all text-sm"
                      placeholder="Search by name or ID..."
                    />
                    <i className="ri-search-line absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm"></i>
                  </div>

                  {/* Show selected support staff */}
                  {selectedSupportStaff && (
                    <div className="mt-2 p-2 bg-purple-50 border border-purple-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="w-6 h-6 bg-purple-500 rounded-lg flex items-center justify-center mr-2">
                            <i className="ri-tools-line text-white text-xs"></i>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-purple-900">
                              Selected Support Staff
                            </p>
                            <p className="text-xs text-purple-700">
                              {getSelectedPersonName()}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedSupportStaff("");
                            setSupportStaffSearch("");
                          }}
                          className="text-purple-600 hover:text-purple-800 cursor-pointer p-1 hover:bg-purple-100 rounded-lg transition-colors"
                        >
                          <i className="ri-close-line text-xs"></i>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Support staff search results */}
                  {supportStaffSearch &&
                    !selectedSupportStaff &&
                    filteredSupportStaff.length > 0 && (
                      <div className="mt-2 max-h-24 overflow-y-auto border border-gray-200 rounded-lg bg-white shadow-lg">
                        {filteredSupportStaff.map((staff) => (
                          <button
                            key={staff.id}
                            onClick={() => {
                              setSelectedSupportStaff(staff.id.toString());
                              setSelectedSupportStaffObj(staff);
                              setSupportStaffSearch(
                                `${staff.name} (${staff.staffId})`
                              );
                            }}
                            className="w-full px-2 py-2 text-left hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                          >
                            <div className="flex items-center space-x-2">
                              <div className="w-6 h-6 bg-purple-100 rounded-lg flex items-center justify-center">
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

                  {supportStaffSearch &&
                    !selectedSupportStaff &&
                    filteredSupportStaff.length === 0 &&
                    supportStaff.length > 0 && (
                      <div className="mt-2 p-2 text-center text-gray-500 border border-gray-200 rounded-lg bg-gray-50">
                        <i className="ri-search-line text-lg mb-1 block"></i>
                        <p className="text-xs">
                          No support staff found matching "{supportStaffSearch}"
                        </p>
                      </div>
                    )}

                  {supportStaff.length === 0 && !selectedSupportStaff && (
                    <div className="mt-2 p-2 text-center text-gray-500 border border-gray-200 rounded-lg bg-gray-50">
                      <i className="ri-tools-line text-lg mb-1 block"></i>
                      <p className="text-xs">No support staff available</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Add support staff above or in Master Data
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                // Guest Selection
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-gray-700">
                      <i className="ri-user-add-line mr-1"></i>
                      Select Guest
                    </label>
                    <button
                      onClick={() => setShowAddGuest(!showAddGuest)}
                      className="text-green-600 hover:text-green-700 text-xs font-medium cursor-pointer hover:bg-green-50 px-2 py-1 rounded-lg transition-colors"
                    >
                      <i className="ri-add-line mr-1"></i>
                      Add New
                    </button>
                  </div>

                  {showAddGuest && (
                    <div className="space-y-2 p-2 bg-green-50 rounded-lg border border-green-200">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Guest Name
                        </label>
                        <input
                          type="text"
                          value={newGuestName}
                          onChange={(e) => setNewGuestName(e.target.value)}
                          className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-xs"
                          placeholder="Enter guest name"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Company Name
                        </label>
                        {companyNames.length > 0 ? (
                          <div className="relative">
                            <select
                              value={guestCompanyName}
                              onChange={(e) =>
                                setGuestCompanyName(e.target.value)
                              }
                              className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none pr-6 appearance-none text-xs"
                            >
                              <option value="">Select company...</option>
                              {companyNames.map((company, index) => (
                                <option key={index} value={company}>
                                  {company}
                                </option>
                              ))}
                            </select>
                            <i className="ri-arrow-down-s-line absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none text-xs"></i>
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={guestCompanyName}
                            onChange={(e) =>
                              setGuestCompanyName(e.target.value)
                            }
                            className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-xs"
                            placeholder="Enter company name"
                          />
                        )}
                      </div>

                      <div className="flex space-x-2">
                        <button
                          onClick={addGuest}
                          className="px-2 py-2 bg-green-600 text-white rounded-lg text-xs hover:bg-green-7  cursor-pointer whitespace-nowrap flex-1 font-medium transition-colors"
                        >
                          <i className="ri-add-line mr-1"></i>
                          Add Guest
                        </button>
                        <button
                          onClick={() => setShowAddGuest(false)}
                          className="px-2 py-2 bg-gray-300 text-gray-700 rounded-lg text-xs hover:bg-gray-4 cursor-pointer whitespace-nowrap flex-1 font-medium transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Search Guest
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={guestSearch}
                        onChange={(e) => setGuestSearch(e.target.value)}
                        className="w-full px-3 py-2 pl-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-sm"
                        placeholder="Search guest by name..."
                      />
                      <i className="ri-search-line absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm"></i>
                    </div>
                  </div>

                  {/* Show selected guest */}
                  {selectedGuest && (
                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="w-6 h-6 bg-green-500 rounded-lg flex items-center justify-center mr-2">
                            <i className="ri-user-add-line text-white text-xs"></i>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-green-900">
                              Selected Guest
                            </p>
                            <p className="text-xs text-green-700">
                              {getSelectedPersonName()}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedGuest("");
                            setSelectedGuestObj(null);
                            setGuestSearch("");
                          }}
                          className="text-green-600 hover:text-green-800 cursor-pointer p-1 hover:bg-green-100 rounded-lg transition-colors"
                        >
                          <i className="ri-close-line text-xs"></i>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Guest search results */}
                  {guestSearch &&
                    !selectedGuest &&
                    filteredGuests.length > 0 && (
                      <div className="mt-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-white shadow-lg">
                        {filteredGuests.map((guest) => (
                          <button
                            key={guest.id}
                            onClick={() => {
                              setSelectedGuest(guest.id.toString());
                              setSelectedGuestObj(guest);
                              setGuestSearch(`${guest.name} - ${guest.companyName}`);
                            }}
                            className="w-full px-2 py-2 text-left hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                          >
                            <div className="flex items-center space-x-2">
                              <div className="w-6 h-6 bg-green-100 rounded-lg flex items-center justify-center">
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

                  {guestSearch &&
                    !selectedGuest &&
                    filteredGuests.length === 0 &&
                    guests.length > 0 && (
                      <div className="mt-2 p-2 text-center text-gray-500 border border-gray-200 rounded-lg bg-gray-50">
                        <i className="ri-search-line text-lg mb-1 block"></i>
                        <p className="text-xs">
                          No guests found matching "{guestSearch}"
                        </p>
                      </div>
                    )}

                  {/* Dropdown for selecting guest */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Choose Guest
                    </label>
                    {allGuests.length > 0 ? (
                      <div className="relative">
                        <select
                          value={selectedGuest}
                          onChange={(e) => {
                            const id = e.target.value;
                            setSelectedGuest(id);
                            const g =
                              allGuests.find((x) => x.id.toString() === id) || null;
                            setSelectedGuestObj(g);
                            if (g) {
                              setGuestSearch(`${g.name} - ${g.companyName}`);
                            } else {
                              setGuestSearch("");
                            }
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none pr-6 appearance-none text-sm"
                        >
                          <option value="">Choose guest...</option>
                          {allGuests.map((guest) => (
                            <option key={guest.id} value={guest.id.toString()}>
                              {guest.name} - {guest.companyName}
                            </option>
                          ))}
                        </select>
                        <i className="ri-arrow-down-s-line absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none"></i>
                      </div>
                    ) : (
                      <div className="mt-2 p-2 text-center text-gray-500 border border-gray-200 rounded-lg bg-gray-50">
                        <i className="ri-user-add-line text-lg mb-1 block"></i>
                        <p className="text-xs">No guests available</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Add guests above or in Master Data
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Cart Items */}
              <div className="border-t border-gray-200 pt-3">
                <h3 className="text-xs font-semibold text-gray-700 mb-2 flex items-center">
                  <i className="ri-shopping-bag-line mr-1"></i>
                  Cart Items (
                  {cart.reduce((sum, item) => sum + item.quantity, 0)})
                </h3>
                {cart.length === 0 ? (
                  <div className="text-center py-4">
                    <i className="ri-shopping-cart-line text-2xl text-gray-300 mb-2 block"></i>
                    <p className="text-gray-500 font-medium text-xs">
                      No items in cart
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Add items from the menu
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cart.map((item) => {
                      const itemPrice =
                        item.name === "Breakfast"
                          ? isGuest
                            ? priceMaster.company.breakfast
                            : priceMaster.employee.breakfast
                          : isGuest
                            ? priceMaster.company.lunch
                            : priceMaster.employee.lunch;

                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center space-x-2">
                            <div
                              className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                                item.name === "Breakfast"
                                  ? "bg-orange-100"
                                  : "bg-green-100"
                              }`}
                            >
                              <i
                                className={`text-xs ${
                                  item.name === "Breakfast"
                                    ? "ri-restaurant-line text-orange-600"
                                    : "ri-bowl-line text-green-600"
                                }`}
                              ></i>
                            </div>
                            <div>
                              <div className="flex items-center">
                                <h4 className="font-medium text-gray-900 text-xs">
                                  {item.name}
                                </h4>
                                {item.isException && (
                                  <span className="ml-2 px-1.5 py-0.5 text-xs bg-orange-100 text-orange-800 rounded-full font-medium">
                                    Exception
                                  </span>
                                )}
                              </div>
                              <p className="text-gray-600 text-xs">
                                ₹{itemPrice} each
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() =>
                                updateQuantity(item.id, item.quantity - 1)
                              }
                              className="w-6 h-6 bg-white border border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-100 cursor-pointer transition-colors"
                            >
                              <i className="ri-subtract-line text-xs"></i>
                            </button>
                            <span className="w-6 text-center font-semibold text-xs">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() =>
                                updateQuantity(item.id, item.quantity + 1)
                              }
                              className="w-6 h-6 bg-white border border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-100 cursor-pointer transition-colors"
                            >
                              <i className="ri-add-line text-xs"></i>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Print Button - Fixed at bottom */}
            {cart.length > 0 && (
              <div className="border-t border-gray-200 p-3 flex-shrink-0">
                <div className="bg-gray-50 rounded-lg p-2 mb-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-600">Total Items:</span>
                    <span className="font-semibold">
                      {cart.reduce((sum, item) => sum + item.quantity, 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-bold mt-1">
                    <span>Total Amount:</span>
                    <span className="text-green-600">
                      ₹
                      {cart.reduce((sum, item) => {
                        // All customer types now use employee pricing
                        const itemPrice =
                          item.name === "Breakfast"
                            ? priceMaster.employee.breakfast
                            : priceMaster.employee.lunch;
                        return sum + itemPrice * item.quantity;
                      }, 0)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handlePrintBill}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-2 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 transition-all cursor-pointer whitespace-nowrap flex items-center justify-center shadow-lg hover:shadow-xl text-sm"
                >
                  <i className="ri-printer-line mr-2"></i>
                  Print Bill
                </button>
              </div>
            )}
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
