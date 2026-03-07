import { Employee, SupportStaff, Guest, PriceMaster } from '../models/index.js';
import { Op } from 'sequelize';
import { emitMasterUpdated } from '../socket.js';

// Employee Controller
export const getEmployees = async (req, res) => {
  try {
    const {
      page = '1',
      limit = '20',
      sortBy = 'employeeName',
      sortOrder = 'ASC',
      q,
      companyName,
      entity,
    } = req.query || {};

    const numericPage = Math.max(parseInt(String(page) || '1', 10), 1);
    const numericLimit = Math.min(Math.max(parseInt(String(limit) || '20', 10), 1), 200);
    const offset = (numericPage - 1) * numericLimit;

    const where = { isActive: true };
    const andClauses = [];
    if (q) {
      andClauses.push({
        [Op.or]: [
          { employeeName: { [Op.like]: `%${q}%` } },
          { employeeId: { [Op.like]: `%${q}%` } },
          { companyName: { [Op.like]: `%${q}%` } },
          { entity: { [Op.like]: `%${q}%` } },
          { mobileNumber: { [Op.like]: `%${q}%` } },
          { location: { [Op.like]: `%${q}%` } },
        ],
      });
    }
    if (companyName) andClauses.push({ companyName });
    if (entity) andClauses.push({ entity });
    if (andClauses.length) Object.assign(where, { [Op.and]: andClauses });

    const order = [[String(sortBy), String(sortOrder).toUpperCase() === 'DESC' ? 'DESC' : 'ASC']];

    const { rows, count } = await Employee.findAndCountAll({ where, order, limit: numericLimit, offset });
    res.json({ data: rows, total: count, page: numericPage, limit: numericLimit });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
};

export const createEmployee = async (req, res) => {
  try {
    const { employeeId, employeeName, companyName, entity, mobileNumber, location, qrCode } = req.body;
    
    // Check if employee with same ID already exists
    const existingEmployee = await Employee.findOne({ where: { employeeId } });
    if (existingEmployee) {
      return res.status(400).json({ error: 'Employee with this ID already exists' });
    }

    const employee = await Employee.create({
      employeeId,
      employeeName,
      companyName,
      entity,
      mobileNumber,
      location,
      qrCode,
      createdBy: req.user?.name || 'Admin',
      createdDate: new Date().toISOString().split('T')[0]
    });
    emitMasterUpdated();
    res.status(201).json(employee);
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({ error: 'Failed to create employee' });
  }
};

export const updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const { employeeId, employeeName, companyName, entity, mobileNumber, location, qrCode } = req.body;

    const employee = await Employee.findByPk(id);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Check if employee ID is being changed and if new ID already exists
    if (employeeId !== employee.employeeId) {
      const existingEmployee = await Employee.findOne({ where: { employeeId } });
      if (existingEmployee) {
        return res.status(400).json({ error: 'Employee with this ID already exists' });
      }
    }

    await employee.update({
      employeeId,
      employeeName,
      companyName,
      entity,
      mobileNumber,
      location,
      qrCode
    });
    emitMasterUpdated();
    res.json(employee);
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({ error: 'Failed to update employee' });
  }
};

export const deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await Employee.findByPk(id);
    
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    await employee.update({ isActive: false });
    emitMasterUpdated();
    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ error: 'Failed to delete employee' });
  }
};

// Support Staff Controller
export const getSupportStaff = async (req, res) => {
  try {
    const { page = '1', limit = '20', sortBy = 'name', sortOrder = 'ASC', q, designation, companyName } = req.query || {};
    const numericPage = Math.max(parseInt(String(page) || '1', 10), 1);
    const numericLimit = Math.min(Math.max(parseInt(String(limit) || '20', 10), 1), 200);
    const offset = (numericPage - 1) * numericLimit;

    const where = { isActive: true };
    const andClauses = [];
    if (q) {
      andClauses.push({
        [Op.or]: [
          { name: { [Op.like]: `%${q}%` } },
          { staffId: { [Op.like]: `%${q}%` } },
          { designation: { [Op.like]: `%${q}%` } },
          { companyName: { [Op.like]: `%${q}%` } },
        ],
      });
    }
    if (designation) andClauses.push({ designation });
    if (companyName) andClauses.push({ companyName });
    if (andClauses.length) Object.assign(where, { [Op.and]: andClauses });

    const order = [[String(sortBy), String(sortOrder).toUpperCase() === 'DESC' ? 'DESC' : 'ASC']];

    const { rows, count } = await SupportStaff.findAndCountAll({ where, order, limit: numericLimit, offset });
    res.json({ data: rows, total: count, page: numericPage, limit: numericLimit });
  } catch (error) {
    console.error('Error fetching support staff:', error);
    res.status(500).json({ error: 'Failed to fetch support staff' });
  }
};

export const createSupportStaff = async (req, res) => {
  try {
    const { staffId, name, designation, companyName, biometricData } = req.body;
    
    // Check if support staff with same ID already exists
    const existingStaff = await SupportStaff.findOne({ where: { staffId } });
    if (existingStaff) {
      return res.status(400).json({ error: 'Support staff with this ID already exists' });
    }

    const staff = await SupportStaff.create({
      staffId,
      name,
      designation,
      companyName,
      biometricData,
      createdBy: req.user?.name || 'Admin',
      createdDate: new Date().toISOString().split('T')[0]
    });
    emitMasterUpdated();
    res.status(201).json(staff);
  } catch (error) {
    console.error('Error creating support staff:', error);
    res.status(500).json({ error: 'Failed to create support staff' });
  }
};

export const updateSupportStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { staffId, name, designation, companyName, biometricData } = req.body;

    const staff = await SupportStaff.findByPk(id);
    if (!staff) {
      return res.status(404).json({ error: 'Support staff not found' });
    }

    // Check if staff ID is being changed and if new ID already exists
    if (staffId !== staff.staffId) {
      const existingStaff = await SupportStaff.findOne({ where: { staffId } });
      if (existingStaff) {
        return res.status(400).json({ error: 'Support staff with this ID already exists' });
      }
    }

    await staff.update({
      staffId,
      name,
      designation,
      companyName,
      biometricData
    });
    emitMasterUpdated();
    res.json(staff);
  } catch (error) {
    console.error('Error updating support staff:', error);
    res.status(500).json({ error: 'Failed to update support staff' });
  }
};

export const deleteSupportStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const staff = await SupportStaff.findByPk(id);
    
    if (!staff) {
      return res.status(404).json({ error: 'Support staff not found' });
    }

    await staff.update({ isActive: false });
    emitMasterUpdated();
    res.json({ message: 'Support staff deleted successfully' });
  } catch (error) {
    console.error('Error deleting support staff:', error);
    res.status(500).json({ error: 'Failed to delete support staff' });
  }
};

// Guest Controller
export const getGuests = async (req, res) => {
  try {
    const { page = '1', limit = '20', sortBy = 'name', sortOrder = 'ASC', q, companyName } = req.query || {};
    const numericPage = Math.max(parseInt(String(page) || '1', 10), 1);
    const numericLimit = Math.min(Math.max(parseInt(String(limit) || '20', 10), 1), 200);
    const offset = (numericPage - 1) * numericLimit;

    const where = { isActive: true };
    const andClauses = [];
    if (q) {
      andClauses.push({
        [Op.or]: [
          { name: { [Op.like]: `%${q}%` } },
          { companyName: { [Op.like]: `%${q}%` } },
        ],
      });
    }
    if (companyName) andClauses.push({ companyName });
    if (andClauses.length) Object.assign(where, { [Op.and]: andClauses });

    const order = [[String(sortBy), String(sortOrder).toUpperCase() === 'DESC' ? 'DESC' : 'ASC']];

    const { rows, count } = await Guest.findAndCountAll({ where, order, limit: numericLimit, offset });
    res.json({ data: rows, total: count, page: numericPage, limit: numericLimit });
  } catch (error) {
    console.error('Error fetching guests:', error);
    res.status(500).json({ error: 'Failed to fetch guests' });
  }
};

export const createGuest = async (req, res) => {
  try {
    const { name, companyName, expirationDate } = req.body;
    const exp = expirationDate && String(expirationDate).trim() ? String(expirationDate).trim().slice(0, 10) : null;

    const guest = await Guest.create({
      name,
      companyName,
      createdBy: req.user?.name || 'Admin',
      createdDate: new Date().toISOString().split('T')[0],
      expirationDate: exp,
    });
    emitMasterUpdated();
    res.status(201).json(guest);
  } catch (error) {
    console.error('Error creating guest:', error);
    res.status(500).json({ error: 'Failed to create guest' });
  }
};

export const updateGuest = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, companyName, expirationDate } = req.body;
    const exp = expirationDate !== undefined ? (expirationDate && String(expirationDate).trim() ? String(expirationDate).trim().slice(0, 10) : null) : undefined;

    const guest = await Guest.findByPk(id);
    if (!guest) {
      return res.status(404).json({ error: 'Guest not found' });
    }

    const updates = { name, companyName };
    if (exp !== undefined) updates.expirationDate = exp;
    await guest.update(updates);
    emitMasterUpdated();
    res.json(guest);
  } catch (error) {
    console.error('Error updating guest:', error);
    res.status(500).json({ error: 'Failed to update guest' });
  }
};

export const deleteGuest = async (req, res) => {
  try {
    const { id } = req.params;
    const guest = await Guest.findByPk(id);
    
    if (!guest) {
      return res.status(404).json({ error: 'Guest not found' });
    }

    await guest.update({ isActive: false });
    emitMasterUpdated();
    res.json({ message: 'Guest deleted successfully' });
  } catch (error) {
    console.error('Error deleting guest:', error);
    res.status(500).json({ error: 'Failed to delete guest' });
  }
};

// Price Master Controller
export const getPriceMaster = async (req, res) => {
  try {
    let priceMaster = await PriceMaster.findOne({ where: { isActive: true } });
    
    if (!priceMaster) {
      // Create default price master if none exists
      priceMaster = await PriceMaster.create({
        employeeBreakfast: 20.00,
        employeeLunch: 48.00,
        companyBreakfast: 135.00,
        companyLunch: 165.00,
        updatedBy: 'System',
        updatedDate: new Date().toISOString().split('T')[0]
      });
    }

    // Format response to match frontend structure
    res.json({
      employee: {
        breakfast: parseFloat(priceMaster.employeeBreakfast),
        lunch: parseFloat(priceMaster.employeeLunch)
      },
      company: {
        breakfast: parseFloat(priceMaster.companyBreakfast),
        lunch: parseFloat(priceMaster.companyLunch)
      }
    });
  } catch (error) {
    console.error('Error fetching price master:', error);
    res.status(500).json({ error: 'Failed to fetch price master' });
  }
};

export const updatePriceMaster = async (req, res) => {
  try {
    const { employee, company } = req.body;

    let priceMaster = await PriceMaster.findOne({ where: { isActive: true } });
    
    if (!priceMaster) {
      priceMaster = await PriceMaster.create({
        employeeBreakfast: employee.breakfast,
        employeeLunch: employee.lunch,
        companyBreakfast: company.breakfast,
        companyLunch: company.lunch,
        updatedBy: req.user?.name || 'Admin',
        updatedDate: new Date().toISOString().split('T')[0]
      });
    } else {
      await priceMaster.update({
        employeeBreakfast: employee.breakfast,
        employeeLunch: employee.lunch,
        companyBreakfast: company.breakfast,
        companyLunch: company.lunch,
        updatedBy: req.user?.name || 'Admin',
        updatedDate: new Date().toISOString().split('T')[0]
      });
    }

    // Format response to match frontend structure
    res.json({
      employee: {
        breakfast: parseFloat(priceMaster.employeeBreakfast),
        lunch: parseFloat(priceMaster.employeeLunch)
      },
      company: {
        breakfast: parseFloat(priceMaster.companyBreakfast),
        lunch: parseFloat(priceMaster.companyLunch)
      }
    });
  } catch (error) {
    console.error('Error updating price master:', error);
    res.status(500).json({ error: 'Failed to update price master' });
  }
};
