import { useState } from 'react';
import { apiFetch } from '../../api/client';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Alert, InputAdornment, IconButton, Button, Link, Divider, FormControl, InputLabel, OutlinedInput, FormHelperText } from '@mui/material';
import refexLogo from '../../assets/refex-logo.png';
import loginBg from '../../assets/login-bg.png';
import { MailOutline, LockOutlined, Visibility, VisibilityOff, ErrorOutline } from '@mui/icons-material';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }
    
    try {
      setIsLoading(true);
      setError('');
      setFieldErrors({});
      
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('currentUser', JSON.stringify(data.user));
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Login error:', err);
      
      if (err.errors) {
        // Handle field-specific validation errors
        setFieldErrors(err.errors);
        setError('Please fix the errors below');
      } else {
        // Handle general error messages
        setError(err.message || 'Login failed. Please check your credentials.');
        setFieldErrors({});
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      position: 'relative',
      display: 'grid',
      gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
      // Darker linear overlay + background image
      backgroundImage: `linear-gradient(135deg, rgba(248,250,252,0.25) 0%, rgba(30,41,59,0.75) 40%, rgba(15,23,42,0.9) 100%), url(${loginBg})`,
      backgroundSize: 'cover',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center',
      backgroundColor: '#0f172a'
    }}>

      {/* Fixed Logo */}
      <Box sx={{ position: 'fixed', top: 16, left: 16, zIndex: 10, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box component="img" src={refexLogo} alt="App Logo" sx={{ width: 120, height: 48, objectFit: 'contain' }} />
      </Box>
      {/* Left Illustration / Welcome */}
      <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', justifyContent: 'center', p: 6 }}>
        <Box sx={{ maxWidth: 520 }}>

          <Typography variant="h3" fontWeight={800} gutterBottom>Hi, Welcome back</Typography>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            Manage canteen transactions, company billing and daily meal counts with ease.
          </Typography>
          <Box sx={{ mt: 6, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
            <Box sx={{ height: 8, bgcolor: 'primary.main', opacity: 0.2, borderRadius: 1 }} />
            <Box sx={{ height: 8, bgcolor: 'success.main', opacity: 0.2, borderRadius: 1 }} />
            <Box sx={{ height: 8, bgcolor: 'warning.main', opacity: 0.2, borderRadius: 1 }} />
          </Box>
        </Box>
      </Box>

      {/* Right Login Area (no card) */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: { xs: 3, md: 6 } }}>
        <Box sx={{
          p: { xs: 3, md: 5 },
          width: '100%',
          maxWidth: 520,
          borderRadius: 4,
          background: 'rgba(255,255,255,0.55)',
          border: '1px solid rgba(255,255,255,0.35)',
          boxShadow: '0 24px 60px rgba(15,23,42,0.25)',
          backdropFilter: 'blur(12px)'
        }}>
          <Box textAlign="center" mb={3}>
            <Box mb={1} display={{ xs: 'flex', md: 'none' }} justifyContent="center">
              <Box component="img" src={refexLogo} alt="App Logo" sx={{ width: 36, height: 36, objectFit: 'contain' }} />
            </Box>
            <Typography variant="h4" fontWeight={800}>Log in to your account</Typography>
            {/* <Typography variant="body2" color="text.secondary">
              Don’t have an account? <Link underline="hover">Request access</Link>
            </Typography> */}
          </Box>

          {/* <Alert icon={<InfoOutlined />} severity="info" sx={{ mb: 3 }}>
            Use your company email and password to continue.
          </Alert> */}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} icon={<ErrorOutline />}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleLogin} noValidate>
          <FormControl fullWidth margin="normal" variant="outlined" error={Boolean(fieldErrors.email)} required>
            <InputLabel htmlFor="login-email">Email Address</InputLabel>
            <OutlinedInput
              id="login-email"
              type="email"
              label="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              startAdornment={(
                <InputAdornment position="start">
                  <MailOutline />
                </InputAdornment>
              )}
              sx={{
                borderRadius: 2,
                backgroundColor: 'rgba(255, 255, 255, 0)',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.35)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#60a5fa' },
                '&.Mui-focused': { boxShadow: '0 0 0 3px rgba(96,165,250,0.25)' },
                '& input:-webkit-autofill': {
                  WebkitBoxShadow: '0 0 0 1000px rgba(255, 255, 255, 0) inset',
                  WebkitTextFillColor: '#0f172a',
                  caretColor: '#0f172a',
                  transition: 'background-color 5000s ease-in-out 0s'
                }
              }}
            />
            {fieldErrors.email && <FormHelperText>{fieldErrors.email}</FormHelperText>}
          </FormControl>

          <FormControl fullWidth margin="normal" variant="outlined" error={Boolean(fieldErrors.password)} required>
            <InputLabel htmlFor="login-password">Password</InputLabel>
            <OutlinedInput
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              startAdornment={(
                <InputAdornment position="start">
                  <LockOutlined />
                </InputAdornment>
              )}
              endAdornment={(
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              )}
              sx={{
                borderRadius: 2,
                backgroundColor: 'rgba(255, 255, 255, 0)',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.35)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#60a5fa' },
                '&.Mui-focused': { boxShadow: '0 0 0 3px rgba(96,165,250,0.25)' },
                '& input:-webkit-autofill': {
                  WebkitBoxShadow: '0 0 0 1000px rgba(255, 255, 255, 0) inset',
                  WebkitTextFillColor: '#0f172a',
                  caretColor: '#0f172a',
                  transition: 'background-color 5000s ease-in-out 0s'
                }
              }}
            />
            {fieldErrors.password && <FormHelperText>{fieldErrors.password}</FormHelperText>}
          </FormControl>

          <Box display="flex" justifyContent="flex-end" mt={1}>
            <Link underline="hover" variant="body2">Forgot password?</Link>
          </Box>

          <Button
            type="submit"
            fullWidth
            size="large"
            variant="contained"
            disabled={isLoading}
            sx={{ mt: 2 }}
          >
            {isLoading ? 'Logging in…' : 'Log in'}
          </Button>
        </Box>

          <Divider sx={{ my: 3 }} />
          <Typography variant="caption" color="text.secondary" display="block" textAlign="center">
            Need help? Contact canteen IT support.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}