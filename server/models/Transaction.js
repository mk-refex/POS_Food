import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Transaction extends Model {
  constructor(values, options) {
    super(values, options);
  }
}

Transaction.init(
  {
    // Sequelize will add an auto-increment `id` primary key by default
    userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    customerType: { type: DataTypes.ENUM('employee', 'guest', 'supportStaff'), allowNull: false },
    customerId: { type: DataTypes.STRING(255), allowNull: true },
    customerName: { type: DataTypes.STRING(255), allowNull: true },
    companyName: { type: DataTypes.STRING(255), allowNull: true },
    date: { type: DataTypes.STRING(10), allowNull: false },
    time: { type: DataTypes.STRING(20), allowNull: false },
    items: { type: DataTypes.JSON, allowNull: false },
    totalItems: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    totalAmount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  },
  { sequelize, modelName: 'Transaction', tableName: 'transactions' },
);
