import { Router } from 'express';
import { authRequired, requireAdmin } from '../middleware/auth.js';
import {
  // User Management
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  // API Config
  getApiConfig,
  upsertApiConfig,
  // SSO Config
  listSsoProviders,
  createSsoProvider,
  updateSsoProvider,
  deleteSsoProvider,
  getSmtpConfig,
  upsertSmtpConfig,
  testSmtp,
  // HRMS Sync
  runHrmsSyncEndpoint,
} from '../controllers/admin.controller.js';

const router = Router();

// All admin routes require authentication and admin role
router.use(authRequired);
router.use(requireAdmin);

// User Management Routes
router.get('/users', listUsers);
router.get('/users/:id', getUserById);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

// Company Management and HRMS routes removed

// API Config routes
router.get('/api-config', getApiConfig);
router.put('/api-config', upsertApiConfig);

// SSO providers for employee login
router.get('/sso-providers', listSsoProviders);
router.post('/sso-providers', createSsoProvider);
router.put('/sso-providers/:id', updateSsoProvider);
router.delete('/sso-providers/:id', deleteSsoProvider);

// SMTP Config
router.get('/smtp-config', getSmtpConfig);
router.put('/smtp-config', upsertSmtpConfig);
router.post('/smtp-config/test', testSmtp);

// HRMS full sync (create + update employees & support staff; same logic as daily cron)
router.post('/hrms-sync', runHrmsSyncEndpoint);

export default router;
