import { Router } from 'express';
import { authRequired, requireAdmin } from '../middleware/auth.js';
import { createReport, listReports } from '../controllers/reports.controller.js';

const router = Router();

router.get('/', authRequired, listReports);
router.post('/', authRequired, requireAdmin, createReport);

export default router;
