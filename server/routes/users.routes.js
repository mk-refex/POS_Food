import { Router } from 'express';
import { authRequired, requireAdmin } from '../middleware/auth.js';
import { listUsers, me, updateUser } from '../controllers/users.controller.js';

const router = Router();

router.get('/me', authRequired, me);
router.get('/', authRequired, requireAdmin, listUsers);
router.patch('/:id', authRequired, requireAdmin, updateUser);

export default router;
