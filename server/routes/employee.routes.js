import { Router } from 'express';
import { employeeAuthRequired } from '../middleware/auth.js';
import {
  getMyTransactions,
  getMyDashboard,
  getMenusForEmployee,
  getMyProfile,
  submitFeedback,
  getMyFeedback,
} from '../controllers/employee.controller.js';

const router = Router();

router.use(employeeAuthRequired);
router.get('/transactions', getMyTransactions);
router.get('/dashboard', getMyDashboard);
router.get('/profile', getMyProfile);
router.get('/menu', getMenusForEmployee);
router.post('/feedback', submitFeedback);
router.get('/feedback', getMyFeedback);

export default router;
