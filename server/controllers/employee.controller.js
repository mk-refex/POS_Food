import { Op } from 'sequelize';
import { Transaction, Menu, Feedback, Employee, Guest } from '../models/index.js';

/** List transactions for the logged-in employee only */
export async function getMyTransactions(req, res) {
  const { employeeId } = req.employee;
  const { startDate, endDate } = req.query;
  const where = { customerType: 'employee', customerId: employeeId };
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date[Op.gte] = startDate;
    if (endDate) where.date[Op.lte] = endDate;
  }
  const transactions = await Transaction.findAll({
    where,
    order: [['date', 'DESC'], ['id', 'DESC']],
  });
  return res.json(transactions);
}

/** Dashboard aggregates for the logged-in employee */
export async function getMyDashboard(req, res) {
  const { employeeId } = req.employee;
  const { startDate, endDate } = req.query;

  const where = { customerType: 'employee', customerId: employeeId };
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date[Op.gte] = startDate;
    if (endDate) where.date[Op.lte] = endDate;
  }

  const transactions = await Transaction.findAll({
    where,
    order: [['date', 'ASC'], ['id', 'ASC']],
  });

  const byDay = {};
  const byWeek = {};
  const byMonth = {};
  const byYear = {};

  for (const t of transactions) {
    const date = t.date;
    const breakfast = (t.items || []).filter((i) => i.name === 'Breakfast').reduce((s, i) => s + (i.quantity || 0), 0);
    const lunch = (t.items || []).filter((i) => i.name === 'Lunch').reduce((s, i) => s + (i.quantity || 0), 0);
    const totalAmount = Number(t.totalAmount) || 0;

    if (!byDay[date]) byDay[date] = { date, breakfast: 0, lunch: 0, totalAmount: 0, count: 0 };
    byDay[date].breakfast += breakfast;
    byDay[date].lunch += lunch;
    byDay[date].totalAmount += totalAmount;
    byDay[date].count += 1;

    const d = new Date(date + 'T12:00:00');
    const weekKey = getWeekKey(d);
    const monthKey = date.slice(0, 7);
    const yearKey = date.slice(0, 4);
    if (!byWeek[weekKey]) byWeek[weekKey] = { week: weekKey, breakfast: 0, lunch: 0, totalAmount: 0, count: 0 };
    byWeek[weekKey].breakfast += breakfast;
    byWeek[weekKey].lunch += lunch;
    byWeek[weekKey].totalAmount += totalAmount;
    byWeek[weekKey].count += 1;
    if (!byMonth[monthKey]) byMonth[monthKey] = { month: monthKey, breakfast: 0, lunch: 0, totalAmount: 0, count: 0 };
    byMonth[monthKey].breakfast += breakfast;
    byMonth[monthKey].lunch += lunch;
    byMonth[monthKey].totalAmount += totalAmount;
    byMonth[monthKey].count += 1;
    if (!byYear[yearKey]) byYear[yearKey] = { year: yearKey, breakfast: 0, lunch: 0, totalAmount: 0, count: 0 };
    byYear[yearKey].breakfast += breakfast;
    byYear[yearKey].lunch += lunch;
    byYear[yearKey].totalAmount += totalAmount;
    byYear[yearKey].count += 1;
  }

  const summary = {
    totalTransactions: transactions.length,
    totalBreakfast: Object.values(byDay).reduce((s, d) => s + d.breakfast, 0),
    totalLunch: Object.values(byDay).reduce((s, d) => s + d.lunch, 0),
    totalAmount: Object.values(byDay).reduce((s, d) => s + d.totalAmount, 0),
  };

  const transactionsLatestFirst = [...transactions].reverse();
  return res.json({
    summary,
    byDay: Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)),
    byWeek: Object.values(byWeek).sort((a, b) => a.week.localeCompare(b.week)),
    byMonth: Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)),
    byYear: Object.values(byYear).sort((a, b) => a.year.localeCompare(b.year)),
    transactions: transactionsLatestFirst,
  });
}

/** Get logged-in employee profile */
export async function getMyProfile(req, res) {
  try {
    const { employeeId } = req.employee;
    const emp = await Employee.findOne({
      where: { employeeId, isActive: true },
      attributes: ['employeeId', 'employeeName', 'companyName', 'entity', 'mobileNumber', 'email', 'location', 'qrCode', 'createdBy', 'createdDate'],
    });
    if (!emp) return res.status(404).json({ message: 'Employee not found' });
    // Prevent client-side caching of profile so frontend always receives fresh data
    res.setHeader('Cache-Control', 'no-store');
    return res.json(emp);
  } catch (e) {
    console.error('Get my profile error:', e);
    return res.status(500).json({ message: 'Failed to fetch profile' });
  }
}

function getWeekKey(d) {
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay());
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, '0');
  const day = String(start.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Get published menus for given dates or date range. Employees only. */
export async function getMenusForEmployee(req, res) {
  const { dates: datesParam, startDate, endDate } = req.query;
  const dates = datesParam ? String(datesParam).split(',').map((d) => d.trim()).filter(Boolean) : null;
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  let where = { published: true };
  if (startDate && endDate) {
    where.date = { [Op.gte]: startDate, [Op.lte]: endDate };
  } else if (dates && dates.length) {
    where.date = { [Op.in]: dates };
  } else {
    where.date = { [Op.in]: [today, tomorrow] };
  }

  const menus = await Menu.findAll({
    where,
    order: [['date', 'ASC'], ['mealType', 'ASC']],
  });
  return res.json(menus);
}

/** Submit feedback (employee only). Allowed only for past dates or today after 2pm, and only when menu is published. */
export async function submitFeedback(req, res) {
  const { employeeId } = req.employee;
  const { date, mealType, rating, comments, transactionId, items } = req.body;
  if (!date || !mealType) {
    return res.status(400).json({ message: 'date and mealType are required' });
  }

  const meal = mealType.toLowerCase() === 'lunch' ? 'lunch' : 'breakfast';
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;
  if (date > todayStr) {
    return res.status(400).json({ message: 'Cannot give feedback for future dates. Only past menus or today after 2:00 PM.' });
  }
  if (date === todayStr) {
    const hour = now.getHours();
    const minute = now.getMinutes();
    if (hour < 14 || (hour === 14 && minute < 0)) {
      return res.status(400).json({ message: 'Feedback for today is allowed only after 2:00 PM.' });
    }
  }

  const menu = await Menu.findOne({ where: { date, mealType: meal } });
  if (!menu || !Array.isArray(menu.items) || menu.items.length === 0) {
    return res.status(400).json({ message: 'No menu published for this date and meal. Feedback not available.' });
  }

  const transactions = await Transaction.findAll({
    where: { customerType: 'employee', customerId: employeeId, date },
  });
  const hadThisMeal = transactions.some((t) => {
    const items = t.items || [];
    const mealItemName = meal === 'lunch' ? 'Lunch' : 'Breakfast';
    return items.some((i) => i.name === mealItemName && (i.quantity || 0) > 0);
  });
  if (!hadThisMeal) {
    return res.status(400).json({ message: 'You can only give feedback for meals you consumed (billed) on this date. No billing transaction found for this meal.' });
  }

  const existing = await Feedback.findOne({
    where: { employeeId, date, mealType: meal },
  });
  if (existing) {
    return res.status(400).json({ message: 'You have already given feedback for this meal on this date.' });
  }

  // If items provided, expect per-item ratings/comments
  let savePayload = {
    employeeId,
    transactionId: transactionId || null,
    date,
    mealType: meal,
    comments: comments || null,
  };

  if (Array.isArray(items) && items.length > 0) {
    // validate items against menu and rating values
    const menuNames = (menu.items || []).map((it) => String(it.name).trim().toLowerCase());
    const validatedItems = [];
    for (const it of items) {
      const name = String(it.name || '').trim();
      const rr = Number(it.rating || 0);
      const comm = it.comments ? String(it.comments).trim() : null;
      if (!name || rr < 1 || rr > 5) {
        return res.status(400).json({ message: 'Each item must have a valid name and rating 1–5' });
      }
      if (!menuNames.includes(name.toLowerCase())) {
        return res.status(400).json({ message: `Menu item "${name}" is not present for this meal/date` });
      }
      validatedItems.push({ name, rating: rr, comments: comm });
    }
    // compute average rating for compatibility
    const avg = Math.round(validatedItems.reduce((s, it) => s + it.rating, 0) / validatedItems.length);
    savePayload.items = validatedItems;
    savePayload.rating = avg;
  } else {
    // legacy single-rating flow
    if (rating == null) {
      return res.status(400).json({ message: 'rating is required' });
    }
    const r = Number(rating);
    if (r < 1 || r > 5) {
      return res.status(400).json({ message: 'rating must be 1–5' });
    }
    savePayload.rating = r;
  }

  try {
    const feedback = await Feedback.create(savePayload);
    return res.status(201).json(feedback);
  } catch (error) {
    console.error('Submit feedback error:', error);
    return res.status(500).json({ message: 'Failed to submit feedback' });
  }
}

/** List own feedback (employee only) */
export async function getMyFeedback(req, res) {
  const { employeeId } = req.employee;
  const { startDate, endDate } = req.query;
  const where = { employeeId };
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date[Op.gte] = startDate;
    if (endDate) where.date[Op.lte] = endDate;
  }
  const list = await Feedback.findAll({ where, order: [['date', 'DESC'], ['id', 'DESC']] });
  return res.json(list);
}

/** List guests created by this employee. Uses isActive for status; auto-expires guests when expirationDate has passed. */
export async function getMyGuests(req, res) {
  try {
    const { employeeId } = req.employee;
    const today = new Date().toISOString().split('T')[0];

    // Automatically set isActive = false for guests whose expirationDate has passed
    await Guest.update(
      { isActive: false },
      {
        where: {
          createdBy: employeeId,
          isActive: true,
          [Op.and]: [{ expirationDate: { [Op.ne]: null } }, { expirationDate: { [Op.lt]: today } }],
        },
      }
    );

    const guests = await Guest.findAll({
      where: { createdBy: employeeId },
      order: [['id', 'DESC']],
      attributes: ['id', 'name', 'companyName', 'createdDate', 'expirationDate', 'isActive'],
    });
    const list = guests.map((g) => {
      const json = g.toJSON();
      const status = json.isActive ? 'active' : 'expired';
      return { ...json, status };
    });
    return res.json(list);
  } catch (e) {
    console.error('getMyGuests error:', e?.message || e);
    return res.status(500).json({ message: 'Failed to fetch guests' });
  }
}

/** Distinct company names for guest dropdown (from Employee table). */
export async function getGuestCompanies(req, res) {
  try {
    const companies = await Employee.findAll({
      attributes: ['companyName'],
      where: { isActive: true },
      group: ['companyName'],
      raw: true,
    });
    const names = [...new Set((companies || []).map((c) => c.companyName).filter(Boolean))].sort();
    return res.json(names);
  } catch (e) {
    console.error('getGuestCompanies error:', e?.message || e);
    return res.status(500).json({ message: 'Failed to fetch companies' });
  }
}

/** Create one or more guests (bulk). Body: { guests: [{ name, companyName, expirationDate? }] } or single { name, companyName, expirationDate? }. */
export async function createMyGuests(req, res) {
  try {
    const { employeeId } = req.employee;
    const body = req.body || {};
    const list = Array.isArray(body.guests) ? body.guests : [body];
    if (list.length === 0) return res.status(400).json({ message: 'No guest data provided' });
    const today = new Date().toISOString().split('T')[0];
    const created = [];
    for (const item of list) {
      const name = String(item.name || '').trim();
      const companyName = String(item.companyName || '').trim();
      if (!name || !companyName) continue;
      const guest = await Guest.create({
        name,
        companyName,
        createdBy: employeeId,
        createdDate: today,
        expirationDate: item.expirationDate && String(item.expirationDate).trim() ? String(item.expirationDate).trim().slice(0, 10) : null,
        isActive: true,
      });
      created.push(guest);
    }
    if (created.length === 0) return res.status(400).json({ message: 'Valid name and company required' });
    return res.status(201).json(Array.isArray(body.guests) ? created : created[0]);
  } catch (e) {
    console.error('createMyGuests error:', e?.message || e);
    return res.status(500).json({ message: 'Failed to create guests' });
  }
}

/** Manually expire a guest's QR (set isActive = false and expirationDate to yesterday). Only for guests created by this employee. */
export async function expireMyGuest(req, res) {
  try {
    const { id } = req.params;
    const { employeeId } = req.employee;
    const guestId = parseInt(id, 10);
    if (Number.isNaN(guestId)) return res.status(400).json({ message: 'Invalid guest id' });
    const guest = await Guest.findOne({
      where: { id: guestId, createdBy: employeeId, isActive: true },
    });
    if (!guest) return res.status(404).json({ message: 'Guest not found' });
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    await guest.update({ isActive: false, expirationDate: yesterdayStr });
    const json = guest.toJSON();
    return res.json({ ...json, status: 'expired' });
  } catch (e) {
    console.error('expireMyGuest error:', e?.message || e);
    return res.status(500).json({ message: 'Failed to expire guest' });
  }
}

