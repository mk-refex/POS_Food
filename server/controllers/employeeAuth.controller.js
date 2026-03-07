import { z } from 'zod';
import { Op } from 'sequelize';
import { Employee } from '../models/index.js';
import { signToken } from '../middleware/auth.js';
import { emitTransactionCreated } from '../socket.js';

// In-memory OTP store: key = mobileNumber (normalized) or employeeId, value = { otp, expiresAt, employeeId }
const otpStore = new Map();
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const DEV_OTP = process.env.EMPLOYEE_DEV_OTP || '123456'; // For development; set EMPLOYEE_DEV_OTP or use 123456

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizeMobile(mobile) {
  return (mobile || '').replace(/\D/g, '').slice(-10);
}

// In-memory locks for self-bill to avoid concurrent duplicate processing
const selfBillLocks = new Set();

export async function requestOtp(req, res) {
  const schema = z.object({
    employeeId: z.string().min(1).optional(),
    email: z.string().email().optional(),
  }).refine((d) => d.employeeId || d.email, { message: 'Provide email or employee ID' });

  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ message: 'Validation failed', errors: parse.error.flatten().fieldErrors });
  }

  const { employeeId, email } = parse.data;
  try {
    const where = {};
    if (employeeId) where.employeeId = employeeId.trim();
    else if (email) where.email = email.trim().toLowerCase();

    const employee = await Employee.findOne({ where, attributes: ['id', 'employeeId', 'employeeName', 'mobileNumber', 'email'] });
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found. Check email or employee ID.' });
    }

    const emailToUse = (employee.email || '').trim().toLowerCase();
    if (!emailToUse) {
      return res.status(400).json({ message: 'No email on file for this employee. Contact admin to add your email.' });
    }

    const otp = generateOTP();
    const key = employee.employeeId;
    otpStore.set(key, { otp, expiresAt: Date.now() + OTP_EXPIRY_MS, employeeId: employee.employeeId });

    // Send OTP via SMTP email (same config as Admin panel)
    const { sendSmtpMail } = await import('../services/transactionEmail.js');
    const { sent, error: sendError } = await sendSmtpMail(
      emailToUse,
      'Your login OTP – POS Food',
      `Your one-time password is: ${otp}. It is valid for 5 minutes. Do not share it.`,
    );

    if (!sent) {
      if (process.env.NODE_ENV !== 'production') {
        return res.json({
          message: 'SMTP not configured. Use OTP 123456 for development (or set EMPLOYEE_DEV_OTP).',
          devOtp: otp,
        });
      }
      return res.status(503).json({
        message: sendError || 'OTP could not be sent. Configure SMTP in Admin panel and try again.',
      });
    }

    if (process.env.NODE_ENV !== 'production') {
      return res.json({ message: 'OTP sent to your registered email.', devOtp: otp });
    }
    return res.json({ message: 'OTP sent to your registered email.' });
  } catch (error) {
    console.error('Employee request OTP error:', error);
    return res.status(500).json({ message: 'Failed to send OTP' });
  }
}

const verifyOtpSchema = z.object({
  employeeId: z.string().min(1).optional(),
  email: z.string().email().optional(),
  otp: z.string().length(6),
}).refine((d) => d.employeeId || d.email, { message: 'Provide email or employee ID' });

export async function verifyOtp(req, res) {
  const parse = verifyOtpSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ message: 'Validation failed', errors: parse.error.flatten().fieldErrors });
  }

  const { employeeId, email, otp } = parse.data;
  let key = employeeId ? employeeId.trim() : null;
  if (!key) {
    if (!email) return res.status(400).json({ message: 'Provide email or employee ID' });
    const emp = await Employee.findOne({
      where: { email: email.trim().toLowerCase() },
      attributes: ['employeeId'],
    });
    if (!emp) return res.status(404).json({ message: 'Employee not found.' });
    key = emp.employeeId;
  }
  const stored = otpStore.get(key);
  if (!stored) {
    return res.status(400).json({ message: 'OTP expired or not requested. Please request a new OTP.' });
  }
  if (Date.now() > stored.expiresAt) {
    otpStore.delete(key);
    return res.status(400).json({ message: 'OTP expired. Please request a new OTP.' });
  }
  if (stored.otp !== otp) {
    return res.status(401).json({ message: 'Invalid OTP' });
  }
  otpStore.delete(key);

  try {
    const employee = await Employee.findOne({
      where: { employeeId: stored.employeeId, isActive: true },
      attributes: ['id', 'employeeId', 'employeeName', 'companyName', 'entity', 'mobileNumber'],
    });
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const token = signToken({
      role: 'employee',
      employeeId: employee.employeeId,
      employeeName: employee.employeeName,
      companyName: employee.companyName || null,
    });

    return res.json({
      token,
      employee: {
        employeeId: employee.employeeId,
        employeeName: employee.employeeName,
        companyName: employee.companyName,
        entity: employee.entity,
      },
    });
  } catch (error) {
    console.error('Employee verify OTP error:', error);
    return res.status(500).json({ message: 'Login failed' });
  }
}

const qrLoginSchema = z.object({
  employeeId: z.string().min(1),
});

export async function qrLogin(req, res) {
  const parse = qrLoginSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ message: 'Validation failed', errors: parse.error.flatten().fieldErrors });
  }

  const { employeeId } = parse.data;
  try {
    const employee = await Employee.findOne({
      where: { employeeId, isActive: true },
      attributes: ['id', 'employeeId', 'employeeName', 'companyName', 'entity', 'mobileNumber', 'qrCode'],
    });
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found or inactive' });
    }

    const token = signToken({
      role: 'employee',
      employeeId: employee.employeeId,
      employeeName: employee.employeeName,
      companyName: employee.companyName || null,
    });

    return res.json({
      token,
      employee: {
        employeeId: employee.employeeId,
        employeeName: employee.employeeName,
        companyName: employee.companyName,
        entity: employee.entity,
      },
    });
  } catch (error) {
    console.error('Employee QR login error:', error);
    return res.status(500).json({ message: 'Login failed' });
  }
}

// Google SSO: redirect to Google OAuth
export async function googleRedirect(req, res) {
  try {
    const { SsoConfig } = await import('../models/index.js');
    const config = await SsoConfig.findOne({ where: { provider: 'google' } });
    if (!config?.clientId) {
      return res.status(400).json({ message: 'Google SSO is not configured. Contact admin.' });
    }
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const redirectUri = (config.redirectUri && config.redirectUri.trim())
      ? config.redirectUri.trim()
      : `${baseUrl}/api/employee-auth/google/callback`;
    const state = (req.query.state || config.frontendBaseUrl || '').toString().replace(/\/$/, '');
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'select_account',
      ...(state ? { state } : {}),
    });
    return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  } catch (error) {
    console.error('Google redirect error:', error);
    return res.status(500).json({ message: 'SSO not available' });
  }
}

// Google SSO: callback – exchange code, get email, find employee, issue JWT, redirect to frontend
export async function googleCallback(req, res) {
  const { code, state } = req.query;
  if (!code) {
    return res.redirect(state ? `${state}/employee/login?error=no_code` : '/employee/login?error=no_code');
  }
  try {
    const { SsoConfig, Employee } = await import('../models/index.js');
    const config = await SsoConfig.findOne({ where: { provider: 'google' } });
    if (!config?.clientId || !config.clientSecret) {
      return res.redirect(state ? `${state}/employee/login?error=not_configured` : '/employee/login?error=not_configured');
    }
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const redirectUri = (config.redirectUri && config.redirectUri.trim())
      ? config.redirectUri.trim()
      : `${baseUrl}/api/employee-auth/google/callback`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('Google token error:', err);
      return res.redirect(state ? `${state}/employee/login?error=token_failed` : '/employee/login?error=token_failed');
    }
    const tokens = await tokenRes.json();
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userRes.ok) {
      return res.redirect(state ? `${state}/employee/login?error=profile_failed` : '/employee/login?error=profile_failed');
    }
    const profile = await userRes.json();
    const email = (profile.email || '').toLowerCase().trim();
    if (!email) {
      return res.redirect(state ? `${state}/employee/login?error=no_email` : '/employee/login?error=no_email');
    }

    const employee = await Employee.findOne({
      where: { email, isActive: true },
      attributes: ['id', 'employeeId', 'employeeName', 'companyName', 'entity', 'email'],
    });
    if (!employee) {
      return res.redirect(state ? `${state}/employee/login?error=employee_not_found` : '/employee/login?error=employee_not_found');
    }

    const signToken = (await import('../middleware/auth.js')).signToken;
    const token = signToken({
      role: 'employee',
      employeeId: employee.employeeId,
      employeeName: employee.employeeName,
      companyName: employee.companyName || null,
    });
    const employeePayload = {
      employeeId: employee.employeeId,
      employeeName: employee.employeeName,
      companyName: employee.companyName,
      entity: employee.entity,
    };
    const frontendBase = (state || config.frontendBaseUrl || '').replace(/\/$/, '');
    const target = frontendBase
      ? `${frontendBase}/employee/callback?token=${encodeURIComponent(token)}&employee=${encodeURIComponent(JSON.stringify(employeePayload))}`
      : `/employee/callback?token=${encodeURIComponent(token)}&employee=${encodeURIComponent(JSON.stringify(employeePayload))}`;
    return res.redirect(target);
  } catch (error) {
    console.error('Google callback error:', error);
    const state = req.query.state || '';
    return res.redirect(state ? `${state}/employee/login?error=login_failed` : '/employee/login?error=login_failed');
  }
}

/** Determine meal from server local time. Same logic used in preview and actual bill so they match. Breakfast 6–11, Lunch 12–14:59, else lunch. */
function getMealByServerTime() {
  const h = new Date().getHours();
  if (h >= 6 && h <= 11) return 'breakfast';
  if (h >= 12 && h <= 15) return 'lunch';
  return 'lunch';     
}

/** Resolve employee by employeeId or email (identifier containing @). Email is normalized to lowercase. */
async function findEmployeeByIdOrEmail(Employee, identifier) {
  let id = String(identifier || '').trim();
  if (!id) return null;
  const byEmail = id.includes('@');
  if (byEmail) id = id.toLowerCase();
  const where = byEmail ? { email: id, isActive: true } : { employeeId: id, isActive: true };
  return Employee.findOne({
    where,
    attributes: ['employeeId', 'employeeName', 'companyName', 'entity', 'email', 'mobileNumber'],
  });
}

/** Resolve guest by id; validate isActive and expirationDate (if set, must be >= today). */
async function findGuestForSelfBill(Guest, guestId) {
  const id = parseInt(String(guestId).replace(/^GUEST:?\s*/i, ''), 10);
  if (!Number.isFinite(id)) return null;
  const guest = await Guest.findOne({
    where: { id, isActive: true },
    attributes: ['id', 'name', 'companyName', 'expirationDate'],
  });
  if (!guest) return null;
  const exp = guest.expirationDate ? String(guest.expirationDate).slice(0, 10) : null;
  const today = new Date().toISOString().split('T')[0];
  if (exp && exp < today) return null;
  return guest;
}

/** Preview self-bill: returns employee or guest info, suggested meal and price. Supports employee (id/email) or GUEST:id. */
export async function selfBillPreview(req, res) {
  try {
    const identifier = String(req.query.employeeId || req.query.id || req.query.employee || req.query.email || '').trim();
    if (!identifier) return res.status(400).json({ message: 'employeeId, email, or GUEST:id required' });
    const { Employee, Guest, PriceMaster, Transaction } = await import('../models/index.js');
    const now = new Date();
    const meal = getMealByServerTime();
    const priceMaster = await PriceMaster.findOne({ where: { isActive: true } });
    const today = now.toISOString().split('T')[0];

    if (identifier.toUpperCase().startsWith('GUEST:')) {
      const guest = await findGuestForSelfBill(Guest, identifier);
      if (!guest) return res.status(404).json({ message: 'Guest not found or QR code has expired' });
      const price = meal === 'breakfast' ? Number(priceMaster?.companyBreakfast || 135) : Number(priceMaster?.companyLunch || 165);
      const monthlySummary = { breakfastCount: 0, lunchCount: 0 };
      let warnings = {};
      try {
        const prior = await Transaction.findAll({
          where: { date: today, customerType: 'guest', customerId: String(guest.id) },
        });
        const totals = prior.reduce((acc, t) => {
          for (const it of t.items || []) {
            if (it.isException) continue;
            if (it.name === 'Breakfast') acc.breakfast += Number(it.quantity || 0);
            if (it.name === 'Lunch') acc.lunch += Number(it.quantity || 0);
          }
          return acc;
        }, { breakfast: 0, lunch: 0 });
        const qtyReq = Math.max(1, Number(req.query.quantity || 1));
        if (meal === 'breakfast' && totals.breakfast + qtyReq > 1) warnings.breakfastExceeded = true;
        if (meal === 'lunch' && totals.lunch + qtyReq > 1) warnings.lunchExceeded = true;
        const priorExceptionExists = prior.some((t) =>
          (t.items || []).some((it) => String(it.name).toLowerCase() === meal && !!it.isException)
        );
        if (priorExceptionExists) warnings.priorException = true;
      } catch (e) { /* ignore */ }
      return res.json({
        customerType: 'guest',
        employee: {
          employeeId: `GUEST:${guest.id}`,
          employeeName: guest.name,
          companyName: guest.companyName,
          email: null,
        },
        meal,
        price,
        monthlySummary,
        warnings,
      });
    }

    const employee = await findEmployeeByIdOrEmail(Employee, identifier);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const price = meal === 'breakfast' ? Number(priceMaster?.employeeBreakfast || 20) : Number(priceMaster?.employeeLunch || 48);
    const { getMonthlySummaryForCustomer } = await import('../services/transactionEmail.js');
    const monthlySummary = await getMonthlySummaryForCustomer('employee', employee.employeeId, today);

    const qtyReq = Math.max(1, Number(req.query.quantity || 1));
    let warnings = {};
    try {
      const prior = await Transaction.findAll({
        where: { date: today, customerType: 'employee', customerId: employee.employeeId },
      });
      const totals = prior.reduce((acc, t) => {
        for (const it of t.items || []) {
          if (it.isException) continue;
          if (it.name === 'Breakfast') acc.breakfast += Number(it.quantity || 0);
          if (it.name === 'Lunch') acc.lunch += Number(it.quantity || 0);
        }
        return acc;
      }, { breakfast: 0, lunch: 0 });
      if (meal === 'breakfast' && totals.breakfast + qtyReq > 1) warnings.breakfastExceeded = true;
      if (meal === 'lunch' && totals.lunch + qtyReq > 1) warnings.lunchExceeded = true;
      const priorExceptionExists = prior.some((t) =>
        (t.items || []).some((it) => String(it.name).toLowerCase() === meal && !!it.isException)
      );
      if (priorExceptionExists) warnings.priorException = true;
    } catch (e) { /* ignore */ }

    return res.json({
      customerType: 'employee',
      employee: {
        employeeId: employee.employeeId,
        employeeName: employee.employeeName,
        companyName: employee.companyName,
        email: employee.email,
      },
      meal,
      price,
      monthlySummary,
      warnings,
    });
  } catch (e) {
    console.error('selfBillPreview error:', e?.message || e);
    return res.status(500).json({ message: 'Failed to preview self-bill' });
  }
}

/** Create self-bill transaction for employee or guest (identifier = employeeId/email or GUEST:id). */
export async function selfBill(req, res) {
  try {
    const body = req.body || {};
    const identifier = String(body.employeeId || body.id || body.email || '').trim();
    if (!identifier) return res.status(400).json({ message: 'employeeId, email, or GUEST:id required' });
    const { Employee, Guest, PriceMaster, Transaction } = await import('../models/index.js');
    const { Op } = await import('sequelize');
    const now = new Date();
    const meal = getMealByServerTime();
    const date = now.toISOString().split('T')[0];
    const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).toUpperCase();
    const qty = Math.max(1, Number(body.quantity || 1));
    const priceMaster = await PriceMaster.findOne({ where: { isActive: true } });

    if (identifier.toUpperCase().startsWith('GUEST:')) {
      const guest = await findGuestForSelfBill(Guest, identifier);
      if (!guest) return res.status(404).json({ message: 'Guest not found or QR code has expired' });
      const price = meal === 'breakfast' ? Number(priceMaster?.companyBreakfast || 135) : Number(priceMaster?.companyLunch || 165);
      const items = [{
        id: meal === 'breakfast' ? 1 : 2,
        name: meal === 'breakfast' ? 'Breakfast' : 'Lunch',
        quantity: qty,
        actualPrice: price,
        ...(body.forceException ? { isException: true } : {}),
      }];
      const lockKey = `guest:${guest.id}:${date}:${meal}:${qty}`;
      if (selfBillLocks.has(lockKey)) return res.status(200).json({ message: 'Duplicate request', duplicate: true });
      selfBillLocks.add(lockKey);
      try {
        const tenSecondsAgo = new Date(Date.now() - 10 * 1000);
        const existing = await Transaction.findOne({
          where: { customerType: 'guest', customerId: String(guest.id), date, createdAt: { [Op.gte]: tenSecondsAgo } },
          order: [['id', 'DESC']],
        });
        if (existing) {
          const existingItems = JSON.stringify(existing.items || []);
          const newItems = JSON.stringify(items);
          if (existingItems === newItems) return res.status(200).json({ transaction: existing.toJSON(), duplicate: true });
        }
        const trx = await Transaction.create({
          customerType: 'guest',
          customerId: String(guest.id),
          customerName: guest.name,
          companyName: guest.companyName || null,
          date,
          time,
          items,
          totalItems: qty,
          totalAmount: Math.round(price * qty),
          userId: req.user?.userId ?? (body.userId ? Number(body.userId) : null),
          isSelfBill: true,
        });
        emitTransactionCreated();
        return res.status(201).json({ transaction: trx.toJSON() });
      } finally {
        selfBillLocks.delete(lockKey);
      }
    }

    const employee = await findEmployeeByIdOrEmail(Employee, identifier);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const price = meal === 'breakfast' ? Number(priceMaster?.employeeBreakfast || 20) : Number(priceMaster?.employeeLunch || 48);
    const items = [{
      id: meal === 'breakfast' ? 1 : 2,
      name: meal === 'breakfast' ? 'Breakfast' : 'Lunch',
      quantity: qty,
      actualPrice: price,
      ...(body.forceException ? { isException: true } : {}),
    }];

    const lockKey = `${employee.employeeId}:${date}:${meal}:${qty}`;
    if (selfBillLocks.has(lockKey)) return res.status(200).json({ message: 'Duplicate request', duplicate: true });
    selfBillLocks.add(lockKey);

    try {
      const tenSecondsAgo = new Date(Date.now() - 10 * 1000);
      const existing = await Transaction.findOne({
        where: { customerType: 'employee', customerId: employee.employeeId, date, createdAt: { [Op.gte]: tenSecondsAgo } },
        order: [['id', 'DESC']],
      });
      if (existing) {
        const existingItems = JSON.stringify(existing.items || []);
        const newItems = JSON.stringify(items);
        if (existingItems === newItems) return res.status(200).json({ transaction: existing.toJSON(), duplicate: true });
      }

      const trx = await Transaction.create({
        customerType: 'employee',
        customerId: employee.employeeId,
        customerName: employee.employeeName,
        companyName: employee.companyName || null,
        date,
        time,
        items,
        totalItems: qty,
        totalAmount: Math.round(price * qty),
        userId: req.user?.userId ?? (body.userId ? Number(body.userId) : null),
        isSelfBill: true,
      });
      emitTransactionCreated();

      const { getMonthlySummaryForCustomer, sendTransactionNotificationEmail } = await import('../services/transactionEmail.js');
      setImmediate(async () => {
        try {
          const monthlySummary = await getMonthlySummaryForCustomer('employee', employee.employeeId, date);
          await sendTransactionNotificationEmail(trx.toJSON(), employee.email, employee.employeeName || 'Employee', monthlySummary);
        } catch (e) {
          console.error('selfBill send email error:', e?.message || e);
        }
      });

      return res.status(201).json({ transaction: trx.toJSON() });
    } finally {
      selfBillLocks.delete(lockKey);
    }
  } catch (e) {
    console.error('selfBill error:', e?.message || e);
    return res.status(500).json({ message: 'Failed to create self-bill' });
  }
}
