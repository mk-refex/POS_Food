import { Router } from 'express';
import { authRequired, requireAdmin } from '../middleware/auth.js';
import { createReport, listReports, listFeedbackReports } from '../controllers/reports.controller.js';

const router = Router();

router.get('/', authRequired, listReports);
// Feedback report should be viewable by any authenticated user (admin or employee)
router.get('/feedback', authRequired, listFeedbackReports);
router.post('/', authRequired, requireAdmin, createReport);

export default router;
