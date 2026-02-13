import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Menu extends Model {}

Menu.init(
  {
    date: { type: DataTypes.STRING(10), allowNull: false },
    mealType: { type: DataTypes.ENUM('breakfast', 'lunch'), allowNull: false },
    items: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
    published: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    sequelize,
    modelName: 'Menu',
    tableName: 'menus',
    indexes: [{ unique: true, fields: ['date', 'mealType'] }],
  },
);
