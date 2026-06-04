import { Op } from 'sequelize';
import { Employee, Transaction, Menu, Feedback } from '../models/index.js';

export async function findEmployeeByIdentifier(identifier) {
  let id = String(identifier || '').trim();
  if (!id) return null;
  const byEmail = id.includes('@');
  if (byEmail) id = id.toLowerCase();
  const where = byEmail ? { email: id, isActive: true } : { employeeId: id, isActive: true };
  return Employee.findOne({
    where,
    attributes: ['employeeId', 'employeeName', 'companyName', 'email'],
  });
}

function todayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function employeeConsumedMealOnDate(transactions, meal) {
  const mealItemName = meal === 'lunch' ? 'Lunch' : 'Breakfast';
  return transactions.some((t) => {
    const items = t.items || [];
    return items.some((i) => i.name === mealItemName && (i.quantity || 0) > 0);
  });
}

/** Build public verify payload: consumed meals, menus, existing feedback. */
export async function getPublicFeedbackContext(employeeId, date) {
  if (date > todayStr()) {
    return { error: 'Cannot give feedback for future dates.' };
  }

  const transactions = await Transaction.findAll({
    where: { customerType: 'employee', customerId: employeeId, date },
  });

  const consumed = {
    breakfast: employeeConsumedMealOnDate(transactions, 'breakfast'),
    lunch: employeeConsumedMealOnDate(transactions, 'lunch'),
  };

  if (!consumed.breakfast && !consumed.lunch) {
    return {
      error:
        'No canteen billing found for this date. You can only rate meals you consumed (billed).',
    };
  }

  const existingFeedback = await Feedback.findAll({
    where: { employeeId, date },
  });
  const feedbackGiven = {
    breakfast: existingFeedback.some((f) => f.mealType === 'breakfast'),
    lunch: existingFeedback.some((f) => f.mealType === 'lunch'),
  };

  const menus = await Menu.findAll({
    where: { date, mealType: { [Op.in]: ['breakfast', 'lunch'] } },
  });

  const sessions = [];
  for (const meal of ['breakfast', 'lunch']) {
    if (!consumed[meal]) continue;
    const menu = menus.find((m) => m.mealType === meal);
    const items = menu?.items?.length ? menu.items : [];
    if (items.length === 0) continue;
    sessions.push({
      mealType: meal,
      menuItems: items.map((it) => ({
        name: it.name,
        description: it.description || undefined,
      })),
      alreadySubmitted: feedbackGiven[meal],
    });
  }

  if (sessions.length === 0) {
    return {
      error:
        'No published menu for your consumed meals on this date. Feedback is not available yet.',
    };
  }

  return { consumed, feedbackGiven, sessions };
}

/** Create feedback for an employee (shared by portal and public form). */
export async function createEmployeeFeedback(employeeId, body) {
  const { date, mealType, rating, comments, transactionId, items } = body;
  if (!date || !mealType) {
    return { status: 400, message: 'date and mealType are required' };
  }

  const meal = mealType.toLowerCase() === 'lunch' ? 'lunch' : 'breakfast';
  if (date > todayStr()) {
    return { status: 400, message: 'Cannot give feedback for future dates.' };
  }

  const menu = await Menu.findOne({ where: { date, mealType: meal } });
  if (!menu || !Array.isArray(menu.items) || menu.items.length === 0) {
    return {
      status: 400,
      message: 'No menu published for this date and meal. Feedback not available.',
    };
  }

  const transactions = await Transaction.findAll({
    where: { customerType: 'employee', customerId: employeeId, date },
  });
  if (!employeeConsumedMealOnDate(transactions, meal)) {
    return {
      status: 400,
      message:
        'You can only give feedback for meals you consumed (billed) on this date. No billing transaction found for this meal.',
    };
  }

  const existing = await Feedback.findOne({
    where: { employeeId, date, mealType: meal },
  });
  if (existing) {
    return {
      status: 400,
      message: 'You have already given feedback for this meal on this date.',
    };
  }

  const savePayload = {
    employeeId,
    transactionId: transactionId || null,
    date,
    mealType: meal,
    comments: comments || null,
  };

  if (Array.isArray(items) && items.length > 0) {
    const menuNames = (menu.items || []).map((it) => String(it.name).trim().toLowerCase());
    const validatedItems = [];
    for (const it of items) {
      const name = String(it.name || '').trim();
      const rr = Math.min(5, Math.max(0, Number(it.rating || 0)));
      const comm = it.comments ? String(it.comments).trim() : null;
      if (!name) {
        return { status: 400, message: 'Each item must have a valid name' };
      }
      if (!menuNames.includes(name.toLowerCase())) {
        return {
          status: 400,
          message: `Menu item "${name}" is not present for this meal/date`,
        };
      }
      validatedItems.push({ name, rating: rr, comments: comm });
    }
    const sum = validatedItems.reduce((s, it) => s + it.rating, 0);
    const avg = validatedItems.length ? Math.round(sum / validatedItems.length) : 0;
    savePayload.items = validatedItems;
    savePayload.rating = avg;
  } else {
    const r =
      rating != null && rating !== '' ? Math.min(5, Math.max(0, Number(rating))) : 0;
    savePayload.rating = r;
  }

  const feedback = await Feedback.create(savePayload);
  return { status: 201, feedback };
}
