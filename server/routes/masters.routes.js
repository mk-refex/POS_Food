import express from 'express';
import { authRequired } from '../middleware/auth.js';
import {
  getEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getSupportStaff,
  createSupportStaff,
  updateSupportStaff,
  deleteSupportStaff,
  getGuests,
  createGuest,
  updateGuest,
  deleteGuest,
  getPriceMaster,
  updatePriceMaster
} from '../controllers/masters.controller.js';

const router = express.Router();

// Employee routes
router.get('/employees', authRequired, getEmployees);
router.post('/employees', authRequired, createEmployee);
router.put('/employees/:id', authRequired, updateEmployee);
router.delete('/employees/:id', authRequired, deleteEmployee);

// Support Staff routes
router.get('/support-staff', authRequired, getSupportStaff);
router.post('/support-staff', authRequired, createSupportStaff);
router.put('/support-staff/:id', authRequired, updateSupportStaff);
router.delete('/support-staff/:id', authRequired, deleteSupportStaff);

// Guest routes
router.get('/guests', authRequired, getGuests);
router.post('/guests', authRequired, createGuest);
router.put('/guests/:id', authRequired, updateGuest);
router.delete('/guests/:id', authRequired, deleteGuest);

// Price Master routes
router.get('/price-master', authRequired, getPriceMaster);
router.put('/price-master', authRequired, updatePriceMaster);

export default router;
