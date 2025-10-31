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
  upsertApiConfig
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
// HRMS proxy
import { fetchHrmsEmployees } from '../controllers/admin.controller.js';
router.get('/hrms/employees/active', fetchHrmsEmployees);

export default router;
