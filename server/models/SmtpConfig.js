import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class SmtpConfig extends Model {}

SmtpConfig.init(
  {
    host: { type: DataTypes.STRING(255), allowNull: true },
    port: { type: DataTypes.INTEGER, allowNull: true },
    secure: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    user: { type: DataTypes.STRING(255), allowNull: true },
    password: { type: DataTypes.TEXT, allowNull: true },
    fromEmail: { type: DataTypes.STRING(255), allowNull: true },
    fromName: { type: DataTypes.STRING(255), allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { sequelize, modelName: 'SmtpConfig', tableName: 'smtp_config' },
);
