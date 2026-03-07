import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class SsoConfig extends Model {}

SsoConfig.init(
  {
    provider: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    clientId: { type: DataTypes.STRING(512), allowNull: true },
    clientSecret: { type: DataTypes.TEXT, allowNull: true },
    redirectUri: { type: DataTypes.STRING(1024), allowNull: true },
    frontendBaseUrl: { type: DataTypes.STRING(1024), allowNull: true },
  },
  { sequelize, modelName: 'SsoConfig', tableName: 'sso_config' },
);
