import { User } from './User.js';
import { Report } from './Report.js';
import { Transaction } from './Transaction.js';
import { HrmsConfig } from './HrmsConfig.js';
import { Employee } from './Employee.js';
import { SupportStaff } from './SupportStaff.js';
import { Guest } from './Guest.js';
import { PriceMaster } from './PriceMaster.js';
import { ApiConfig } from './ApiConfig.js';

export function applyAssociations() {
  User.hasMany(Report, { foreignKey: 'userId', as: 'reports' });
  Report.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  User.hasMany(Transaction, { foreignKey: 'userId', as: 'transactions' });
  Transaction.belongsTo(User, { foreignKey: 'userId', as: 'cashier' });
  // Company model removed; HrmsConfig no longer associated to Company
}

export { User, Report, Transaction, HrmsConfig, Employee, SupportStaff, Guest, PriceMaster, ApiConfig };
