import { Employee } from '../models/index.js';
import { verifyFeedbackLinkToken } from '../utils/feedbackLinkToken.js';
import {
  getPublicFeedbackContext,
  createEmployeeFeedback,
} from '../services/feedbackService.js';

async function loadSessionForToken(token) {
  const decoded = verifyFeedbackLinkToken(token);
  if (!decoded) {
    return { status: 401, message: 'This feedback link is invalid or has expired.' };
  }

  const employee = await Employee.findOne({
    where: { employeeId: decoded.employeeId, isActive: true },
    attributes: ['employeeId', 'employeeName', 'companyName', 'email'],
  });
  if (!employee) {
    return { status: 404, message: 'Employee not found.' };
  }

  const ctx = await getPublicFeedbackContext(employee.employeeId, decoded.date);
  if (ctx.error) {
    return { status: 400, message: ctx.error };
  }

  return {
    status: 200,
    data: {
      employeeId: employee.employeeId,
      employeeName: employee.employeeName,
      companyName: employee.companyName || null,
      date: decoded.date,
      consumed: ctx.consumed,
      feedbackGiven: ctx.feedbackGiven,
      sessions: ctx.sessions,
    },
  };
}

/** GET /api/public/feedback/session?token= — load form from encrypted email link */
export async function getPublicFeedbackSession(req, res) {
  try {
    const token = req.query.token;
    const result = await loadSessionForToken(token);
    if (result.status !== 200) {
      return res.status(result.status).json({ message: result.message });
    }
    return res.json(result.data);
  } catch (error) {
    console.error('getPublicFeedbackSession error:', error);
    return res.status(500).json({ message: 'Failed to load feedback session.' });
  }
}

/** POST /api/public/feedback — submit rating (token required) */
export async function submitPublicFeedback(req, res) {
  try {
    const { token, mealType, rating, comments, items } = req.body;
    if (!token) {
      return res.status(400).json({ message: 'A valid feedback link is required.' });
    }

    const decoded = verifyFeedbackLinkToken(token);
    if (!decoded) {
      return res.status(401).json({ message: 'This feedback link is invalid or has expired.' });
    }

    const employee = await Employee.findOne({
      where: { employeeId: decoded.employeeId, isActive: true },
      attributes: ['employeeId'],
    });
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found.' });
    }

    const result = await createEmployeeFeedback(employee.employeeId, {
      date: decoded.date,
      mealType,
      rating,
      comments,
      items,
    });

    if (result.status !== 201) {
      return res.status(result.status).json({ message: result.message });
    }
    return res.status(201).json(result.feedback);
  } catch (error) {
    console.error('submitPublicFeedback error:', error);
    return res.status(500).json({ message: 'Failed to submit feedback.' });
  }
}
