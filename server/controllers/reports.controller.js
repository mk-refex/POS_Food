import { z } from 'zod';
import { Report } from '../models/index.js';

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
