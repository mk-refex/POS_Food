import { Router } from 'express';
import {
  getPublicFeedbackSession,
  submitPublicFeedback,
} from '../controllers/publicFeedback.controller.js';

const router = Router();

router.get('/session', getPublicFeedbackSession);
router.post('/', submitPublicFeedback);

export default router;
