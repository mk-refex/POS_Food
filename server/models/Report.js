import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Report extends Model {
  constructor(values, options) {
    super(values, options);
  }
}

Report.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    // Match `users.id` which is a signed INTEGER by default in Sequelize
    userId: { type: DataTypes.INTEGER, allowNull: false },
    title: { type: DataTypes.STRING(255), allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
  },
  { sequelize, modelName: 'Report', tableName: 'reports' },
);
