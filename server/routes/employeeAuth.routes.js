import { Router } from 'express';
import { requestOtp, verifyOtp, qrLogin, ssoRedirect, ssoCallback, listPublicSsoProviders } from '../controllers/employeeAuth.controller.js';

const router = Router();

router.post('/request-otp', requestOtp);
router.post('/verify-otp', verifyOtp);
router.post('/qr-login', qrLogin);
router.get('/sso-providers', listPublicSsoProviders);
router.get('/sso/:provider', ssoRedirect);
router.get('/sso/:provider/callback', ssoCallback);
router.get('/self-bill/preview', async (req, res, next) => { try { const controller = await import('../controllers/employeeAuth.controller.js'); return controller.selfBillPreview(req,res); } catch(e){next(e)} });
router.post('/self-bill', async (req, res, next) => { try { const controller = await import('../controllers/employeeAuth.controller.js'); return controller.selfBill(req,res); } catch(e){next(e)} });

export default router;
