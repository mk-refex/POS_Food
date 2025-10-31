import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class HrmsConfig extends Model {
  constructor(values, options) {
    super(values, options);
  }
}

HrmsConfig.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    companyId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    apiUrl: { type: DataTypes.STRING(500), allowNull: false },
    accessToken: { type: DataTypes.TEXT, allowNull: true },
    apiKey: { type: DataTypes.STRING(255), allowNull: true },
    username: { type: DataTypes.STRING(255), allowNull: true },
    password: { type: DataTypes.STRING(255), allowNull: true },
    headers: { type: DataTypes.JSON, allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    lastSync: { type: DataTypes.DATE, allowNull: true },
    syncInterval: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 24 }, // hours
  },
  { sequelize, modelName: 'HrmsConfig', tableName: 'hrms_configs' },
);
