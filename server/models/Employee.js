import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Employee extends Model {
  constructor(values, options) {
    super(values, options);
  }
}

Employee.init(
  {
    // Sequelize will add an auto-increment `id` primary key by default
    employeeId: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    employeeName: { type: DataTypes.STRING(255), allowNull: false },
    companyName: { type: DataTypes.STRING(255), allowNull: true },
    entity: { type: DataTypes.STRING(255), allowNull: true },
    mobileNumber: { type: DataTypes.STRING(20), allowNull: true },
    location: { type: DataTypes.STRING(255), allowNull: true },
    qrCode: { type: DataTypes.TEXT, allowNull: true },
    createdBy: { type: DataTypes.STRING(255), allowNull: false, defaultValue: 'Admin' },
    createdDate: { type: DataTypes.STRING(10), allowNull: false },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { sequelize, modelName: 'Employee', tableName: 'employees' },
);
