import nodemailer from 'nodemailer';
import { Op } from 'sequelize';
import { Transaction, SmtpConfig } from '../models/index.js';

const LOGO_URL = 'https://refexrenewables.com/img/logo.png';

/** Base URL for the employee portal (e.g. https://yourapp.com). Set FRONTEND_URL in env for production. */
function getEmployeePortalBaseUrl() {
  const base = (process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
  return base;
}

/** Full URL for employee sign-in page. */
function getEmployeeLoginUrl() {
  return `${getEmployeePortalBaseUrl()}/employee/login`;
}

/**
 * Send a single email via configured SMTP. Used for OTP and other transactional emails.
 * @param {string} to - recipient email
 * @param {string} subject - subject line
 * @param {string} text - plain text body
 * @returns {{ sent: boolean, error?: string }}
 */
export async function sendSmtpMail(to, subject, text) {
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { sent: false, error: 'Invalid recipient email' };
  }
  try {
    const config = await SmtpConfig.findOne({ where: { isActive: true } });
    if (!config || !config.host || !config.user) {
      return { sent: false, error: 'SMTP not configured. Configure SMTP in Admin panel.' };
    }
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port || (config.secure ? 465 : 587),
      secure: !!config.secure,
      auth: config.user ? { user: config.user, pass: config.password || '' } : undefined,
    });
    const from = config.fromEmail || config.user || 'noreply@localhost';
    const fromName = config.fromName || 'POS Food';
    await transporter.sendMail({
      from: config.fromName ? `"${fromName}" <${from}>` : from,
      to,
      subject,
      text,
    });
    return { sent: true };
  } catch (e) {
    const msg = e?.message || String(e);
    console.error('sendSmtpMail error:', msg);
    return { sent: false, error: msg };
  }
}

/**
 * Get monthly (same month as given date) transaction summary for an employee: breakfast/lunch counts and total amount.
 * @param {string} customerType - 'employee' | 'supportStaff'
 * @param {string} customerId - employeeId or staffId
 * @param {string} date - YYYY-MM-DD to determine month
 * @returns {{ breakfastCount: number, lunchCount: number, totalAmount: number, monthLabel: string }}
 */
export async function getMonthlySummaryForCustomer(customerType, customerId, date) {
  if (!date || date.length < 7) {
    return { breakfastCount: 0, lunchCount: 0, totalAmount: 0, monthLabel: '' };
  }
  const [year, month] = date.split('-');
  const startDate = `${year}-${month}-01`;
  const lastDay = new Date(Number(year), Number(month), 0).getDate();
  const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

  const transactions = await Transaction.findAll({
    where: {
      customerType,
      customerId,
      date: { [Op.between]: [startDate, endDate] },
    },
    order: [['date', 'ASC'], ['id', 'ASC']],
  });

  let breakfastCount = 0;
  let lunchCount = 0;
  let totalAmount = 0;
  for (const t of transactions) {
    for (const it of t.items || []) {
      const qty = Number(it.quantity || 0);
      if (it.name === 'Breakfast') breakfastCount += qty;
      if (it.name === 'Lunch') lunchCount += qty;
    }
    totalAmount += Number(t.totalAmount || 0);
  }

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthLabel = monthNames[Number(month) - 1] ? `${monthNames[Number(month) - 1]} ${year}` : `${year}-${month}`;

  return { breakfastCount, lunchCount, totalAmount, monthLabel };
}

/**
 * Build HTML body for transaction notification email.
 */
function buildNotificationHtml(transaction, customerName, monthlySummary) {
  const items = transaction.items || [];
  const breakfastQty = items.filter((i) => i.name === 'Breakfast').reduce((s, i) => s + (i.quantity || 0), 0);
  const lunchQty = items.filter((i) => i.name === 'Lunch').reduce((s, i) => s + (i.quantity || 0), 0);
  const mealParts = [];
  if (breakfastQty > 0) mealParts.push('Breakfast');
  if (lunchQty > 0) mealParts.push('Lunch');
  const mealText = mealParts.length ? mealParts.join(' and ') : 'meal(s)';

  const monthText = monthlySummary.monthLabel
    ? `For ${monthlySummary.monthLabel}: Breakfast ${monthlySummary.breakfastCount}, Lunch ${monthlySummary.lunchCount}. Total amount: ₹${monthlySummary.totalAmount.toLocaleString('en-IN')}.`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Food billing confirmation</title>
</head>
<body style="margin:0; padding:0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 560px; margin: 24px auto; padding: 24px; background: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="text-align: center; margin-bottom: 24px;">
      <img src="${LOGO_URL}" alt="Logo" style="max-width: 180px; height: auto;" />
    </div>
    <h2 style="color: #1a1a1a; margin: 0 0 16px 0; font-size: 20px;">Food Billing Confirmation</h2>
    <p style="color: #333; margin: 0 0 12px 0; line-height: 1.5;">
      Hello ${customerName ? customerName.replace(/</g, '&lt;') : 'there'},
    </p>
    <p style="color: #333; margin: 0 0 12px 0; line-height: 1.5;">
      This is a confirmation that you have consumed <strong>${mealText}</strong> on <strong>${transaction.date}</strong> at <strong>${transaction.time}</strong>.
    </p>
    <p style="color: #333; margin: 0 0 16px 0; line-height: 1.5;">
      <strong>Amount for this transaction: ₹${Number(transaction.totalAmount || 0).toLocaleString('en-IN')}</strong>
    </p>
    ${monthText ? `<p style="color: #555; margin: 0 0 16px 0; line-height: 1.5; font-size: 14px;">Monthly summary – ${monthText}</p>` : ''}
    <p style="color: #333; margin: 20px 0 0 0;">
      <a href="${getEmployeeLoginUrl()}" style="color: #2563eb; font-weight: 600; text-decoration: none;">Sign in to your account</a> for more details (transactions, menu, feedback).
    </p>
    <p style="color: #666; margin: 24px 0 0 0; padding: 12px; background: #f9f9f9; border-radius: 6px; font-size: 13px; line-height: 1.5;">
      If this transaction was not made by you, please contact your administrator.
    </p>
    <p style="color: #999; margin: 20px 0 0 0; font-size: 12px;">
      This is an automated message from the food billing system.
    </p>
  </div>
</body>
</html>`;
}

/**
 * Send transaction notification email to employee (uses configured SMTP).
 * Does not throw; logs errors. Caller can fire-and-forget.
 * @param {object} transaction - Transaction instance or plain object with date, time, items, totalAmount
 * @param {string} toEmail - Recipient email
 * @param {string} customerName - Employee/customer name for greeting
 * @param {object} monthlySummary - { breakfastCount, lunchCount, totalAmount, monthLabel }
 */
export async function sendTransactionNotificationEmail(transaction, toEmail, customerName, monthlySummary) {
  if (!toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
    console.warn('transactionEmail: skipped – invalid or missing email');
    return;
  }
  try {
    const config = await SmtpConfig.findOne({ where: { isActive: true } });
    if (!config || !config.host || !config.user) {
      console.warn('transactionEmail: SMTP not configured, skipping notification');
      return;
    }
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port || (config.secure ? 465 : 587),
      secure: !!config.secure,
      auth: config.user ? { user: config.user, pass: config.password || '' } : undefined,
    });
    const from = config.fromEmail || config.user || 'noreply@localhost';
    const fromName = config.fromName || 'Food Billing';
    const loginUrl = getEmployeeLoginUrl();
    const plain = `Food Billing Confirmation\n\nYou have consumed ${(transaction.items || []).filter(i => i.name === 'Breakfast' || i.name === 'Lunch').map(i => i.name).join(' and ') || 'meal(s)'} on ${transaction.date} at ${transaction.time}. Amount: ₹${Number(transaction.totalAmount || 0).toLocaleString('en-IN')}.\n\nSign in to your account for more details: ${loginUrl}\n\nIf this was not you, please contact your administrator.`;
    await transporter.sendMail({
      from: config.fromName ? `"${fromName}" <${from}>` : from,
      to: toEmail,
      subject: `Food billing confirmation – ${transaction.date}`,
      text: plain,
      html: buildNotificationHtml(transaction, customerName, monthlySummary || { breakfastCount: 0, lunchCount: 0, totalAmount: 0, monthLabel: '' }),
    });
    console.log(`transactionEmail: notification sent to ${toEmail} for transaction ${transaction.date}`);
  } catch (e) {
    console.error('transactionEmail: failed to send', e?.message || e);
  }
}
