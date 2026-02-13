import { useState, useEffect } from "react";
import { useNavigate, useLocation, Navigate, useSearchParams } from "react-router-dom";
import {
  Box,
  Typography,
  Alert,
  Button,
  TextField,
  Tabs,
  Tab,
  InputAdornment,
  CircularProgress,
} from "@mui/material";
import refexLogo from "../../assets/refex-logo.png";
import loginBg from "../../assets/login-bg.png";
import {
  SmsOutlined,
  QrCode2Outlined,
  PersonOutlined,
  PinOutlined,
  ErrorOutline,
} from "@mui/icons-material";
import { setEmployeeSession, isEmployeeAuthenticated } from "../../api/client";

type LoginMethod = "otp" | "qr";

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  no_code: "Google did not return an authorization code. Try again.",
  not_configured: "Google SSO is not configured. Contact admin.",
  token_failed: "Google sign-in failed (token). Try again.",
  profile_failed: "Could not load your Google profile.",
  no_email: "Your Google account has no email.",
  employee_not_found: "Your email is not registered as an employee. Contact admin.",
  login_failed: "Google sign-in failed. Try again.",
};

export default function EmployeeLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/employee/dashboard";
  const [method, setMethod] = useState<LoginMethod>("otp");

  // OTP flow
  const [otpStep, setOtpStep] = useState<"input" | "verify">("input");
  const [mobileOrId, setMobileOrId] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  // QR flow
  const [qrEmployeeId, setQrEmployeeId] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Show error from Google callback if present
  useEffect(() => {
    const err = searchParams.get("error");
    if (err && GOOGLE_ERROR_MESSAGES[err]) {
      setError(GOOGLE_ERROR_MESSAGES[err]);
      setSearchParams((p) => {
        const next = new URLSearchParams(p);
        next.delete("error");
        return next;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // If already logged in as employee, redirect immediately (no flash of login form)
  if (isEmployeeAuthenticated()) {
    return <Navigate to={from} replace />;
  }

  const baseUrl = (import.meta as any).env?.VITE_API_URL || "http://localhost:5000/api";
  const api = (path: string, options?: RequestInit) =>
    fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers as Record<string, string>),
      },
    });

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const value = mobileOrId.trim();
    if (!value) {
      setError("Enter mobile number or employee ID");
      return;
    }
    setLoading(true);
    try {
      const isNumeric = /^\d+$/.test(value);
      const body = isNumeric && value.length >= 10
        ? { mobileNumber: value }
        : { employeeId: value };
      const res = await api("/employee-auth/request-otp", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to send OTP");
      setOtpSent(true);
      setOtpStep("verify");
      setOtp("");
      setError("");
    } catch (err: any) {
      setError(err.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!otp.trim() || otp.length !== 6) {
      setError("Enter 6-digit OTP");
      return;
    }
    setLoading(true);
    try {
      const value = mobileOrId.trim();
      const isNumeric = /^\d+$/.test(value);
      const body = isNumeric && value.length >= 10
        ? { mobileNumber: value, otp: otp.trim() }
        : { employeeId: value, otp: otp.trim() };
      const res = await api("/employee-auth/verify-otp", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Invalid OTP");
      setEmployeeSession(data.token, data.employee);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleQrLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const id = qrEmployeeId.trim();
    if (!id) {
      setError("Enter employee ID (or scan QR)");
      return;
    }
    setLoading(true);
    try {
      const res = await api("/employee-auth/qr-login", {
        method: "POST",
        body: JSON.stringify({ employeeId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Login failed");
      setEmployeeSession(data.token, data.employee);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const switchMethod = (m: LoginMethod) => {
    setMethod(m);
    setError("");
    setOtpStep("input");
    setOtpSent(false);
    setOtp("");
    setQrEmployeeId("");
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        position: "relative",
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
        backgroundImage: `linear-gradient(135deg, rgba(248,250,252,0.25) 0%, rgba(30,41,59,0.75) 40%, rgba(15,23,42,0.9) 100%), url(${loginBg})`,
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        backgroundColor: "#0f172a",
      }}
    >
      <Box sx={{ position: "fixed", top: 16, left: 16, zIndex: 10 }}>
        <Box component="img" src={refexLogo} alt="Logo" sx={{ width: 120, height: 48, objectFit: "contain" }} />
      </Box>

      <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", justifyContent: "center", p: 6 }}>
        <Box sx={{ maxWidth: 480 }}>
          <Typography variant="h4" fontWeight={800} gutterBottom>
            Employee Portal
          </Typography>
          <Typography variant="body1" color="text.secondary">
            View your food consumption and transaction history. Sign in with OTP or QR.
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", p: { xs: 3, md: 6 } }}>
        <Box
          sx={{
            p: { xs: 3, md: 4 },
            width: "100%",
            maxWidth: 440,
            borderRadius: 4,
            background: "rgba(255,255,255,0.55)",
            border: "1px solid rgba(255,255,255,0.35)",
            boxShadow: "0 24px 60px rgba(15,23,42,0.25)",
            backdropFilter: "blur(12px)",
          }}
        >
          <Typography variant="h5" fontWeight={700} textAlign="center" mb={2}>
            Sign in
          </Typography>

          <Tabs value={method} onChange={(_, v) => switchMethod(v)} sx={{ mb: 3 }}>
            <Tab value="otp" label="OTP" icon={<SmsOutlined />} iconPosition="start" />
            <Tab value="qr" label="QR / Employee ID" icon={<QrCode2Outlined />} iconPosition="start" />
          </Tabs>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} icon={<ErrorOutline />}>
              {error}
            </Alert>
          )}

          {method === "otp" && (
            <>
              {otpStep === "input" && (
                <Box component="form" onSubmit={handleRequestOtp}>
                  <TextField
                    fullWidth
                    label="Mobile number or Employee ID"
                    value={mobileOrId}
                    onChange={(e) => setMobileOrId(e.target.value)}
                    placeholder="e.g. 9876543210 or EMP001"
                    InputProps={{ startAdornment: <InputAdornment position="start"><PersonOutlined /></InputAdornment> }}
                    sx={{ mb: 2 }}
                  />
                  <Button type="submit" fullWidth variant="contained" size="large" disabled={loading}>
                    {loading ? <CircularProgress size={24} /> : "Send OTP"}
                  </Button>
                </Box>
              )}
              {otpStep === "verify" && (
                <Box component="form" onSubmit={handleVerifyOtp}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    OTP sent to your registered mobile (use 123456 in dev).
                  </Typography>
                  <TextField
                    fullWidth
                    label="6-digit OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputProps={{ maxLength: 6 }}
                    InputProps={{ startAdornment: <InputAdornment position="start"><PinOutlined /></InputAdornment> }}
                    sx={{ mb: 2 }}
                  />
                  <Button type="submit" fullWidth variant="contained" size="large" disabled={loading || otp.length !== 6}>
                    {loading ? <CircularProgress size={24} /> : "Verify & sign in"}
                  </Button>
                  <Button fullWidth sx={{ mt: 1 }} onClick={() => { setOtpStep("input"); setOtpSent(false); }}>
                    Change number / ID
                  </Button>
                </Box>
              )}
            </>
          )}

          {method === "qr" && (
            <Box component="form" onSubmit={handleQrLogin}>
              <TextField
                fullWidth
                label="Employee ID (or scan QR)"
                value={qrEmployeeId}
                onChange={(e) => setQrEmployeeId(e.target.value)}
                placeholder="e.g. EMP001"
                InputProps={{ startAdornment: <InputAdornment position="start"><QrCode2Outlined /></InputAdornment> }}
                sx={{ mb: 2 }}
              />
              <Button type="submit" fullWidth variant="contained" size="large" disabled={loading}>
                {loading ? <CircularProgress size={24} /> : "Sign in with ID"}
              </Button>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2, textAlign: "center" }}>
                In future you can scan your QR code here.
              </Typography>
            </Box>
          )}

          <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: "divider" }}>
            <Button
              fullWidth
              variant="outlined"
              size="large"
              href={`${baseUrl}/employee-auth/google?state=${encodeURIComponent(window.location.origin)}`}
              sx={{ textTransform: "none" }}
              startIcon={<Box component="span" sx={{ width: 20, height: 20, "& img": { width: "100%", height: "100%" } }}><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" /></Box>}
            >
              Sign in with Google
            </Button>
          </Box>

          <Typography variant="caption" color="text.secondary" display="block" textAlign="center" sx={{ mt: 3 }}>
            Staff portal — view your transactions only.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
