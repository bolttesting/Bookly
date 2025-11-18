import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

config();

const prisma = new PrismaClient();

async function fixSuperAdminEnum() {
  try {
    console.log('🔧 Checking UserRole enum...');

    // Check if SUPERADMIN exists in the enum
    const result = await prisma.$queryRaw<Array<{ enumlabel: string }>>`
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UserRole')
      AND enumlabel = 'SUPERADMIN';
    `;

    if (result.length === 0) {
      console.log('➕ Adding SUPERADMIN to UserRole enum...');
      await prisma.$executeRawUnsafe(`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = 'SUPERADMIN' 
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UserRole')
          ) THEN
            ALTER TYPE "UserRole" ADD VALUE 'SUPERADMIN';
          END IF;
        END $$;
      `);
      console.log('✅ SUPERADMIN added to UserRole enum');
    } else {
      console.log('✅ SUPERADMIN already exists in UserRole enum');
    }
  } catch (error) {
    console.error('❌ Error fixing enum:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixSuperAdminEnum();

