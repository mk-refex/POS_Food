import { Router } from 'express';
import { requestOtp, verifyOtp, qrLogin, googleRedirect, googleCallback } from '../controllers/employeeAuth.controller.js';

const router = Router();

router.post('/request-otp', requestOtp);
router.post('/verify-otp', verifyOtp);
router.post('/qr-login', qrLogin);
// Google SSO endpoints
router.get('/google', googleRedirect);
router.get('/google/callback', googleCallback);
router.get('/self-bill/preview', async (req, res, next) => { try { const controller = await import('../controllers/employeeAuth.controller.js'); return controller.selfBillPreview(req,res); } catch(e){next(e)} });
router.post('/self-bill', async (req, res, next) => { try { const controller = await import('../controllers/employeeAuth.controller.js'); return controller.selfBill(req,res); } catch(e){next(e)} });

export default router;
