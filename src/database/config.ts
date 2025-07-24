import { Sequelize } from 'sequelize';
import { config } from 'dotenv';

config();

const databaseUrl = process.env.DATABASE_URL || 'postgresql://cezarscerbina@localhost:5432/elevenlabs_leads';

export const sequelize = new Sequelize(databaseUrl, {
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

// Test database connection
export const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
    throw error;
  }
}; 