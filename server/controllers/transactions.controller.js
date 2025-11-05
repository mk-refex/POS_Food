import { z } from 'zod';
import { Op } from 'sequelize';
import { Transaction } from '../models/index.js';

const createSchema = z.object({
  customerType: z.enum(['employee', 'guest', 'supportStaff']),
  customerId: z.string().optional().nullable(),
  customerName: z.string().optional().nullable(),
  companyName: z.string().optional().nullable(),
  date: z.string(),
  time: z.string(),
  items: z.array(z.object({
    id: z.string().optional(),
    name: z.string(),
    quantity: z.number().int().positive(),
    isException: z.boolean().optional(),
    actualPrice: z.number().int().nonnegative(),
  })),
  totalItems: z.number().int().nonnegative(),
  totalAmount: z.number().int().nonnegative(),
});

export async function createTransaction(req, res) {
  const parse = createSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.flatten() });
  const user = req.user;
  // Server-side meal validation: one breakfast and one lunch per day per person (non-exception items only)
  const payload = { ...parse.data };
  const { date, customerType, customerId, items } = payload;
  const warnings = {};

  try {
    if (customerType !== 'guest' && customerId) {
      const prior = await Transaction.findAll({
        where: { date, customerType, customerId },
        order: [['id', 'ASC']],
      });

      const totals = prior.reduce(
        (acc, t) => {
          for (const it of t.items || []) {
            if (it.isException) continue;
            if (it.name === 'Breakfast') acc.breakfast += Number(it.quantity || 0);
            if (it.name === 'Lunch') acc.lunch += Number(it.quantity || 0);
          }
          return acc;
        },
        { breakfast: 0, lunch: 0 }
      );

      const newBreakfast = (items || [])
        .filter((i) => i.name === 'Breakfast' && !i.isException)
        .reduce((s, i) => s + i.quantity, 0);
      const newLunch = (items || [])
        .filter((i) => i.name === 'Lunch' && !i.isException)
        .reduce((s, i) => s + i.quantity, 0);

      if (totals.breakfast + newBreakfast > 1) warnings.breakfastExceeded = true;
      if (totals.lunch + newLunch > 1) warnings.lunchExceeded = true;
    }
  } catch (e) {
    // proceed without warnings on error
  }

  // If validation only requested, return warnings without creating
  if (req.query && req.query.validateOnly === 'true') {
    return res.status(200).json({ warnings });
  }

  const trx = await Transaction.create({ ...payload, userId: user?.userId ?? null });
  return res.status(201).json({ ...trx.toJSON(), warnings });
}

export async function listTransactions(req, res) {
  const { startDate, endDate, customerType } = req.query;
  const user = req.user;
  const isAdmin = user?.role === 'admin';
  const where = {};
  if (!isAdmin) where.userId = user?.userId ?? 0;
  if (customerType) where.customerType = customerType;
  
  // Fix date filtering for Sequelize with MySQL
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date[Op.gte] = startDate;
    if (endDate) where.date[Op.lte] = endDate;
  }
  
  const transactions = await Transaction.findAll({ where, order: [['id', 'DESC']] });
  return res.json(transactions);
}

export async function deleteTransaction(req, res) {
  const transactionId = Number(req.params.id);
  const user = req.user;
  const isAdmin = user?.role === 'admin';
  
  try {
    const transaction = await Transaction.findByPk(transactionId);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    
    // Non-admin users can only delete their own transactions
    if (!isAdmin && transaction.userId !== user?.userId) {
      return res.status(403).json({ message: 'Unauthorized to delete this transaction' });
    }
    
    await transaction.destroy();
    return res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete transaction', error: error.message });
  }
}
