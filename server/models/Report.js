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
    userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    title: { type: DataTypes.STRING(255), allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
  },
  { sequelize, modelName: 'Report', tableName: 'reports' },
);
