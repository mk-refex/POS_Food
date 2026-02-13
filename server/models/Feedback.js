import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Feedback extends Model {}

Feedback.init(
  {
    employeeId: { type: DataTypes.STRING(255), allowNull: false },
    transactionId: { type: DataTypes.INTEGER, allowNull: true },
    date: { type: DataTypes.STRING(10), allowNull: false },
    mealType: { type: DataTypes.ENUM('breakfast', 'lunch'), allowNull: false },
    rating: { type: DataTypes.INTEGER, allowNull: false },
    comments: { type: DataTypes.TEXT, allowNull: true },
    // items: optional per-meal itemized feedback [{ name, rating, comments }]
    items: { type: DataTypes.JSON, allowNull: true },
  },
  { sequelize, modelName: 'Feedback', tableName: 'feedbacks' },
);
