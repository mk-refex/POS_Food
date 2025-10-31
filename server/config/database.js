import { Sequelize } from "sequelize";

export const sequelize = new Sequelize(
  process.env.DB_NAME || "pos_food",
  process.env.DB_USER || "root",
  process.env.DB_PASSWORD || "muruku",
  {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    dialect: "mysql",
    logging: false,
  }
);

export async function initializeDatabase() {
  try {
    await sequelize.authenticate();
    // Models import must come after sequelize is created to bind associations
    const { applyAssociations } = await import("../models/index.js");
    applyAssociations();
    // Avoid MySQL "Too many keys specified" by not using alter in production
    // Use plain sync to ensure connection without attempting to recreate indexes
    await sequelize.sync();
  } catch (error) {
    throw error;
  }
}
