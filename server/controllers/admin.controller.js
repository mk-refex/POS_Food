import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { User, ApiConfig } from '../models/index.js';

// User Management
export async function listUsers(req, res) {
  try {
    const users = await User.findAll({
      order: [['createdAt', 'DESC']],
      attributes: { exclude: ['passwordHash'] }
    });
    return res.json(users);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch users', error: error.message });
  }
}

export async function getUserById(req, res) {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id, {
      attributes: { exclude: ['passwordHash'] }
    });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    return res.json(user);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch user', error: error.message });
  }
}

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  role: z.enum(['admin', 'user']).optional(),
});

export async function createUser(req, res) {
  try {
    const parse = createUserSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: parse.error.flatten().fieldErrors 
      });
    }
    
    const { email, password, name, role = 'user' } = parse.data;
    
    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already in use' });
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ 
      email, 
      passwordHash, 
      name, 
      role 
    });
    
    // Return user without password hash
    const { passwordHash: _, ...userResponse } = user.toJSON();
    return res.status(201).json(userResponse);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create user', error: error.message });
  }
}

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
  role: z.enum(['admin', 'user']).optional(),
  password: z.string().min(6).optional(),
});

export async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const parse = updateUserSchema.safeParse(req.body);
    
    if (!parse.success) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: parse.error.flatten().fieldErrors 
      });
    }
    
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const updateData = { ...parse.data };
    
    // Handle password update
    if (updateData.password) {
      updateData.passwordHash = await bcrypt.hash(updateData.password, 10);
      delete updateData.password;
    }
    
    // Check email uniqueness if email is being updated
    if (updateData.email && updateData.email !== user.email) {
      const existingUser = await User.findOne({ where: { email: updateData.email } });
      if (existingUser) {
        return res.status(409).json({ message: 'Email already in use' });
      }
    }
    
    await user.update(updateData);
    
    // Return updated user without password hash
    const { passwordHash: _, ...userResponse } = user.toJSON();
    return res.json(userResponse);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update user', error: error.message });
  }
}

// API Config (singleton)
export async function getApiConfig(req, res) {
  try {
    const cfg = await ApiConfig.findOne({ where: { isActive: true } });
    return res.json(cfg || null);
  } catch (e) {
    return res.status(500).json({ message: 'Failed to fetch API config', error: e.message });
  }
}

export async function upsertApiConfig(req, res) {
  try {
    const { baseUrl, accessToken, apiKey, username, password, headersJson } = req.body || {};
    let cfg = await ApiConfig.findOne({ where: { isActive: true } });
    if (!cfg) {
      cfg = await ApiConfig.create({
        baseUrl: baseUrl || '',
        accessToken: accessToken || null,
        apiKey: apiKey || null,
        username: username || null,
        password: password || null,
        headersJson: headersJson || null,
        updatedBy: req.user?.name || 'Admin',
        updatedDate: new Date().toISOString().split('T')[0],
        isActive: true,
      });
    } else {
      await cfg.update({
        baseUrl: baseUrl || cfg.baseUrl,
        accessToken: accessToken ?? cfg.accessToken,
        apiKey: apiKey ?? cfg.apiKey,
        username: username ?? cfg.username,
        password: password ?? cfg.password,
        headersJson: headersJson ?? cfg.headersJson,
        updatedBy: req.user?.name || 'Admin',
        updatedDate: new Date().toISOString().split('T')[0],
      });
    }
    return res.json(cfg);
  } catch (e) {
    return res.status(500).json({ message: 'Failed to save API config', error: e.message });
  }
}

// Proxy HRMS Employees fetch to avoid browser CORS
export async function fetchHrmsEmployees(req, res) {
  try {
    const cfg = await ApiConfig.findOne({ where: { isActive: true } });
    if (!cfg || !cfg.baseUrl) {
      return res.status(400).json({ message: 'API Config not set' });
    }
    const base = cfg.baseUrl.replace(/\/$/, '');
    const url = `${base}/api/employees/active${req.query.page ? `?page=${encodeURIComponent(String(req.query.page))}` : ''}`;
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (cfg.accessToken) headers['Authorization'] = `Bearer ${cfg.accessToken}`;
    if (cfg.apiKey) headers['x-api-key'] = cfg.apiKey;
    if (cfg.headersJson) {
      try { Object.assign(headers, JSON.parse(cfg.headersJson)); } catch {}
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    let resp;
    try {
      resp = await fetch(url, { method: 'GET', headers, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    if (!resp.ok) {
      const text = await resp.text();
      return res.status(resp.status).send(text || resp.statusText);
    }
    const data = await resp.json();
    return res.json(data);
  } catch (e) {
    return res.status(500).json({ message: 'Failed to fetch HRMS employees', error: e.message });
  }
}

export async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    
    // Prevent admin from deleting themselves
    if (req.user.userId === parseInt(id)) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }
    
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    await user.destroy();
    return res.json({ message: 'User deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete user', error: error.message });
  }
}

// Company Management
export async function listCompanies(req, res) {
  try {
    const companies = await Company.findAll({
      order: [['createdAt', 'DESC']]
    });
    return res.json(companies);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch companies', error: error.message });
  }
}

export async function getCompanyById(req, res) {
  try {
    const { id } = req.params;
    const company = await Company.findByPk(id);
    
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }
    
    return res.json(company);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch company', error: error.message });
  }
}

const createCompanySchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function createCompany(req, res) {
  try {
    const parse = createCompanySchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: parse.error.flatten().fieldErrors 
      });
    }
    
    const { name, code, description, isActive = true } = parse.data;
    
    // Check if company code already exists
    const existingCompany = await Company.findOne({ where: { code } });
    if (existingCompany) {
      return res.status(409).json({ message: 'Company code already in use' });
    }
    
    const company = await Company.create({ 
      name, 
      code, 
      description, 
      isActive 
    });
    
    return res.status(201).json(company);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create company', error: error.message });
  }
}

const updateCompanySchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function updateCompany(req, res) {
  try {
    const { id } = req.params;
    const parse = updateCompanySchema.safeParse(req.body);
    
    if (!parse.success) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: parse.error.flatten().fieldErrors 
      });
    }
    
    const company = await Company.findByPk(id);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }
    
    const updateData = { ...parse.data };
    
    // Check code uniqueness if code is being updated
    if (updateData.code && updateData.code !== company.code) {
      const existingCompany = await Company.findOne({ where: { code: updateData.code } });
      if (existingCompany) {
        return res.status(409).json({ message: 'Company code already in use' });
      }
    }
    
    await company.update(updateData);
    return res.json(company);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update company', error: error.message });
  }
}

export async function deleteCompany(req, res) {
  try {
    const { id } = req.params;
    
    const company = await Company.findByPk(id);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }
    
    await company.destroy();
    return res.json({ message: 'Company deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete company', error: error.message });
  }
}

// HRMS Configuration Management
export async function listHrmsConfigs(req, res) {
  try {
    const configs = await HrmsConfig.findAll({
      include: [{ model: Company, as: 'company' }],
      order: [['createdAt', 'DESC']]
    });
    return res.json(configs);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch HRMS configs', error: error.message });
  }
}

export async function getHrmsConfigById(req, res) {
  try {
    const { id } = req.params;
    const config = await HrmsConfig.findByPk(id, {
      include: [{ model: Company, as: 'company' }]
    });
    
    if (!config) {
      return res.status(404).json({ message: 'HRMS config not found' });
    }
    
    return res.json(config);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch HRMS config', error: error.message });
  }
}

const createHrmsConfigSchema = z.object({
  companyId: z.number().int().positive(),
  apiUrl: z.string().url(),
  accessToken: z.string().optional(),
  apiKey: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  headers: z.union([z.record(z.string()), z.string()]).optional(),
  isActive: z.boolean().optional(),
  syncInterval: z.number().int().positive().optional(),
});

export async function createHrmsConfig(req, res) {
  try {
    const parse = createHrmsConfigSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: parse.error.flatten().fieldErrors 
      });
    }
    
    const { companyId, apiUrl, accessToken, apiKey, username, password, headers, isActive = true, syncInterval = 24 } = parse.data;
    
    // Check if company exists
    const company = await Company.findByPk(companyId);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }
    
    // Check if config already exists for this company
    const existingConfig = await HrmsConfig.findOne({ where: { companyId } });
    if (existingConfig) {
      return res.status(409).json({ message: 'HRMS config already exists for this company' });
    }
    
    // Parse headers if it's a string
    let parsedHeaders = headers;
    if (typeof headers === 'string') {
      try {
        parsedHeaders = JSON.parse(headers);
      } catch (e) {
        return res.status(400).json({ message: 'Invalid JSON format for headers' });
      }
    }
    
    const config = await HrmsConfig.create({ 
      companyId, 
      apiUrl, 
      accessToken, 
      apiKey, 
      username, 
      password, 
      headers: parsedHeaders, 
      isActive, 
      syncInterval 
    });
    
    // Return config with company info
    const configWithCompany = await HrmsConfig.findByPk(config.id, {
      include: [{ model: Company, as: 'company' }]
    });
    
    return res.status(201).json(configWithCompany);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create HRMS config', error: error.message });
  }
}

const updateHrmsConfigSchema = z.object({
  apiUrl: z.string().url().optional(),
  accessToken: z.string().optional(),
  apiKey: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  headers: z.record(z.string()).optional(),
  isActive: z.boolean().optional(),
  syncInterval: z.number().int().positive().optional(),
});

export async function updateHrmsConfig(req, res) {
  try {
    const { id } = req.params;
    const parse = updateHrmsConfigSchema.safeParse(req.body);
    
    if (!parse.success) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: parse.error.flatten().fieldErrors 
      });
    }
    
    const config = await HrmsConfig.findByPk(id);
    if (!config) {
      return res.status(404).json({ message: 'HRMS config not found' });
    }
    
    await config.update(parse.data);
    
    // Return updated config with company info
    const updatedConfig = await HrmsConfig.findByPk(config.id, {
      include: [{ model: Company, as: 'company' }]
    });
    
    return res.json(updatedConfig);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update HRMS config', error: error.message });
  }
}

export async function deleteHrmsConfig(req, res) {
  try {
    const { id } = req.params;
    
    const config = await HrmsConfig.findByPk(id);
    if (!config) {
      return res.status(404).json({ message: 'HRMS config not found' });
    }
    
    await config.destroy();
    return res.json({ message: 'HRMS config deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete HRMS config', error: error.message });
  }
}

export async function testHrmsConnection(req, res) {
  try {
    const { id } = req.params;
    const config = await HrmsConfig.findByPk(id);
    
    if (!config) {
      return res.status(404).json({ message: 'HRMS config not found' });
    }
    
    // Test the API connection
    const headers = {
      'Content-Type': 'application/json',
      ...config.headers
    };
    
    if (config.accessToken) {
      headers['Authorization'] = `Bearer ${config.accessToken}`;
    }
    
    if (config.apiKey) {
      headers['X-API-Key'] = config.apiKey;
    }
    
    const response = await fetch(config.apiUrl, {
      method: 'GET',
      headers
    });
    
    if (response.ok) {
      await config.update({ lastSync: new Date() });
      return res.json({ 
        message: 'Connection successful', 
        status: response.status,
        lastSync: new Date()
      });
    } else {
      return res.status(400).json({ 
        message: 'Connection failed', 
        status: response.status,
        error: await response.text()
      });
    }
  } catch (error) {
    return res.status(500).json({ message: 'Failed to test connection', error: error.message });
  }
}
