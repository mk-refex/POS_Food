import { Router } from 'express';
import authRouter from './auth.routes.js';
import usersRouter from './users.routes.js';
import reportsRouter from './reports.routes.js';
import dashboardRouter from './dashboard.routes.js';
import transactionsRouter from './transactions.routes.js';
import adminRouter from './admin.routes.js';
import mastersRouter from './masters.routes.js';
import employeeAuthRouter from './employeeAuth.routes.js';
import employeeRouter from './employee.routes.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/employee-auth', employeeAuthRouter);
router.use('/employee', employeeRouter);
router.use('/users', usersRouter);
router.use('/reports', reportsRouter);
router.use('/dashboard', dashboardRouter);
router.use('/transactions', transactionsRouter);
router.use('/admin', adminRouter);
router.use('/masters', mastersRouter);

export default router;
