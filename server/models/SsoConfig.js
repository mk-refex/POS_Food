import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class SsoConfig extends Model {}

SsoConfig.init(
  {
    provider: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    displayName: { type: DataTypes.STRING(100), allowNull: true },
    iconUrl: { type: DataTypes.STRING(1024), allowNull: true },
    sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    clientId: { type: DataTypes.STRING(512), allowNull: true },
    clientSecret: { type: DataTypes.TEXT, allowNull: true },
    redirectUri: { type: DataTypes.STRING(1024), allowNull: true },
    frontendBaseUrl: { type: DataTypes.STRING(1024), allowNull: true },
    authorizationUrl: { type: DataTypes.STRING(1024), allowNull: true },
    tokenUrl: { type: DataTypes.STRING(1024), allowNull: true },
    userInfoUrl: { type: DataTypes.STRING(1024), allowNull: true },
    discoveryUrl: { type: DataTypes.STRING(1024), allowNull: true },
    scopes: { type: DataTypes.STRING(512), allowNull: true, defaultValue: 'openid email profile' },
  },
  { sequelize, modelName: 'SsoConfig', tableName: 'sso_config' },
);
