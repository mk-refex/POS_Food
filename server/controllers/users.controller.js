import { z } from 'zod';
import { User } from '../models/index.js';

export async function me(req, res) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const user = await User.findByPk(userId);
  if (!user) return res.status(404).json({ message: 'User not found' });
  return res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['admin', 'user']).optional(),
});

export async function updateUser(req, res) {
  const userId = Number(req.params.id);
  const parse = updateSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.flatten() });
  const user = await User.findByPk(userId);
  if (!user) return res.status(404).json({ message: 'User not found' });
  await user.update(parse.data);
  return res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
}

export async function listUsers(_req, res) {
  const users = await User.findAll({ order: [['id', 'ASC']] });
  return res.json(users.map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role })));
}
