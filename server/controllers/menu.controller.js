import { Op } from 'sequelize';
import { Menu } from '../models/index.js';
import { emitMenuUpdated } from '../socket.js';

export async function listMenus(req, res) {
  try {
    const { startDate, endDate, mealType } = req.query;
    const where = {};
    if (mealType) where.mealType = mealType;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date[Op.gte] = startDate;
      if (endDate) where.date[Op.lte] = endDate;
    }
    const menus = await Menu.findAll({ where, order: [['date', 'DESC'], ['mealType', 'ASC']] });
    return res.json(menus);
  } catch (error) {
    console.error('List menus error:', error);
    return res.status(500).json({ message: 'Failed to list menus' });
  }
}

export async function upsertMenu(req, res) {
  try {
    const { date, mealType, items, published } = req.body;
    if (!date || !mealType) {
      return res.status(400).json({ message: 'date and mealType required' });
    }
    const payload = { date, mealType, items: items || [], published: published !== false };
    const [menu] = await Menu.findOrCreate({
      where: { date, mealType },
      defaults: payload,
    });
    if (menu.date !== payload.date || menu.mealType !== payload.mealType) {
      await menu.update(payload);
    } else {
      await menu.update({ items: payload.items, published: payload.published });
    }
    emitMenuUpdated();
    return res.json(menu);
  } catch (error) {
    console.error('Upsert menu error:', error);
    return res.status(500).json({ message: 'Failed to save menu' });
  }
}

export async function deleteMenu(req, res) {
  try {
    const { date, mealType } = req.query;
    if (!date || !mealType) {
      return res.status(400).json({ message: 'date and mealType query params required' });
    }
    const deleted = await Menu.destroy({ where: { date, mealType } });
    if (deleted) emitMenuUpdated();
    return res.json({ deleted: deleted > 0 });
  } catch (error) {
    console.error('Delete menu error:', error);
    return res.status(500).json({ message: 'Failed to delete menu' });
  }
}
