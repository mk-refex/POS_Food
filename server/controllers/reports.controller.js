import { z } from 'zod';
import { Op } from 'sequelize';
import { Report, Feedback, Employee } from '../models/index.js';

export async function listReports(req, res) {
  const userId = req.user?.userId;
  const isAdmin = req.user?.role === 'admin';
  const where = isAdmin ? undefined : (userId ? { userId } : { userId: -1 });
  const reports = await Report.findAll({ where, order: [['id', 'DESC']] });
  return res.json(reports);
}

const createSchema = z.object({
  userId: z.number().int().positive(),
  title: z.string().min(1),
  content: z.string().min(1),
});

export async function createReport(req, res) {
  const parse = createSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.flatten() });
  const report = await Report.create(parse.data);
  return res.status(201).json(report);
}

// Admin: list all employee feedback with basic aggregation for reports page
export async function listFeedbackReports(req, res) {
  try {
    const { startDate, endDate } = req.query;
    const where = {};
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date[Op.gte] = startDate;
      if (endDate) where.date[Op.lte] = endDate;
    }

    const feedbacks = await Feedback.findAll({
      where,
      order: [['date', 'DESC'], ['id', 'DESC']],
    });

    const employeeIds = [...new Set(feedbacks.map((f) => f.employeeId).filter(Boolean))];
    let employeesById = {};
    if (employeeIds.length > 0) {
      const employees = await Employee.findAll({ where: { employeeId: employeeIds } });
      employeesById = Object.fromEntries(
        employees.map((e) => [
          e.employeeId,
          {
            employeeName: e.employeeName,
            companyName: e.companyName || null,
          },
        ]),
      );
    }

    const list = feedbacks.map((f) => {
      const emp = employeesById[f.employeeId] || {};
      return {
        id: f.id,
        employeeId: f.employeeId,
        employeeName: emp.employeeName || null,
        companyName: emp.companyName || null,
        date: f.date,
        mealType: f.mealType,
        rating: f.rating,
        comments: f.comments,
        items: f.items || null,
        createdAt: f.createdAt,
      };
    });

    const byRating = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const mealAgg = {
      breakfast: { count: 0, sum: 0 },
      lunch: { count: 0, sum: 0 },
    };

    // per-item aggregation for admin clarity
    const itemStats = {}; // { itemName: { count, sum } }

    for (const f of feedbacks) {
      // if itemized feedback exists, use item averages for overall calculations
      if (Array.isArray(f.items) && f.items.length > 0) {
        const avg = f.items.reduce((s, it) => s + (Number(it.rating) || 0), 0) / f.items.length;
        const rounded = Math.round(avg) || 0;
        if (byRating[rounded] != null) byRating[rounded] += 1;
        const meal = f.mealType === 'lunch' ? 'lunch' : 'breakfast';
        mealAgg[meal].count += 1;
        mealAgg[meal].sum += avg;

        for (const it of f.items) {
          const name = String(it.name || 'Unknown').trim();
          if (!itemStats[name]) itemStats[name] = { count: 0, sum: 0 };
          itemStats[name].count += 1;
          itemStats[name].sum += Number(it.rating) || 0;
        }
      } else {
        const r = Number(f.rating) || 0;
        if (byRating[r] != null) byRating[r] += 1;
        const meal = f.mealType === 'lunch' ? 'lunch' : 'breakfast';
        mealAgg[meal].count += 1;
        mealAgg[meal].sum += r;
      }
    }

    const total = feedbacks.length;
    const totalSum = (mealAgg.breakfast.sum || 0) + (mealAgg.lunch.sum || 0);

    const summary = {
      total,
      avgRating: total ? Number((totalSum / total).toFixed(2)) : null,
      byMeal: {
        breakfast: {
          count: mealAgg.breakfast.count,
          avgRating: mealAgg.breakfast.count
            ? Number((mealAgg.breakfast.sum / mealAgg.breakfast.count).toFixed(2))
            : null,
        },
        lunch: {
          count: mealAgg.lunch.count,
          avgRating: mealAgg.lunch.count
            ? Number((mealAgg.lunch.sum / mealAgg.lunch.count).toFixed(2))
            : null,
        },
      },
      byRating,
      itemStats: Object.fromEntries(
        Object.entries(itemStats).map(([name, s]) => [name, { count: s.count, avgRating: s.count ? Number((s.sum / s.count).toFixed(2)) : null }])
      ),
    };

    return res.json({ list, summary });
  } catch (error) {
    console.error('listFeedbackReports error:', error);
    return res.status(500).json({ message: 'Failed to load feedback reports' });
  }
}
