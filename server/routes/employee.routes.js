import { Router } from 'express';
import { employeeAuthRequired } from '../middleware/auth.js';
import {
  getMyTransactions,
  getMyDashboard,
  getMenusForEmployee,
  getMyProfile,
  submitFeedback,
  getMyFeedback,
  getMyGuests,
  getGuestCompanies,
  createMyGuests,
  expireMyGuest,
} from '../controllers/employee.controller.js';

const router = Router();

router.use(employeeAuthRequired);
router.get('/transactions', getMyTransactions);
router.get('/dashboard', getMyDashboard);
router.get('/profile', getMyProfile);
router.get('/menu', getMenusForEmployee);
router.post('/feedback', submitFeedback);
router.get('/feedback', getMyFeedback);
router.get('/guests', getMyGuests);
router.get('/guest-companies', getGuestCompanies);
router.post('/guests', createMyGuests);
router.patch('/guests/:id/expire', expireMyGuest);

export default router;
