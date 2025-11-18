import { config } from 'dotenv';
import { prisma } from '../config/prisma.js';

// Load environment variables
config();

async function clearDatabase() {
  try {
    console.log('🗑️  Clearing all data from database...');

    // Get all table names that exist in the database
    const tables = await prisma.$queryRawUnsafe<{ tablename: string }[]>(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename NOT LIKE '_prisma%'
      ORDER BY tablename;
    `);

    if (tables.length === 0) {
      console.log('ℹ️  No tables found to clear.');
      return;
    }

    console.log(`📋 Found ${tables.length} tables to clear...`);

    // Disable foreign key checks by using CASCADE
    // Build TRUNCATE statement with all tables
    const tableNames = tables.map((t) => `"${t.tablename}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableNames} CASCADE;`);

    console.log('✅ Database cleared successfully!');
    console.log(`📝 Cleared ${tables.length} tables.`);
  } catch (error: any) {
    console.error('❌ Error clearing database:', error.message);
    // If truncate fails, try deleting from each table individually
    try {
      console.log('🔄 Trying alternative method...');
      const tables = await prisma.$queryRawUnsafe<{ tablename: string }[]>(`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT LIKE '_prisma%'
        ORDER BY tablename;
      `);

      for (const table of tables) {
        try {
          await prisma.$executeRawUnsafe(`DELETE FROM "${table.tablename}";`);
          console.log(`  ✓ Cleared ${table.tablename}`);
        } catch (err: any) {
          console.warn(`  ⚠️  Could not clear ${table.tablename}: ${err.message}`);
        }
      }
      console.log('✅ Database cleared using alternative method!');
    } catch (altError) {
      console.error('❌ Alternative method also failed:', altError);
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

clearDatabase();
