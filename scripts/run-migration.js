const { sequelize } = require('../dist/database/config');
const Lead = require('../dist/database/models/Lead').Lead;

async function runMigration() {
  try {
    console.log('🔄 Syncing database schema...');
    
    // This will update the database schema to match our models
    await sequelize.sync({ alter: true });
    
    console.log('✅ Database schema updated successfully!');
    console.log('📊 New columns added:');
    console.log('   - address_line_1');
    console.log('   - postcode');
    console.log('   - bedroom_count');
    console.log('   - availability_at');
    console.log('   - property_cost');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating database:', error);
    process.exit(1);
  }
}

runMigration(); 