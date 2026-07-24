import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey() {
  const secret =
    process.env.FEEDBACK_LINK_SECRET ||
    process.env.JWT_SECRET ||
    'pos-food-feedback-link-dev';
  return crypto.createHash('sha256').update(String(secret)).digest();
}

/** Encrypt employeeId + date for email feedback links. */
export function createFeedbackLinkToken(employeeId, date) {
  const payload = JSON.stringify({
    e: String(employeeId).trim(),
    d: String(date).trim(),
  });
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64url');
}

/** Decrypt token; returns { employeeId, date } or null. */
export function verifyFeedbackLinkToken(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const buf = Buffer.from(token, 'base64url');
    if (buf.length < IV_LEN + TAG_LEN + 1) return null;
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const enc = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
    const { e, d } = JSON.parse(dec);
    if (!e || !d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
    return { employeeId: e, date: d };
  } catch {
    return null;
  }
}

/** Full URL for the public menu feedback form (link-only access). */
export function getMenuFeedbackUrl(employeeId, date) {
  const base = (
    process.env.FRONTEND_URL ||
    process.env.CLIENT_URL ||
    'http://localhost:5000'
  ).replace(/\/$/, '');
  const token = createFeedbackLinkToken(employeeId, date);
  return `${base}/menu-feedback?token=${encodeURIComponent(token)}`;
}
