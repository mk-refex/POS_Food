import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../models/index.js';
import { Op } from 'sequelize';
import { signToken } from '../middleware/auth.js';

const registerSchema = z.object({
  username: z.string().trim().min(3).regex(/^[a-zA-Z0-9_.-]+$/),
  email: z.string().trim().email(),
  password: z.string().min(6),
  name: z.string().trim().min(1),
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
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim();
    const normalizedName = name.trim();
    const existing = await User.findOne({
      where: { [Op.or]: [{ email: normalizedEmail }, { username: normalizedUsername }] },
    });
    if (existing) {
      if (existing.email === normalizedEmail) return res.status(409).json({ message: 'Email already in use' });
      if (existing.username === normalizedUsername) return res.status(409).json({ message: 'Username already in use' });
      return res.status(409).json({ message: 'User already exists' });
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username: normalizedUsername,
      email: normalizedEmail,
      name: normalizedName,
      passwordHash,
    });
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
  identifier: z.string().trim().min(3), // username or email
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
    
    const identifier = parse.data.identifier.trim();
    const { password } = parse.data;
    const emailLookup = identifier.includes('@') ? identifier.toLowerCase() : identifier;
    const user = await User.findOne({
      where: { [Op.or]: [{ email: emailLookup }, { username: identifier }] },
    });
    
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
