import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Guest extends Model {
  constructor(values, options) {
    super(values, options);
  }
}

Guest.init(
  {
    // Sequelize will add an auto-increment `id` primary key by default
    name: { type: DataTypes.STRING(255), allowNull: false },
    companyName: { type: DataTypes.STRING(255), allowNull: false },
    createdBy: { type: DataTypes.STRING(255), allowNull: false, defaultValue: 'Admin' },
    createdDate: { type: DataTypes.STRING(10), allowNull: false },
    expirationDate: { type: DataTypes.DATEONLY, allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { sequelize, modelName: 'Guest', tableName: 'guests' },
);
