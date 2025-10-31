import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class SupportStaff extends Model {
  constructor(values, options) {
    super(values, options);
  }
}

SupportStaff.init(
  {
    // Sequelize will add an auto-increment `id` primary key by default
    staffId: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
    designation: { type: DataTypes.STRING(255), allowNull: true },
    companyName: { type: DataTypes.STRING(255), allowNull: true },
    biometricData: { type: DataTypes.TEXT, allowNull: true },
    createdBy: { type: DataTypes.STRING(255), allowNull: false, defaultValue: 'Admin' },
    createdDate: { type: DataTypes.STRING(10), allowNull: false },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { sequelize, modelName: 'SupportStaff', tableName: 'support_staff' },
);
