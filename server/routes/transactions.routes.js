import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { createTransaction, listTransactions } from '../controllers/transactions.controller.js';

const router = Router();

router.get('/', authRequired, listTransactions);
router.post('/', authRequired, createTransaction);

export default router;
