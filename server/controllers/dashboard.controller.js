import { Report, Transaction, User } from '../models/index.js';

export async function getDashboardStats(req, res) {
  const user = req.user;
  const isAdmin = user?.role === 'admin';
  const where = isAdmin ? {} : { userId: user?.userId ?? 0 };

  const [users, invoices, reports] = await Promise.all([
    isAdmin ? User.count() : Promise.resolve(1),
    Transaction.count({ where }),
    Report.count({ where }),
  ]);
  return res.json({ users, invoices, reports });
}
