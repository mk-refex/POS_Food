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
    const { applyAssociations, SsoConfig, SmtpConfig, Feedback, Guest } = await import("../models/index.js");
    applyAssociations();
    // Avoid MySQL "Too many keys specified" by not using alter on all tables
    await sequelize.sync({alter: true});
    // Ensure sso_config has all columns (e.g. redirect_uri) if model was updated
    try {
      await SsoConfig.sync({ alter: false });
    } catch (e) {
      console.warn("SsoConfig.sync(alter) skipped:", e?.message || e);
    }
    try {
      await SmtpConfig.sync({ alter: true });
    } catch (e) {
      console.warn("SmtpConfig.sync(alter) skipped:", e?.message || e);
    }
    try {
      await Feedback.sync({ alter: true });
    } catch (e) {
      console.warn("Feedback.sync(alter) skipped:", e?.message || e);
    }
    try {
      await Guest.sync({ alter: true });
    } catch (e) {
      console.warn("Guest.sync(alter) skipped:", e?.message || e);
    }
  } catch (error) {
    throw error;
  }
}
