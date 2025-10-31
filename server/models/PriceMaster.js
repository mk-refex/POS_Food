import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class PriceMaster extends Model {
  constructor(values, options) {
    super(values, options);
  }
}

PriceMaster.init(
  {
    // Sequelize will add an auto-increment `id` primary key by default
    employeeBreakfast: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 20.00 },
    employeeLunch: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 48.00 },
    companyBreakfast: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 135.00 },
    companyLunch: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 165.00 },
    updatedBy: { type: DataTypes.STRING(255), allowNull: false, defaultValue: 'Admin' },
    updatedDate: { type: DataTypes.STRING(10), allowNull: false },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { sequelize, modelName: 'PriceMaster', tableName: 'price_master' },
);
