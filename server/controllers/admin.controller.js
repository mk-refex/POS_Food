import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import { User, ApiConfig, SsoConfig, SmtpConfig } from '../models/index.js';
import nodemailer from 'nodemailer';

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
  username: z.string().min(3).regex(/^[a-zA-Z0-9_.-]+$/).optional(),
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
    
    const { username, email, password, name, role = 'user' } = parse.data;
    
    // Check if user already exists by email or username
    const existingUser = await User.findOne({ 
      where: { 
        [Op.or]: [
          { email },
          ...(username ? [{ username }] : [])
        ]
      } 
    });
    
    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(409).json({ message: 'Email already in use' });
      }
      if (username && existingUser.username === username) {
        return res.status(409).json({ message: 'Username already in use' });
      }
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ 
      username: username || null,
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
  username: z.string().min(3).regex(/^[a-zA-Z0-9_.-]+$/).optional(),
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
    
    // Check email and username uniqueness if being updated
    if (updateData.email && updateData.email !== user.email) {
      const existingUser = await User.findOne({ where: { email: updateData.email } });
      if (existingUser) {
        return res.status(409).json({ message: 'Email already in use' });
      }
    }
    
    if (updateData.username && updateData.username !== user.username) {
      const existingUser = await User.findOne({ where: { username: updateData.username } });
      if (existingUser) {
        return res.status(409).json({ message: 'Username already in use' });
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

// SSO Config (Google) – get/upsert for employee login
export async function getSsoConfig(req, res) {
  try {
    const config = await SsoConfig.findOne({ where: { provider: 'google' } });
    if (!config) {
      return res.json(null);
    }
    const json = config.toJSON();
    // Don't send full secret to client; indicate if set
    if (json.clientSecret) {
      json.clientSecret = '••••••';
    }
    return res.json(json);
  } catch (e) {
    return res.status(500).json({ message: 'Failed to fetch SSO config', error: e.message });
  }
}

export async function upsertSsoConfig(req, res) {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { provider, clientId, clientSecret, redirectUri, frontendBaseUrl } = body;
    const effectiveProvider = (String(provider || 'google').trim()) || 'google';
    let config = await SsoConfig.findOne({ where: { provider: effectiveProvider } });
    if (!config) {
      config = await SsoConfig.create({
        provider: effectiveProvider,
        clientId: clientId != null ? String(clientId) : '',
        clientSecret: clientSecret != null ? String(clientSecret) : '',
        redirectUri: (redirectUri != null && String(redirectUri).trim()) ? String(redirectUri).trim() : null,
        frontendBaseUrl: (frontendBaseUrl != null && String(frontendBaseUrl).trim()) ? String(frontendBaseUrl).trim() : null,
      });
    } else {
      const updates = {
        clientId: clientId !== undefined ? (clientId == null ? '' : String(clientId)) : config.clientId,
        redirectUri: redirectUri !== undefined ? ((redirectUri == null || String(redirectUri).trim() === '') ? null : String(redirectUri).trim()) : config.redirectUri,
        frontendBaseUrl: frontendBaseUrl !== undefined ? ((frontendBaseUrl == null || String(frontendBaseUrl).trim() === '') ? null : String(frontendBaseUrl).trim()) : config.frontendBaseUrl,
      };
      if (clientSecret !== undefined && clientSecret !== '' && clientSecret !== '••••••') {
        updates.clientSecret = String(clientSecret);
      }
      await config.update(updates);
    }
    await config.reload();
    const json = config.toJSON();
    if (json.clientSecret) json.clientSecret = '••••••';
    return res.json(json);
  } catch (e) {
    console.error('SSO config save error:', e);
    return res.status(500).json({ message: e.message || 'Failed to save SSO config', error: e.message });
  }
}

// SMTP Config – get/upsert/test
export async function getSmtpConfig(req, res) {
  try {
    const config = await SmtpConfig.findOne({ where: { isActive: true } });
    if (!config) return res.json(null);
    const json = config.toJSON();
    if (json.password) json.password = '••••••';
    return res.json(json);
  } catch (e) {
    return res.status(500).json({ message: 'Failed to fetch SMTP config', error: e.message });
  }
}

export async function upsertSmtpConfig(req, res) {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { host, port, secure, user, password, fromEmail, fromName } = body;
    let config = await SmtpConfig.findOne({ where: { isActive: true } });
    const payload = {
      host: host != null ? String(host).trim() : '',
      port: port != null && port !== '' ? Number(port) : null,
      secure: secure !== false && secure !== 'false',
      user: user != null ? String(user).trim() : '',
      fromEmail: fromEmail != null ? String(fromEmail).trim() : '',
      fromName: fromName != null ? String(fromName).trim() : '',
    };
    if (password !== undefined && password !== '' && password !== '••••••') {
      payload.password = String(password);
    }
    if (!config) {
      config = await SmtpConfig.create({ ...payload, isActive: true });
    } else {
      await config.update(payload);
    }
    await config.reload();
    const json = config.toJSON();
    if (json.password) json.password = '••••••';
    return res.json(json);
  } catch (e) {
    return res.status(500).json({ message: e.message || 'Failed to save SMTP config', error: e.message });
  }
}

export async function testSmtp(req, res) {
  try {
    const { testEmail } = req.body && typeof req.body === 'object' ? req.body : {};
    const to = (testEmail && String(testEmail).trim()) || null;
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return res.status(400).json({ message: 'Valid test email address is required' });
    }
    const config = await SmtpConfig.findOne({ where: { isActive: true } });
    if (!config || !config.host || !config.user) {
      return res.status(400).json({ message: 'SMTP config not set or incomplete. Save host and user first.' });
    }
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port || (config.secure ? 465 : 587),
      secure: !!config.secure,
      auth: config.user ? { user: config.user, pass: config.password || '' } : undefined,
    });
    const from = config.fromEmail || config.user || 'noreply@localhost';
    const fromName = config.fromName || 'POS Food';
    await transporter.sendMail({
      from: config.fromName ? `"${config.fromName}" <${from}>` : from,
      to,
      subject: 'POS Food – SMTP test',
      text: 'This is a test email from your POS Food SMTP configuration. If you received this, SMTP is working.',
    });
    return res.json({ success: true, message: 'Test email sent successfully' });
  } catch (e) {
    return res.status(500).json({ message: e.message || 'Failed to send test email', error: e.message });
  }
}

// Run full HRMS sync (create + update employees & support staff). Used by cron and manual sync.
export async function runHrmsSyncEndpoint(req, res) {
  try {
    const { runHrmsSync } = await import('../services/hrmsSync.js');
    const result = await runHrmsSync();
    if (result.error) {
      return res.status(500).json({ message: result.error, result });
    }
    return res.json(result);
  } catch (e) {
    return res.status(500).json({ message: 'HRMS sync failed', error: e.message });
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
