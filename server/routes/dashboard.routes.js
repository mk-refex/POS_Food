import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { getDashboardStats } from '../controllers/dashboard.controller.js';

const router = Router();

router.get('/stats', authRequired, getDashboardStats);

export default router;
