import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class ApiConfig extends Model {}

ApiConfig.init(
  {
    // Note: Sequelize will add an auto-increment `id` primary key by default
    baseUrl: { type: DataTypes.STRING(1024), allowNull: false },
    accessToken: { type: DataTypes.TEXT, allowNull: true },
    apiKey: { type: DataTypes.TEXT, allowNull: true },
    username: { type: DataTypes.STRING(255), allowNull: true },
    password: { type: DataTypes.STRING(255), allowNull: true },
    headersJson: { type: DataTypes.TEXT, allowNull: true },
    updatedBy: { type: DataTypes.STRING(255), allowNull: true },
    updatedDate: { type: DataTypes.STRING(10), allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { sequelize, modelName: 'ApiConfig', tableName: 'api_config' },
);


