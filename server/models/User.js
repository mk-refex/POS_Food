import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class User extends Model {
  constructor(values, options) {
    super(values, options);
  }
}

User.init(
  {
    // Sequelize will add an auto-increment `id` primary key by default
    email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    passwordHash: { type: DataTypes.STRING(255), allowNull: false },
    name: { type: DataTypes.STRING(255), allowNull: false },
    role: { type: DataTypes.ENUM('admin', 'user'), allowNull: false, defaultValue: 'user' },
  },
  { sequelize, modelName: 'User', tableName: 'users' },
);
