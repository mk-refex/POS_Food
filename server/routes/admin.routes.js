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
  getSsoConfig,
  upsertSsoConfig,
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

// SSO Config (Google) for employee login
router.get('/sso-config', getSsoConfig);
router.put('/sso-config', upsertSsoConfig);

// SMTP Config
router.get('/smtp-config', getSmtpConfig);
router.put('/smtp-config', upsertSmtpConfig);
router.post('/smtp-config/test', testSmtp);

// HRMS full sync (create + update employees & support staff; same logic as daily cron)
router.post('/hrms-sync', runHrmsSyncEndpoint);

export default router;
