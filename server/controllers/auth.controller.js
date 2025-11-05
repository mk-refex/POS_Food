import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../models/index.js';
import { Op } from 'sequelize';
import { signToken } from '../middleware/auth.js';

const registerSchema = z.object({
  username: z.string().min(3).regex(/^[a-zA-Z0-9_.-]+$/),
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
});

export async function register(req, res) {
  try {
    const parse = registerSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: parse.error.flatten().fieldErrors 
      });
    }
    
    const { username, email, password, name } = parse.data;
    const existing = await User.findOne({ where: { [Op.or]: [{ email }, { username }] } });
    if (existing) {
      if (existing.email === email) return res.status(409).json({ message: 'Email already in use' });
      if (existing.username === username) return res.status(409).json({ message: 'Username already in use' });
      return res.status(409).json({ message: 'User already exists' });
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, name, passwordHash });
    const token = signToken({ userId: user.id, role: user.role });
    
    return res.status(201).json({ 
      token, 
      user: { 
        id: user.id, 
        username: user.username,
        email: user.email, 
        name: user.name, 
        role: user.role 
      } 
    });
  } catch (error) {
    return res.status(500).json({ message: 'Registration failed', error: error.message });
  }
}

const loginSchema = z.object({
  identifier: z.string().min(3), // username or email
  password: z.string().min(6),
});

export async function login(req, res) {
  try {
    const parse = loginSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: parse.error.flatten().fieldErrors 
      });
    }
    
    const { identifier, password } = parse.data;
    const user = await User.findOne({ where: { [Op.or]: [{ email: identifier }, { username: identifier }] } });
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    
    const token = signToken({ userId: user.id, role: user.role });
    
    return res.json({ 
      token, 
      user: { 
        id: user.id, 
        username: user.username,
        email: user.email, 
        name: user.name, 
        role: user.role 
      } 
    });
  } catch (error) {
    return res.status(500).json({ message: 'Login failed', error: error.message });
  }
}
